import logging
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile

from app.config import settings
from app.core.chunking import chunk_pages
from app.core.embeddings import store_chunks
from app.core.ingestion import extract_pages
from app.core.limits import limit_uploads
from app.db.postgres import SessionLocal
from app.models import Document


logger = logging.getLogger(__name__)

CHUNK_BYTES = 1024 * 1024

router = APIRouter()

@router.post("/documents", dependencies=[Depends(limit_uploads)])
async def upload_document(file: UploadFile, background_tasks: BackgroundTasks):
    """
    Upload a document, extract its pages, chunk them, and store the chunks in Qdrant.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    document_id = str(uuid.uuid4())
    max_bytes = settings.max_upload_mb * 1024 * 1024

    # Temp path outlives this request — the background task reads it after we return.
    # Copy in chunks rather than shutil.copyfileobj so an oversized upload is rejected while
    # streaming instead of after an unbounded write to disk.
    temp_file_path = Path(tempfile.gettempdir()) / f"{document_id}.pdf"
    written = 0
    try:
        with open(temp_file_path, "wb") as f:
            while data := await file.read(CHUNK_BYTES):
                written += len(data)
                if written > max_bytes:
                    raise HTTPException(
                        status_code=413,
                        detail=f"That PDF is larger than the {settings.max_upload_mb} MB limit.",
                    )
                f.write(data)
    except Exception:
        temp_file_path.unlink(missing_ok=True)
        raise

    if written == 0:
        temp_file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="That file is empty")

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

        # Ingestion runs in a BackgroundTask, so a process that dies mid-run (a free host
        # going to sleep, a deploy, an OOM) leaves the row stuck on "processing" with nothing
        # left to finish it. Time it out so the client stops polling and the user can remove
        # or re-upload it.
        if document.status == "processing" and _is_stale(document):
            logger.warning("Document %s stuck in processing; marking failed", document_id)
            document.status = "failed"
            db.commit()

        return {
            "document_id": str(document.id),
            "filename": document.filename,
            "status": document.status,
            "page_count": document.page_count,
        }
    finally:
        db.close()


def _is_stale(document: Document) -> bool:
    if not document.uploaded_at:
        return False
    uploaded_at = document.uploaded_at
    if uploaded_at.tzinfo is None:
        uploaded_at = uploaded_at.replace(tzinfo=timezone.utc)
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=settings.processing_timeout_minutes)
    return uploaded_at < cutoff


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

