from fastapi import APIRouter, HTTPException
from sqlalchemy import func
from sqlalchemy.exc import DataError

from app.db.postgres import SessionLocal
from app.models import ChatSession, Document, Message, SessionDocument
from app.schemas.schemas import AttachDocumentRequest

router = APIRouter()


def _document_summaries(db, session_id):
    rows = (
        db.query(Document)
        .join(SessionDocument, SessionDocument.document_id == Document.id)
        .filter(SessionDocument.session_id == session_id)
        .order_by(SessionDocument.added_at.asc())
        .all()
    )
    return [
        {
            "id": str(d.id),
            "filename": d.filename,
            "status": d.status,
            "page_count": d.page_count,
        }
        for d in rows
    ]


@router.post("/sessions")
async def create_session():
    """
    Start a new, empty conversation. Documents are attached afterwards via
    POST /sessions/{id}/documents.
    """
    db = SessionLocal()
    try:
        new_session = ChatSession()
        db.add(new_session)
        db.commit()
        db.refresh(new_session)
        return {"session_id": str(new_session.id), "title": new_session.title}
    finally:
        db.close()


@router.get("/sessions")
async def list_sessions():
    """
    List all conversations for the sidebar, most recently active first.
    """
    db = SessionLocal()
    try:
        last_message_at = (
            db.query(Message.session_id, func.max(Message.created_at).label("last_at"))
            .group_by(Message.session_id)
            .subquery()
        )
        rows = (
            db.query(ChatSession, last_message_at.c.last_at)
            .outerjoin(last_message_at, last_message_at.c.session_id == ChatSession.id)
            .all()
        )

        results = []
        for session, last_at in rows:
            activity = last_at or session.created_at
            results.append(
                {
                    "id": str(session.id),
                    "title": session.title or "New chat",
                    "created_at": session.created_at.isoformat(),
                    "updated_at": activity.isoformat(),
                    "documents": _document_summaries(db, session.id),
                }
            )

        results.sort(key=lambda r: r["updated_at"], reverse=True)
        return results
    finally:
        db.close()


@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    """
    Full detail for one conversation: title, attached documents, and full message history.
    """
    db = SessionLocal()
    try:
        try:
            session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
        except DataError:
            raise HTTPException(status_code=400, detail="Invalid session_id format")
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        messages = (
            db.query(Message)
            .filter(Message.session_id == session_id)
            .order_by(Message.created_at.asc())
            .all()
        )

        return {
            "id": str(session.id),
            "title": session.title or "New chat",
            "created_at": session.created_at.isoformat(),
            "documents": _document_summaries(db, session.id),
            "messages": [
                {
                    "role": m.role,
                    "content": m.content,
                    "sources": m.sources,
                    "created_at": m.created_at.isoformat(),
                }
                for m in messages
            ],
        }
    finally:
        db.close()


@router.post("/sessions/{session_id}/documents")
async def attach_document(session_id: str, payload: AttachDocumentRequest):
    """
    Attach a document to a conversation, growing the context it can draw on. Idempotent —
    attaching the same document twice is a no-op. Attaching does not name the conversation:
    the title comes from the first question asked (see /ask), since several conversations
    can share one PDF and filenames make for an unreadable list.
    """
    db = SessionLocal()
    try:
        try:
            session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
        except DataError:
            raise HTTPException(status_code=400, detail="Invalid session_id format")
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        try:
            document = db.query(Document).filter(Document.id == payload.document_id).first()
        except DataError:
            raise HTTPException(status_code=400, detail="Invalid document_id format")
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

        already_attached = (
            db.query(SessionDocument)
            .filter(
                SessionDocument.session_id == session_id,
                SessionDocument.document_id == payload.document_id,
            )
            .first()
        )
        if not already_attached:
            db.add(SessionDocument(session_id=session_id, document_id=payload.document_id))
            db.commit()

        return {"documents": _document_summaries(db, session_id)}
    finally:
        db.close()


@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session(session_id: str):
    """
    Delete a conversation and everything tied to it (messages, document attachments).
    The underlying documents themselves are left intact — they may be attached elsewhere.
    """
    db = SessionLocal()
    try:
        try:
            session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
        except DataError:
            raise HTTPException(status_code=400, detail="Invalid session_id format")
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        db.query(Message).filter(Message.session_id == session_id).delete()
        db.query(SessionDocument).filter(SessionDocument.session_id == session_id).delete()
        db.delete(session)
        db.commit()
    finally:
        db.close()
