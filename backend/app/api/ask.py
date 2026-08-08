from fastapi import APIRouter, HTTPException
from openai import AuthenticationError, OpenAIError, RateLimitError
from qdrant_client.http.exceptions import ResponseHandlingException, UnexpectedResponse
from sqlalchemy.exc import DataError

from app.schemas.schemas import AskRequest, AskResponse
from app.core.chain import answer_question
from app.db.postgres import SessionLocal
from app.models import ChatSession, Document, Message, SessionDocument


router = APIRouter()

TITLE_MAX_LENGTH = 60


def _title_from_question(question: str) -> str:
    """Collapse a question down to a short, single-line conversation title."""
    cleaned = " ".join(question.split())
    if len(cleaned) <= TITLE_MAX_LENGTH:
        return cleaned
    # Prefer cutting at a word boundary rather than mid-word.
    trimmed = cleaned[:TITLE_MAX_LENGTH].rsplit(" ", 1)[0].rstrip(",;:.- ")
    return f"{trimmed or cleaned[:TITLE_MAX_LENGTH]}…"


@router.post("/ask", response_model=AskResponse)
async def ask(payload: AskRequest):
    """
    Ask a question grounded in the documents attached to this conversation.
    """
    # min_length on the schema still lets " " through, which would bill an LLM call, store a
    # blank turn in the history that every later answer sees, and title the conversation "".
    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=422, detail="Question cannot be blank")

    db = SessionLocal()
    try:
        try:
            session = db.query(ChatSession).filter(ChatSession.id == payload.session_id).first()
        except DataError:
            raise HTTPException(status_code=400, detail="Invalid session_id format")
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        ready_documents = (
            db.query(Document.id, Document.filename)
            .join(SessionDocument, SessionDocument.document_id == Document.id)
            .filter(SessionDocument.session_id == payload.session_id, Document.status == "ready")
            .all()
        )
        if not ready_documents:
            raise HTTPException(
                status_code=400,
                detail="Attach at least one processed PDF before asking questions.",
            )
        document_filenames = {str(doc_id): filename for doc_id, filename in ready_documents}
        ready_document_ids = list(document_filenames.keys())

        prior_messages = (
            db.query(Message)
            .filter(Message.session_id == payload.session_id)
            .order_by(Message.created_at.asc())
            .all()
        )
        chat_history = [{"role": m.role, "content": m.content} for m in prior_messages]

        try:
            result = answer_question(
                question,
                ready_document_ids,
                payload.provider,
                payload.api_key,
                chat_history,
                document_filenames,
                payload.model,
            )
        except (ResponseHandlingException, UnexpectedResponse) as e:
            raise HTTPException(status_code=503, detail="Vector database is unreachable") from e
        except AuthenticationError as e:
            raise HTTPException(
                status_code=401,
                detail=f"That {payload.provider} API key was rejected. Check it and try again.",
            ) from e
        except RateLimitError as e:
            raise HTTPException(
                status_code=429,
                detail=f"{payload.provider} rate-limited that request. Try again shortly.",
            ) from e
        except OpenAIError as e:
            raise HTTPException(
                status_code=502, detail=f"Upstream {payload.provider} API error"
            ) from e

        db.add(Message(session_id=payload.session_id, role="user", content=question))
        db.add(Message(
            session_id=payload.session_id,
            role="assistant",
            content=result["answer"],
            sources=result["sources"],
        ))

        # Name the conversation after the question that started it — filenames repeat across
        # conversations and make the sidebar unreadable.
        if not session.title:
            session.title = _title_from_question(question)

        db.commit()
    finally:
        db.close()

    return {
        "answer": result["answer"],
        "sources": result["sources"],
        "session_id": payload.session_id,
    }
