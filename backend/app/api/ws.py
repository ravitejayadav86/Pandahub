"""
WebSocket endpoint for real-time notifications.

Auth via `?token=` query parameter, not an Authorization header -- the
browser's native WebSocket API has no way to set custom headers on the
handshake request, so the query-param pattern is the standard workaround
(same approach GitHub, Slack, etc. use). The token is still a normal JWT
access token; it's just transported differently for this one endpoint.

Mounted at `/ws/notifications` (not under `/api/v1`) to match nginx.conf's
dedicated `/ws/` routing block from Module 2, which upgrades the
connection before it ever reaches the general API middleware stack.
"""
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import JWTError
from sqlalchemy import select

from app.core.security import decode_access_token
from app.core.logging import get_logger
from app.db.session import AsyncSessionLocal
from app.models.user import User
from app.websockets.manager import connection_manager

router = APIRouter(tags=["websockets"])
logger = get_logger("app.websockets.route")


async def _authenticate_ws_token(token: str) -> uuid.UUID | None:
    try:
        payload = decode_access_token(token)
        if payload.get("purpose") == "2fa_challenge":
            return None
        return uuid.UUID(payload["sub"])
    except (JWTError, KeyError, ValueError):
        return None


@router.websocket("/ws/notifications")
async def notifications_websocket(websocket: WebSocket, token: str = Query(...)):
    user_id = await _authenticate_ws_token(token)
    if user_id is None:
        # Reject before accept() -- sends a proper close frame with a policy
        # violation code rather than silently accepting an unauthenticated socket.
        await websocket.close(code=4401)
        return

    # Confirm the user still exists/is active -- a valid-but-stale JWT
    # shouldn't grant a live connection for a deleted/deactivated account.
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user is None or not user.is_active:
            await websocket.close(code=4401)
            return

    user_id_str = str(user_id)
    await connection_manager.connect(user_id_str, websocket)
    try:
        while True:
            # Clients don't need to send anything -- this is a push-only
            # channel -- but we still need to await receive() to detect
            # disconnects promptly (a closed socket raises WebSocketDisconnect
            # here rather than only being noticed on the next send attempt).
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        connection_manager.disconnect(user_id_str, websocket)
