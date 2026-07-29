from app.db.postgres import SessionLocal
from app.models import Message


def test_ask_requires_question_field(client, ready_session):
    session_id, document_id = ready_session
    response = client.post("/ask", json={"document_id": document_id, "session_id": session_id})
    assert response.status_code == 422


def test_ask_returns_404_for_unknown_document(client):
    response = client.post("/ask", json={
        "document_id": "00000000-0000-0000-0000-000000000000",
        "session_id": "11111111-1111-1111-1111-111111111111",
        "question": "test?",
    })
    assert response.status_code == 404


def test_ask_returns_404_for_unknown_session(client, ready_document):
    response = client.post("/ask", json={
        "document_id": ready_document,
        "session_id": "11111111-1111-1111-1111-111111111111",
        "question": "test?",
    })
    assert response.status_code == 404


def test_ask_returns_409_while_processing(client, processing_document):
    response = client.post("/ask", json={
        "document_id": processing_document,
        "session_id": "11111111-1111-1111-1111-111111111111",
        "question": "test?",
    })
    assert response.status_code == 409


def test_ask_returns_422_for_failed_document(client, failed_document):
    response = client.post("/ask", json={
        "document_id": failed_document,
        "session_id": "11111111-1111-1111-1111-111111111111",
        "question": "test?",
    })
    assert response.status_code == 422


def test_ask_returns_sources_and_persists_messages(client, ready_session, mocker):
    session_id, document_id = ready_session
    mocker.patch("app.api.ask.answer_question", return_value={
        "answer": "test answer",
        "sources": [{"page_number": 1, "chunk_text": "some chunk"}],
    })

    response = client.post("/ask", json={
        "document_id": document_id,
        "session_id": session_id,
        "question": "test?",
    })
    try:
        assert response.status_code == 200
        body = response.json()
        assert body["answer"] == "test answer"
        assert body["sources"] == [{"page_number": 1, "chunk_text": "some chunk"}]
        assert body["session_id"] == session_id

        db = SessionLocal()
        messages = db.query(Message).filter(Message.session_id == session_id).all()
        db.close()
        assert len(messages) == 2
        assert {m.role for m in messages} == {"user", "assistant"}
    finally:
        db = SessionLocal()
        db.query(Message).filter(Message.session_id == session_id).delete()
        db.commit()
        db.close()
