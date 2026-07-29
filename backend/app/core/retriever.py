from qdrant_client.models import FieldCondition, Filter, MatchAny

from app.config import settings
from app.core.embeddings import embeddings, qdrant  # reuse the clients already created there


def retrieve_chunks(question: str, document_ids: list[str], top_k: int = settings.top_k) -> list[dict]:
    """
    Retrieve the top_k most relevant chunks for a given question, scoped to a set of
    document_ids (a conversation can have more than one document attached).
    """
    if not document_ids:
        return []

    # Embed the question
    query_vector = embeddings.embed_query(question)

    # Create a filter to only retrieve chunks from one of the specified document_ids
    filter_condition = Filter(
        must=[
            FieldCondition(
                key="document_id",
                match=MatchAny(any=document_ids),
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
            "document_id": point.payload["document_id"],
            "score": point.score,  # Optional: include the similarity score
        }
        for point in search_result
    ]

    return retrieved_chunks