import uuid

from sqlalchemy import Column, Integer, String, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.db.postgres import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename = Column(String, nullable=False)
    uploaded_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    status = Column(String, nullable=False, default="processing")  # 'processing' | 'ready' | 'failed'
    page_count = Column(Integer, nullable=True)
