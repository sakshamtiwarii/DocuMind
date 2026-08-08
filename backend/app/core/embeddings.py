import uuid

from fastembed import TextEmbedding
from qdrant_client import QdrantClient
from qdrant_client.http.exceptions import UnexpectedResponse
from qdrant_client.models import Distance, PointStruct, VectorParams

from app.config import settings


# Embeddings run locally (no API key, no per-request cost) so that the only key a user ever
# has to provide is the one for the chat model — see app/core/chain.py. The chosen model's
# vector size (384) is baked into the collection config below.
#
# langchain_community.embeddings.FastEmbedEmbeddings wraps the same fastembed model but never
# actually populates its `_model` private attribute under this pydantic version (its pre_init
# validator sets values["_model"], which pydantic v2 silently drops for underscore-prefixed
# fields) — every call raises AttributeError: 'NoneType' object has no attribute 'embed'. Using
# fastembed directly sidesteps that.
EMBEDDING_VECTOR_SIZE = 384


class LocalEmbeddings:
    def __init__(self, model_name: str):
        self._model = TextEmbedding(model_name=model_name)

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [vector.tolist() for vector in self._model.embed(texts)]

    def embed_query(self, text: str) -> list[float]:
        return next(iter(self._model.embed([text]))).tolist()


embeddings = LocalEmbeddings(settings.embedding_model)

# api_key is required by Qdrant Cloud and ignored by a local container, so the same call
# covers both. This is the app's single Qdrant client — importing it elsewhere (including
# /health) avoids opening a second connection pool per process.
qdrant = QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key)


def ensure_collection() -> None:
    """
    Create the collection if it isn't there yet, tolerating a concurrent creator.

    `collection_exists()` then `create_collection()` is a check-then-act race: uploading
    several PDFs at once against an empty collection has every background task see "missing"
    and all but one then fail with a 409, which `process_document` would record as a document
    that simply couldn't be read. Treat "someone else created it" as success.
    """
    if qdrant.collection_exists(settings.qdrant_collection):
        return

    try:
        qdrant.create_collection(
            collection_name=settings.qdrant_collection,
            vectors_config=VectorParams(size=EMBEDDING_VECTOR_SIZE, distance=Distance.COSINE),
        )
    except (UnexpectedResponse, ValueError):
        # Lost the race — fine, as long as the collection is actually there now.
        if not qdrant.collection_exists(settings.qdrant_collection):
            raise


def store_chunks(document_id: str, chunks: list[dict]) -> None:
    """
    Store the chunks in Qdrant.
    """
    ensure_collection()

    # Embed all chunk texts in a single batch call
    texts = [chunk["chunk_text"] for chunk in chunks]
    vectors = embeddings.embed_documents(texts)

    # Prepare points to be inserted
    points = [
        PointStruct(
            id=str(uuid.uuid4()),
            vector=vectors[i],
            payload={
                "document_id": document_id,
                "page_number": chunks[i]["page_number"],
                "chunk_index": chunks[i]["chunk_index"],
                "chunk_text": chunks[i]["chunk_text"],
            },
        )
        for i in range(len(chunks))
    ]

    # Insert points into Qdrant
    qdrant.upsert(
        collection_name=settings.qdrant_collection,
        points=points,
    )

