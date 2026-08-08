from app.db.postgres import SessionLocal
from app.models import ChatSession, Document, SessionDocument


def _make_extra_document():
    db = SessionLocal()
    doc = Document(filename="second.pdf", status="ready", page_count=2)
    db.add(doc)
    db.commit()
    document_id = str(doc.id)
    db.close()
    return document_id


def _delete_extra_document(document_id):
    db = SessionLocal()
    db.query(SessionDocument).filter(SessionDocument.document_id == document_id).delete()
    db.query(Document).filter(Document.id == document_id).delete()
    db.commit()
    db.close()


def _cleanup_session(session_id: str):
    db = SessionLocal()
    db.query(SessionDocument).filter(SessionDocument.session_id == session_id).delete()
    db.query(ChatSession).filter(ChatSession.id == session_id).delete()
    db.commit()
    db.close()


def test_create_session_starts_empty(client):
    response = client.post("/sessions")
    assert response.status_code == 200
    body = response.json()
    assert body["title"] is None
    try:
        detail = client.get(f"/sessions/{body['session_id']}")
        assert detail.status_code == 200
        assert detail.json()["documents"] == []
        assert detail.json()["messages"] == []
    finally:
        _cleanup_session(body["session_id"])


def test_get_session_404_for_unknown_id(client):
    response = client.get("/sessions/11111111-1111-1111-1111-111111111111")
    assert response.status_code == 404


def test_list_sessions_includes_created_session(client, empty_session):
    response = client.get("/sessions")
    assert response.status_code == 200
    ids = [s["id"] for s in response.json()]
    assert empty_session in ids


def test_attach_document_is_idempotent_and_leaves_title_unset(client, empty_session, ready_document):
    response = client.post(f"/sessions/{empty_session}/documents", json={"document_id": ready_document})
    assert response.status_code == 200
    assert response.json()["documents"][0]["id"] == ready_document

    # Attaching must NOT name the conversation — the title comes from the first question.
    detail = client.get(f"/sessions/{empty_session}")
    assert detail.json()["title"] is None

    # Re-attaching the same document is a no-op, not a duplicate row / error.
    again = client.post(f"/sessions/{empty_session}/documents", json={"document_id": ready_document})
    assert again.status_code == 200
    assert len(again.json()["documents"]) == 1


def test_attach_document_404_for_unknown_document(client, empty_session):
    response = client.post(
        f"/sessions/{empty_session}/documents",
        json={"document_id": "11111111-1111-1111-1111-111111111111"},
    )
    assert response.status_code == 404


def test_rename_session(client, empty_session):
    response = client.patch(f"/sessions/{empty_session}", json={"title": "  Chunking   questions  "})
    assert response.status_code == 200
    # Whitespace is collapsed so the sidebar never shows ragged titles.
    assert response.json()["title"] == "Chunking questions"
    assert client.get(f"/sessions/{empty_session}").json()["title"] == "Chunking questions"


def test_rename_session_rejects_blank_and_unknown(client, empty_session):
    assert client.patch(f"/sessions/{empty_session}", json={"title": "   "}).status_code == 422
    assert client.patch(f"/sessions/{empty_session}", json={"title": ""}).status_code == 422
    unknown = client.patch(
        "/sessions/11111111-1111-1111-1111-111111111111", json={"title": "x"}
    )
    assert unknown.status_code == 404


def test_detach_document_stops_it_being_used(client, empty_session, ready_document):
    client.post(f"/sessions/{empty_session}/documents", json={"document_id": ready_document})
    assert len(client.get(f"/sessions/{empty_session}").json()["documents"]) == 1

    response = client.delete(f"/sessions/{empty_session}/documents/{ready_document}")
    assert response.status_code == 204
    assert client.get(f"/sessions/{empty_session}").json()["documents"] == []

    # With nothing attached, asking is refused again rather than answering from a stale doc.
    ask = client.post(
        "/ask",
        json={"session_id": empty_session, "question": "test?", "provider": "openai", "api_key": "test-key"},
    )
    assert ask.status_code == 400

    # Detaching something that isn't attached is a 404, not a silent success.
    assert client.delete(f"/sessions/{empty_session}/documents/{ready_document}").status_code == 404


def test_detach_document_leaves_the_other_documents_attached(client, empty_session, ready_document):
    """Guards against the detach filter being too broad and clearing the whole conversation."""
    other = _make_extra_document()
    try:
        client.post(f"/sessions/{empty_session}/documents", json={"document_id": ready_document})
        client.post(f"/sessions/{empty_session}/documents", json={"document_id": other})
        assert len(client.get(f"/sessions/{empty_session}").json()["documents"]) == 2

        assert client.delete(f"/sessions/{empty_session}/documents/{ready_document}").status_code == 204

        remaining = client.get(f"/sessions/{empty_session}").json()["documents"]
        assert [d["id"] for d in remaining] == [other]
    finally:
        _delete_extra_document(other)


def test_delete_session_removes_it(client):
    session_id = client.post("/sessions").json()["session_id"]
    response = client.delete(f"/sessions/{session_id}")
    assert response.status_code == 204
    assert client.get(f"/sessions/{session_id}").status_code == 404
