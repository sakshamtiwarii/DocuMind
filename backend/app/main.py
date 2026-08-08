from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api import ask, documents, sessions
from app.config import settings
from app.core.embeddings import qdrant  # the app's single Qdrant client
from app.db.postgres import Base, engine
from app.models import ChatSession, Document, Message, SessionDocument  # noqa: F401 — registers models on Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="RAG Document Q&A System", version="0.1.0", lifespan=lifespan)

# Allowed browser origins come from config: localhost in dev, the deployed frontend in
# production. cors_origin_regex covers hosts that can't be enumerated up front, such as
# Vercel's per-deploy preview domains.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=settings.cors_origin_regex,
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
    Confirms the API is up AND can reach Qdrant + Postgres. Used as Render's health check.

    This endpoint is public, so in production it reports only connected/unreachable —
    exception text from a failed connection can carry the host, database name and user from
    the DSN. Full detail is kept for local debugging.
    """

    def probe(check) -> str:
        try:
            check()
            return "connected"
        except Exception as e:
            return "unreachable" if settings.is_production else f"error: {e}"

    def check_qdrant():
        qdrant.get_collections()

    def check_postgres():
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))

    qdrant_status = probe(check_qdrant)
    postgres_status = probe(check_postgres)
    healthy = qdrant_status == "connected" and postgres_status == "connected"

    return {
        "status": "ok" if healthy else "degraded",
        "qdrant": qdrant_status,
        "postgres": postgres_status,
    }


@app.get("/")
def root():
    return {"message": "RAG Document Q&A System — see /docs for API"}
