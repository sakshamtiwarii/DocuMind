from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from qdrant_client import QdrantClient
from sqlalchemy import text

from app.api import ask, documents, sessions
from app.config import settings
from app.db.postgres import Base, engine
from app.models import ChatSession, Document, Message, SessionDocument  # noqa: F401 — registers models on Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="RAG Document Q&A System", version="0.1.0", lifespan=lifespan)

# Dev origins for the React frontend (Vite defaults to 5173, CRA to 3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents.router, tags=["documents"])
app.include_router(ask.router, tags=["qa"])
app.include_router(sessions.router, tags=["sessions"])


@app.get("/health")
def health_check():
    """
    Confirms the API is up AND can reach Qdrant + Postgres.
    This is step 1 — nothing about RAG yet, just proving the plumbing works.
    """
    qdrant_status = "unreachable"
    try:
        client = QdrantClient(url=settings.qdrant_url)
        client.get_collections()
        qdrant_status = "connected"
    except Exception as e:
        qdrant_status = f"error: {e}"

    postgres_status = "unreachable"
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        postgres_status = "connected"
    except Exception as e:
        postgres_status = f"error: {e}"

    return {
        "status": "ok",
        "qdrant": qdrant_status,
        "postgres": postgres_status,
    }


@app.get("/")
def root():
    return {"message": "RAG Document Q&A System — see /docs for API"}
