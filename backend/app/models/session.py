import uuid

from sqlalchemy import Column, ForeignKey, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.db.postgres import Base


class ChatSession(Base):
    """A Q&A session tied to one document. Named ChatSession (table: sessions) to avoid
    colliding with sqlalchemy.orm.Session, which is imported throughout the db layer."""

    __tablename__ = "sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
