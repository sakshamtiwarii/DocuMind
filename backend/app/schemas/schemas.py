from pydantic import BaseModel, Field

class AskRequest(BaseModel):
    session_id: str
    question: str = Field(min_length=1, max_length=4000)


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


class RenameSessionRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120)
