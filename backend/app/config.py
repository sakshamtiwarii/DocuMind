"""
Central config. Loads from .env, falls back to sane local defaults.
Anything that differs between local dev and production is an env var — nothing about the
deployment target is hardcoded in the app.
"""
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

load_dotenv()


class Settings(BaseSettings):
    # "development" | "production". Controls how much detail /health exposes.
    environment: str = "development"

    # Chat model key + provider are supplied per-request by the user (see AskRequest) —
    # this app never holds a server-side LLM key.

    # Embeddings model (local, via fastembed — no API key required)
    embedding_model: str = "BAAI/bge-small-en-v1.5"

    # Qdrant. api_key is required by Qdrant Cloud and unused by a local container.
    qdrant_url: str = "http://localhost:6333"
    qdrant_collection: str = "documents"
    qdrant_api_key: str | None = None

    # Postgres (documents, sessions, chat history)
    database_url: str = "postgresql://postgres:postgres@localhost:5432/ragdb"

    # Browser origins allowed to call this API, comma-separated. The Vite and CRA dev servers
    # are the local defaults; production sets this to the deployed frontend's origin.
    cors_origins: str = "http://localhost:5173,http://localhost:3000"
    # Optional regex for ephemeral origins — Vercel gives every preview deploy its own domain.
    cors_origin_regex: str | None = None

    # Uploads
    max_upload_mb: int = 10

    # Per-IP rate limits (requests per window) for the two endpoints that cost real resources.
    rate_limit_window_seconds: int = 60
    upload_rate_limit: int = 10
    ask_rate_limit: int = 30

    # A document still "processing" after this long is assumed dead — the worker was almost
    # certainly killed mid-ingestion (free hosts sleep), and it would otherwise hang forever.
    processing_timeout_minutes: int = 10

    # Chunking
    chunk_size: int = 1000
    chunk_overlap: int = 200

    # Retrieval
    top_k: int = 4

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    class Config:
        env_file = ".env"
        # Ignore unrecognised keys instead of raising. Hosting platforms inject their own
        # variables and old keys linger in .env files; neither should crash-loop the service
        # at import time over config it doesn't even use.
        extra = "ignore"


settings = Settings()
