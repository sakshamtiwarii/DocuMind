from pydantic import BaseModel

class AskRequest(BaseModel):
    session_id: str
    question: str


class SourceChunk(BaseModel):
    page_number: int
    chunk_text: str
    filename: str | None = None


class AskResponse(BaseModel):
    answer: str
    sources: list[SourceChunk]
    session_id: str

class AttachDocumentRequest(BaseModel):
    document_id: str
