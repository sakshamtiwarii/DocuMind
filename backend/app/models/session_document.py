import uuid

from sqlalchemy import Column, ForeignKey, TIMESTAMP, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.db.postgres import Base


class SessionDocument(Base):
    """Join table linking a conversation (ChatSession) to the documents attached to it.
    Many-to-many: a session can have multiple documents, and a document could in
    principle be attached to more than one session."""

    __tablename__ = "session_documents"
    __table_args__ = (UniqueConstraint("session_id", "document_id", name="uq_session_document"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=False)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=False)
    added_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
