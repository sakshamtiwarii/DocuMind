import uuid

from langchain_openai import OpenAIEmbeddings
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams

from app.config import settings


embeddings = OpenAIEmbeddings(model=settings.embedding_model, openai_api_key=settings.openai_api_key)
qdrant = QdrantClient(url=settings.qdrant_url)


def store_chunks(document_id: str, chunks: list[dict]) -> None:
    """
    Store the chunks in Qdrant.
    """
    # Create the collection if it doesn't exist
    if not qdrant.collection_exists(settings.qdrant_collection):
        qdrant.create_collection(
            collection_name=settings.qdrant_collection,
            vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
        )

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

