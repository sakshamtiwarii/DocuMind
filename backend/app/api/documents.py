import logging
import shutil
import tempfile
from pathlib import Path
import uuid

from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile

from app.core.chunking import chunk_pages
from app.core.embeddings import store_chunks
from app.core.ingestion import extract_pages
from app.db.postgres import SessionLocal
from app.models import Document


logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/documents")
async def upload_document(file: UploadFile, background_tasks: BackgroundTasks):
    """
    Upload a document, extract its pages, chunk them, and store the chunks in Qdrant.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    document_id = str(uuid.uuid4())

    # Temp path outlives this request — the background task reads it after we return
    temp_file_path = Path(tempfile.gettempdir()) / f"{document_id}.pdf"
    with open(temp_file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Store the document metadata in Postgres
    db = SessionLocal()
    try:
        new_document = Document(id=document_id, filename=file.filename)
        db.add(new_document)
        db.commit()
        db.refresh(new_document)
    finally:
        db.close()

    # Process the document in the background
    background_tasks.add_task(process_document, document_id, str(temp_file_path))

    return {"document_id": document_id, "status": "processing"}


@router.get("/documents/{document_id}")
async def get_document_status(document_id: str):
    """
    Check ingestion status for a previously uploaded document.
    """
    db = SessionLocal()
    try:
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        return {
            "document_id": str(document.id),
            "filename": document.filename,
            "status": document.status,
            "page_count": document.page_count,
        }
    finally:
        db.close()


def process_document(document_id: str, file_path: str):
    """
    Extract pages from the document, chunk them, and store the chunks in Qdrant.
    """
    db = SessionLocal()
    try:
        pages = extract_pages(file_path)
        if not pages:
            raise ValueError("No extractable text found in this PDF (likely scanned/image-only)")

        chunks = chunk_pages(pages)
        store_chunks(document_id, chunks)

        document = db.query(Document).filter(Document.id == document_id).first()
        document.status = "ready"
        document.page_count = len(pages)
        db.commit()
    except Exception:
        # BackgroundTasks swallows exceptions, so without this the only trace of a failed
        # ingestion is a document stuck at "failed" with no way to tell why.
        logger.exception("Ingestion failed for document %s", document_id)
        db.rollback()
        document = db.query(Document).filter(Document.id == document_id).first()
        if document:
            document.status = "failed"
            db.commit()
    finally:
        db.close()
        Path(file_path).unlink(missing_ok=True)

