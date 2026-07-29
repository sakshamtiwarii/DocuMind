from fastapi import APIRouter, HTTPException
from app.db.postgres import SessionLocal
from app.models import ChatSession, Message
from app.schemas.schemas import CreateSessionRequest

router = APIRouter()

@router.post("/sessions")
async def create_session(payload: CreateSessionRequest):
    """
    Create a new chat session.
    """
    db = SessionLocal()
    try:
        new_session = ChatSession(document_id=payload.document_id)
        db.add(new_session)
        db.commit()
        db.refresh(new_session)
        return {"session_id": str(new_session.id), "document_id": str(new_session.document_id)}
    finally:
        db.close()


@router.get("/sessions/{session_id}/messages")
async def get_session_messages(session_id: str):
    """
    Retrieve the full chat history for a session, oldest first.
    """
    db = SessionLocal()
    try:
        session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        messages = (
            db.query(Message)
            .filter(Message.session_id == session_id)
            .order_by(Message.created_at.asc())
            .all()
        )
        return [
            {
                "role": m.role,
                "content": m.content,
                "sources": m.sources,
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ]
    finally:
        db.close()
