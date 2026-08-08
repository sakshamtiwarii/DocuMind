"""
Central config. Loads from .env, falls back to sane local defaults.
"""
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

load_dotenv()


class Settings(BaseSettings):
    # Chat model key + provider are supplied per-request by the user (see AskRequest) —
    # this app never holds a server-side LLM key.

    # Embeddings model (local, via fastembed — no API key required)
    embedding_model: str = "BAAI/bge-small-en-v1.5"

    # Qdrant
    qdrant_url: str = "http://localhost:6333"
    qdrant_collection: str = "documents"

    # Postgres (documents, sessions, chat history)
    database_url: str = "postgresql://postgres:postgres@localhost:5432/ragdb"

    # Redis (used later for caching / job status)
    redis_url: str = "redis://localhost:6379"

    # Chunking
    chunk_size: int = 1000
    chunk_overlap: int = 200

    # Retrieval
    top_k: int = 4

    class Config:
        env_file = ".env"


settings = Settings()
