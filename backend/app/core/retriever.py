from qdrant_client.models import FieldCondition, Filter, MatchValue

from app.config import settings
from app.core.embeddings import embeddings, qdrant  # reuse the clients already created there


def retrieve_chunks(question: str, document_id: str, top_k: int = settings.top_k) -> list[dict]:
    """
    Retrieve the top_k most relevant chunks for a given question and document_id.
    """
    # Embed the question
    query_vector = embeddings.embed_query(question)

    # Create a filter to only retrieve chunks from the specified document_id
    filter_condition = Filter(
        must=[
            FieldCondition(
                key="document_id",
                match=MatchValue(value=document_id),
            )
        ]
    )

    # Perform the search in Qdrant
    search_result = qdrant.search(
        collection_name=settings.qdrant_collection,
        query_vector=query_vector,
        limit=top_k,
        query_filter=filter_condition,
    )

    # Extract the relevant chunk information from the search results
    retrieved_chunks = [
        {
            "chunk_text": point.payload["chunk_text"],
            "page_number": point.payload["page_number"],
            "chunk_index": point.payload["chunk_index"],
            "score": point.score,  # Optional: include the similarity score
        }
        for point in search_result
    ]

    return retrieved_chunks