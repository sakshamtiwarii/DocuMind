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
from app.models import ChatSession, Document, SessionDocument


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
    # Clear any session_documents rows first — teardown order between a document fixture
    # and a session fixture that attached it isn't guaranteed, so this must not depend on it.
    db.query(SessionDocument).filter(SessionDocument.document_id == document_id).delete()
    db.query(Document).filter(Document.id == document_id).delete()
    db.commit()
    db.close()


def _delete_session(session_id: str):
    db = SessionLocal()
    db.query(SessionDocument).filter(SessionDocument.session_id == session_id).delete()
    db.query(ChatSession).filter(ChatSession.id == session_id).delete()
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
def empty_session():
    """A conversation with no documents attached."""
    db = SessionLocal()
    session = ChatSession()
    db.add(session)
    db.commit()
    session_id = str(session.id)
    db.close()
    yield session_id
    _delete_session(session_id)


def _session_with_document(document_id: str) -> str:
    db = SessionLocal()
    session = ChatSession()
    db.add(session)
    db.commit()
    session_id = str(session.id)
    db.add(SessionDocument(session_id=session_id, document_id=document_id))
    db.commit()
    db.close()
    return session_id


@pytest.fixture
def ready_session(ready_document):
    """A conversation with one 'ready' document attached — the happy path for /ask."""
    session_id = _session_with_document(ready_document)
    yield session_id, ready_document
    _delete_session(session_id)


@pytest.fixture
def processing_session(processing_document):
    """A conversation whose only attached document is still processing."""
    session_id = _session_with_document(processing_document)
    yield session_id
    _delete_session(session_id)


@pytest.fixture
def failed_session(failed_document):
    """A conversation whose only attached document failed to process."""
    session_id = _session_with_document(failed_document)
    yield session_id
    _delete_session(session_id)
