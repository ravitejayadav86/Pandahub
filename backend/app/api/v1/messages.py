import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_

from app.db.session import get_db
from app.models.user import User
from app.models.message import Message
from app.api.deps import get_current_active_user
from app.websockets.manager import ws_manager
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()

class PublicKeyUpdate(BaseModel):
    public_key: str

class MessageSend(BaseModel):
    encrypted_content: str
    nonce: Optional[str] = None

class MessageOut(BaseModel):
    id: str
    sender_id: str
    recipient_id: str
    encrypted_content: str
    nonce: Optional[str]
    created_at: datetime
    sender_username: str

@router.post("/keys", summary="Update public key for E2EE")
async def update_public_key(
    data: PublicKeyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    current_user.public_key = data.public_key
    await db.commit()
    return {"status": "ok", "message": "Public key updated."}


@router.get("/{username}", summary="Get E2EE chat history with a user")
async def get_messages(
    username: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    # Find the target user
    result = await db.execute(select(User).where(User.username == username))
    target_user = result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found.")

    # Fetch messages between current_user and target_user
    stmt = (
        select(Message, User)
        .join(User, User.id == Message.sender_id)
        .where(
            or_(
                and_(Message.sender_id == current_user.id, Message.recipient_id == target_user.id),
                and_(Message.sender_id == target_user.id, Message.recipient_id == current_user.id)
            )
        )
        .order_by(Message.created_at.asc())
        .limit(100)
    )
    result = await db.execute(stmt)
    rows = result.all()

    return [
        {
            "id": str(msg.id),
            "sender_id": str(msg.sender_id),
            "recipient_id": str(msg.recipient_id),
            "encrypted_content": msg.encrypted_content,
            "nonce": msg.nonce,
            "created_at": msg.created_at,
            "sender_username": sender.username,
        }
        for msg, sender in rows
    ]

@router.post("/{username}", summary="Send E2EE message to a user")
async def send_message(
    username: str,
    data: MessageSend,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    # Find the target user
    result = await db.execute(select(User).where(User.username == username))
    target_user = result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found.")
    
    if not target_user.public_key:
        raise HTTPException(status_code=400, detail="Target user has not set up E2EE keys.")

    new_msg = Message(
        sender_id=current_user.id,
        recipient_id=target_user.id,
        encrypted_content=data.encrypted_content,
        nonce=data.nonce
    )
    db.add(new_msg)
    await db.commit()
    await db.refresh(new_msg)

    # Broadcast via websockets if recipient is online
    payload = {
        "type": "CHAT_MESSAGE",
        "data": {
            "id": str(new_msg.id),
            "sender_id": str(new_msg.sender_id),
            "recipient_id": str(new_msg.recipient_id),
            "encrypted_content": new_msg.encrypted_content,
            "nonce": new_msg.nonce,
            "created_at": new_msg.created_at.isoformat(),
            "sender_username": current_user.username,
        }
    }
    
    # In PandaHub, ws_manager has a broadcast_to_user method
    if hasattr(ws_manager, 'broadcast_to_user'):
        await ws_manager.broadcast_to_user(str(target_user.id), payload)

    return {"status": "ok", "message": "Sent", "id": str(new_msg.id)}
