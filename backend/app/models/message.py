import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPKMixin


class Message(Base, UUIDPKMixin):
    __tablename__ = "messages"

    sender_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    recipient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # The ciphertext of the message, encrypted by the sender using the recipient's public key.
    encrypted_content: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Depending on the encryption scheme (e.g. NaCl Box), we need to store the nonce or symmetric key wrapper.
    nonce: Mapped[str] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()", nullable=False)

    sender: Mapped["User"] = relationship("User", foreign_keys=[sender_id])
    recipient: Mapped["User"] = relationship("User", foreign_keys=[recipient_id])

    def __repr__(self) -> str:
        return f"<Message {self.id} from {self.sender_id} to {self.recipient_id}>"
