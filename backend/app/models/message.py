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
    # clock_timestamp() (not now()) — now()/CURRENT_TIMESTAMP is the transaction's start
    # time, so a user+assistant pair inserted in the same commit would get identical values,
    # making ORDER BY created_at ties undefined between them.
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.clock_timestamp())
