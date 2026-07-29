import uuid

from langchain_openai import OpenAIEmbeddings
from qdrant_client import QdrantClient
from qdrant_client.http.exceptions import UnexpectedResponse
from qdrant_client.models import Distance, PointStruct, VectorParams

from app.config import settings


embeddings = OpenAIEmbeddings(model=settings.embedding_model, openai_api_key=settings.openai_api_key)
qdrant = QdrantClient(url=settings.qdrant_url)


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
            vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
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

