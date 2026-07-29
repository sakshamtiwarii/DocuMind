from fastapi import APIRouter, HTTPException
from openai import OpenAIError
from qdrant_client.http.exceptions import ResponseHandlingException, UnexpectedResponse
from sqlalchemy.exc import DataError

from app.schemas.schemas import AskRequest, AskResponse
from app.core.chain import answer_question
from app.db.postgres import SessionLocal
from app.models import ChatSession, Document, Message


router = APIRouter()

@router.post("/ask", response_model=AskResponse)
async def ask(payload: AskRequest):
    """
    Ask a question based on the context of a specific document.
    """
    db = SessionLocal()
    try:
        try:
            document = db.query(Document).filter(Document.id == payload.document_id).first()
        except DataError:
            raise HTTPException(status_code=400, detail="Invalid document_id format")

        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        if document.status == "processing":
            raise HTTPException(status_code=409, detail="Document is still processing")
        if document.status == "failed":
            raise HTTPException(status_code=422, detail="Document processing failed; please re-upload")

        try:
            session = db.query(ChatSession).filter(ChatSession.id == payload.session_id).first()
        except DataError:
            raise HTTPException(status_code=400, detail="Invalid session_id format")
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        prior_messages = (
            db.query(Message)
            .filter(Message.session_id == payload.session_id)
            .order_by(Message.created_at.asc())
            .all()
        )
        chat_history = [{"role": m.role, "content": m.content} for m in prior_messages]

        try:
            result = answer_question(payload.question, payload.document_id, chat_history)
        except (ResponseHandlingException, UnexpectedResponse) as e:
            raise HTTPException(status_code=503, detail="Vector database is unreachable") from e
        except OpenAIError as e:
            raise HTTPException(status_code=502, detail="Upstream OpenAI API error") from e

        db.add(Message(session_id=payload.session_id, role="user", content=payload.question))
        db.add(Message(
            session_id=payload.session_id,
            role="assistant",
            content=result["answer"],
            sources=result["sources"],
        ))
        db.commit()
    finally:
        db.close()

    return {
        "answer": result["answer"],
        "sources": result["sources"],
        "session_id": payload.session_id,
    }
