import io

from app.db.postgres import SessionLocal
from app.models import Document


def test_upload_rejects_non_pdf(client):
    response = client.post("/documents", files={"file": ("notes.txt", b"hello", "text/plain")})
    assert response.status_code == 400


def test_upload_accepts_pdf_and_creates_processing_document(client, mocker):
    mocker.patch("app.api.documents.process_document")  # avoid real OpenAI/Qdrant calls

    response = client.post(
        "/documents",
        files={"file": ("test.pdf", io.BytesIO(b"%PDF-1.4 fake content"), "application/pdf")},
    )
    document_id = response.json().get("document_id")
    try:
        assert response.status_code == 200
        assert response.json()["status"] == "processing"

        db = SessionLocal()
        doc = db.query(Document).filter(Document.id == document_id).first()
        db.close()
        assert doc is not None
        assert doc.status == "processing"
    finally:
        if document_id:
            db = SessionLocal()
            db.query(Document).filter(Document.id == document_id).delete()
            db.commit()
            db.close()


def test_get_document_status_not_found(client):
    response = client.get("/documents/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404


def test_get_document_status_found(client, ready_document):
    response = client.get(f"/documents/{ready_document}")
    assert response.status_code == 200
    assert response.json()["status"] == "ready"
