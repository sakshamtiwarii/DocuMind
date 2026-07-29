"""
These tests hit the real local Postgres (via docker-compose) for DB reads/writes —
no in-memory DB substitute is used, matching how this project has been built and tested
throughout. OpenAI and Qdrant calls are mocked out where they'd otherwise cost money or
require network access. Run `docker compose up -d` before running the suite.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db.postgres import SessionLocal
from app.models import ChatSession, Document


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _make_document(status: str, page_count: int | None = None) -> str:
    db = SessionLocal()
    doc = Document(filename="test.pdf", status=status, page_count=page_count)
    db.add(doc)
    db.commit()
    document_id = str(doc.id)
    db.close()
    return document_id


def _delete_document(document_id: str):
    db = SessionLocal()
    db.query(Document).filter(Document.id == document_id).delete()
    db.commit()
    db.close()


@pytest.fixture
def ready_document():
    document_id = _make_document(status="ready", page_count=1)
    yield document_id
    _delete_document(document_id)


@pytest.fixture
def processing_document():
    document_id = _make_document(status="processing")
    yield document_id
    _delete_document(document_id)


@pytest.fixture
def failed_document():
    document_id = _make_document(status="failed")
    yield document_id
    _delete_document(document_id)


@pytest.fixture
def ready_session(ready_document):
    db = SessionLocal()
    session = ChatSession(document_id=ready_document)
    db.add(session)
    db.commit()
    session_id = str(session.id)
    db.close()
    yield session_id, ready_document
    db = SessionLocal()
    db.query(ChatSession).filter(ChatSession.id == session_id).delete()
    db.commit()
    db.close()
