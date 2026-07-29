"""
Central config. Loads from .env, falls back to sane local defaults.
"""
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

load_dotenv()


class Settings(BaseSettings):
    # OpenAI
    openai_api_key: str = ""

    #chat model
    chat_model: str = "gpt-4o-mini"


    #embeddings model
    embedding_model: str = "text-embedding-3-small"

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
