from pydantic import BaseModel

class AskRequest(BaseModel):
    document_id: str
    session_id: str
    question: str
    chat_history: list[dict] | None = None


class SourceChunk(BaseModel):
    page_number: int
    chunk_text: str


class AskResponse(BaseModel):
    answer: str
    sources: list[SourceChunk]
    session_id: str

class CreateSessionRequest(BaseModel):
    document_id: str