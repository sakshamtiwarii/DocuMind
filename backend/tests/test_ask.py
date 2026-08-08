from app.api.ask import _title_from_question
from app.db.postgres import SessionLocal
from app.models import ChatSession, Message

# Every /ask call now requires a provider + user-supplied key.
AUTH = {"provider": "openai", "api_key": "test-key"}


def test_title_from_question_keeps_short_questions_intact():
    assert _title_from_question("  What is  this document about? ") == "What is this document about?"


def test_title_from_question_truncates_on_a_word_boundary():
    long_question = "What does the guide say about chunk size and overlap and why does it matter"
    title = _title_from_question(long_question)

    assert title.endswith("…")
    assert len(title) <= 61
    # The kept text must be a whole-word prefix of the original — no chopped-off words.
    kept = title.rstrip("…")
    assert long_question.startswith(kept)
    assert long_question[len(kept)] == " "


def test_ask_requires_question_field(client, ready_session):
    session_id, _ = ready_session
    response = client.post("/ask", json={"session_id": session_id, **AUTH})
    assert response.status_code == 422


def test_ask_rejects_blank_questions(client, ready_session, mocker):
    """A whitespace-only question would otherwise bill an LLM call, store an empty turn that
    every later answer sees, and title the conversation ""."""
    session_id, _ = ready_session
    answer = mocker.patch("app.api.ask.answer_question")

    for blank in ["", "   ", "\n\t "]:
        response = client.post("/ask", json={"session_id": session_id, "question": blank, **AUTH})
        assert response.status_code == 422, blank

    answer.assert_not_called()

    db = SessionLocal()
    persisted = db.query(Message).filter(Message.session_id == session_id).count()
    db.close()
    assert persisted == 0


def test_ask_strips_surrounding_whitespace_from_the_question(client, ready_session, mocker):
    session_id, _ = ready_session
    mocker.patch("app.api.ask.answer_question", return_value={"answer": "a", "sources": []})
    try:
        client.post("/ask", json={"session_id": session_id, "question": "  What is chunking?  ", **AUTH})

        db = SessionLocal()
        stored = (
            db.query(Message)
            .filter(Message.session_id == session_id, Message.role == "user")
            .first()
        )
        session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
        content, title = stored.content, session.title
        db.close()

        assert content == "What is chunking?"
        assert title == "What is chunking?"
    finally:
        db = SessionLocal()
        db.query(Message).filter(Message.session_id == session_id).delete()
        db.commit()
        db.close()


def test_ask_returns_404_for_unknown_session(client):
    response = client.post("/ask", json={
        "session_id": "11111111-1111-1111-1111-111111111111",
        "question": "test?",
        **AUTH,
    })
    assert response.status_code == 404


def test_ask_returns_400_when_no_documents_attached(client, empty_session):
    response = client.post("/ask", json={
        "session_id": empty_session,
        "question": "test?",
        **AUTH,
    })
    assert response.status_code == 400


def test_ask_returns_400_when_only_processing_document_attached(client, processing_session):
    response = client.post("/ask", json={
        "session_id": processing_session,
        "question": "test?",
        **AUTH,
    })
    assert response.status_code == 400


def test_ask_returns_400_when_only_failed_document_attached(client, failed_session):
    response = client.post("/ask", json={
        "session_id": failed_session,
        "question": "test?",
        **AUTH,
    })
    assert response.status_code == 400


def test_ask_names_an_untitled_conversation_after_the_first_question(client, ready_session, mocker):
    session_id, _ = ready_session
    mocker.patch("app.api.ask.answer_question", return_value={"answer": "a", "sources": []})

    try:
        client.post("/ask", json={"session_id": session_id, "question": "What is chunk overlap?", **AUTH})

        db = SessionLocal()
        session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
        first_title = session.title
        db.close()
        assert first_title == "What is chunk overlap?"

        # A later question must not rename an already-titled conversation.
        client.post("/ask", json={"session_id": session_id, "question": "And the chunk size?", **AUTH})
        db = SessionLocal()
        session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
        second_title = session.title
        db.close()
        assert second_title == first_title
    finally:
        db = SessionLocal()
        db.query(Message).filter(Message.session_id == session_id).delete()
        db.commit()
        db.close()


def test_ask_returns_sources_and_persists_messages(client, ready_session, mocker):
    session_id, _ = ready_session
    mocker.patch("app.api.ask.answer_question", return_value={
        "answer": "test answer",
        "sources": [{"page_number": 1, "chunk_text": "some chunk", "filename": "test.pdf"}],
    })

    response = client.post("/ask", json={
        "session_id": session_id,
        "question": "test?",
        **AUTH,
    })
    try:
        assert response.status_code == 200
        body = response.json()
        assert body["answer"] == "test answer"
        assert body["sources"] == [{"page_number": 1, "chunk_text": "some chunk", "filename": "test.pdf"}]
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
