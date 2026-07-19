"""
WebSocket connection manager.

Per Module 1's real-time architecture decision: the moment more than one
API instance is running (horizontal scaling), an in-memory-only connection
manager breaks -- a notification published from the process handling
instance A's request never reaches a client connected to instance B.

So: each process keeps a purely LOCAL map of user_id -> set of active
WebSocket connections (for actually writing bytes to a socket, which can
only happen on the process holding that socket). But the actual event
distribution goes through Redis pub/sub -- any process can `publish()` an
event, and every process's listener task receives it and forwards to
whichever of ITS OWN locally-connected clients match the target user_id.
"""
import asyncio
import json
import uuid

from fastapi import WebSocket

from app.core.config import get_settings
from app.core.logging import get_logger
import redis.asyncio as aioredis

settings = get_settings()
logger = get_logger("app.websockets")

NOTIFICATIONS_CHANNEL = "ws:notifications"


class ConnectionManager:
    def __init__(self) -> None:
        # Local-only: user_id (str) -> set of WebSocket connections on THIS process.
        self._connections: dict[str, set[WebSocket]] = {}
        self._redis: aioredis.Redis | None = None
        self._listener_task: asyncio.Task | None = None

    async def connect(self, user_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.setdefault(user_id, set()).add(websocket)
        logger.info("websocket connected", extra={"user_id": user_id})

    def disconnect(self, user_id: str, websocket: WebSocket) -> None:
        conns = self._connections.get(user_id)
        if conns is not None:
            conns.discard(websocket)
            if not conns:
                self._connections.pop(user_id, None)
        logger.info("websocket disconnected", extra={"user_id": user_id})

    async def publish(self, user_id: str, event_type: str, data: dict) -> None:
        """Call this from ANY service (issue_service, pr_service, notification_service)
        to push a real-time event -- works regardless of which process the
        target user's socket is actually connected to."""
        if self._redis is None:
            self._redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)

        payload = json.dumps({"user_id": user_id, "event_type": event_type, "data": data})
        await self._redis.publish(NOTIFICATIONS_CHANNEL, payload)

    async def _deliver_local(self, user_id: str, event_type: str, data: dict) -> None:
        """Send to this process's locally-connected sockets for user_id only."""
        conns = self._connections.get(user_id)
        if not conns:
            return
        message = json.dumps({"event_type": event_type, "data": data})
        dead: list[WebSocket] = []
        for ws in conns:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            conns.discard(ws)

    async def start_listener(self) -> None:
        """Run once at app startup (see main.py lifespan). Subscribes to the
        shared Redis channel and forwards each event to this process's
        locally-connected clients, if any."""
        redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        pubsub = redis_client.pubsub()
        await pubsub.subscribe(NOTIFICATIONS_CHANNEL)
        logger.info("websocket redis listener started")

        async def _listen():
            async for message in pubsub.listen():
                if message["type"] != "message":
                    continue
                try:
                    payload = json.loads(message["data"])
                    await self._deliver_local(payload["user_id"], payload["event_type"], payload["data"])
                except Exception:
                    logger.exception("failed processing pubsub message")

        self._listener_task = asyncio.create_task(_listen())

    async def stop_listener(self) -> None:
        if self._listener_task:
            self._listener_task.cancel()
        if self._redis:
            await self._redis.close()


# Singleton -- imported by both the WebSocket route and any service that
# needs to publish an event (e.g. `from app.websockets.manager import connection_manager`).
connection_manager = ConnectionManager()
