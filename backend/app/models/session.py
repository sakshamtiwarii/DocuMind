import uuid

from sqlalchemy import Column, String, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.db.postgres import Base


class ChatSession(Base):
    """A conversation. Named ChatSession (table: sessions) to avoid colliding with
    sqlalchemy.orm.Session, which is imported throughout the db layer. Can have zero or
    more documents attached via SessionDocument, not just one — a conversation grows as
    more PDFs are added to it."""

    __tablename__ = "sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.clock_timestamp())
