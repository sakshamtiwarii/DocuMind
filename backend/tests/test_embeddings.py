"""
Guards the collection-creation path in app/core/embeddings.py. Qdrant itself is mocked — the
point is the check-then-act logic, not the server.
"""
import pytest
from qdrant_client.http.exceptions import UnexpectedResponse

from app.core import embeddings


def _conflict():
    return UnexpectedResponse(
        status_code=409, reason_phrase="Conflict", content=b"already exists", headers=None
    )


def test_ensure_collection_creates_when_missing(mocker):
    exists = mocker.patch.object(embeddings.qdrant, "collection_exists", return_value=False)
    create = mocker.patch.object(embeddings.qdrant, "create_collection")

    embeddings.ensure_collection()

    create.assert_called_once()
    assert exists.called


def test_ensure_collection_skips_when_present(mocker):
    mocker.patch.object(embeddings.qdrant, "collection_exists", return_value=True)
    create = mocker.patch.object(embeddings.qdrant, "create_collection")

    embeddings.ensure_collection()

    create.assert_not_called()


def test_ensure_collection_tolerates_a_concurrent_creator(mocker):
    """Uploading several PDFs at once against an empty collection used to have every task but
    one fail with a 409, which surfaced as documents that "couldn't be read"."""
    # Missing on the first check, present by the time we handle the conflict.
    mocker.patch.object(embeddings.qdrant, "collection_exists", side_effect=[False, True])
    mocker.patch.object(embeddings.qdrant, "create_collection", side_effect=_conflict())

    embeddings.ensure_collection()  # must not raise


def test_ensure_collection_reraises_when_creation_genuinely_failed(mocker):
    """A 409 with the collection still absent is a real failure, not a lost race."""
    mocker.patch.object(embeddings.qdrant, "collection_exists", side_effect=[False, False])
    mocker.patch.object(embeddings.qdrant, "create_collection", side_effect=_conflict())

    with pytest.raises(UnexpectedResponse):
        embeddings.ensure_collection()
