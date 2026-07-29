import uuid

from sqlalchemy import Column, ForeignKey, JSON, String, Text, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.db.postgres import Base


class Message(Base):
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=False)
    role = Column(String, nullable=False)  # 'user' | 'assistant'
    content = Column(Text, nullable=False)
    sources = Column(JSON, nullable=True)  # chunk_ids / page numbers cited
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
