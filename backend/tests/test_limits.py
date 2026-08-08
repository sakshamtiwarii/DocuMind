"""
Covers the guards that only matter once the API is public: upload size, rate limiting, and
the stuck-"processing" timeout.
"""
import io
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from app.config import settings
from app.core.limits import RateLimiter
from app.db.postgres import SessionLocal
from app.models import Document


class _FakeRequest:
    """Enough of a Request for the limiter: headers + client address."""

    def __init__(self, ip="1.2.3.4", forwarded=None):
        self.headers = {"x-forwarded-for": forwarded} if forwarded else {}
        self.client = type("C", (), {"host": ip})()


def test_rate_limiter_allows_up_to_the_limit_then_429s():
    limiter = RateLimiter(max_requests=3, window_seconds=60)
    request = _FakeRequest()

    for _ in range(3):
        limiter.check(request)

    with pytest.raises(HTTPException) as exc:
        limiter.check(request)
    assert exc.value.status_code == 429
    assert "Retry-After" in exc.value.headers


def test_rate_limiter_is_per_client():
    limiter = RateLimiter(max_requests=1, window_seconds=60)
    limiter.check(_FakeRequest(ip="10.0.0.1"))
    limiter.check(_FakeRequest(ip="10.0.0.2"))  # different caller, own budget

    with pytest.raises(HTTPException):
        limiter.check(_FakeRequest(ip="10.0.0.1"))


def test_rate_limiter_uses_forwarded_ip_behind_a_proxy():
    """Render terminates TLS at a proxy, so request.client.host is the proxy for everyone —
    keying on it would rate-limit all users as if they were one."""
    limiter = RateLimiter(max_requests=1, window_seconds=60)
    proxy_ip = "172.16.0.1"

    limiter.check(_FakeRequest(ip=proxy_ip, forwarded="203.0.113.7"))
    limiter.check(_FakeRequest(ip=proxy_ip, forwarded="203.0.113.8"))

    with pytest.raises(HTTPException):
        limiter.check(_FakeRequest(ip=proxy_ip, forwarded="203.0.113.7"))


def test_upload_rejects_a_file_over_the_size_limit(client, mocker):
    mocker.patch("app.api.documents.process_document")
    oversized = b"%PDF-1.4" + b"x" * (settings.max_upload_mb * 1024 * 1024 + 1024)

    response = client.post(
        "/documents",
        files={"file": ("big.pdf", io.BytesIO(oversized), "application/pdf")},
    )

    assert response.status_code == 413
    assert str(settings.max_upload_mb) in response.json()["detail"]


def test_upload_rejects_an_empty_file(client, mocker):
    mocker.patch("app.api.documents.process_document")
    response = client.post(
        "/documents", files={"file": ("empty.pdf", io.BytesIO(b""), "application/pdf")}
    )
    assert response.status_code == 400


def test_document_stuck_in_processing_is_reported_failed(client):
    """A worker killed mid-ingestion (host sleeping, deploy, OOM) would otherwise leave the
    document polling forever with no way out."""
    db = SessionLocal()
    doc = Document(
        filename="stuck.pdf",
        status="processing",
        uploaded_at=datetime.now(timezone.utc)
        - timedelta(minutes=settings.processing_timeout_minutes + 5),
    )
    db.add(doc)
    db.commit()
    document_id = str(doc.id)
    db.close()

    try:
        response = client.get(f"/documents/{document_id}")
        assert response.status_code == 200
        assert response.json()["status"] == "failed"

        # Persisted, not just massaged in the response.
        db = SessionLocal()
        stored = db.query(Document).filter(Document.id == document_id).first().status
        db.close()
        assert stored == "failed"
    finally:
        db = SessionLocal()
        db.query(Document).filter(Document.id == document_id).delete()
        db.commit()
        db.close()


def test_recent_processing_document_is_left_alone(client):
    db = SessionLocal()
    doc = Document(filename="fresh.pdf", status="processing", uploaded_at=datetime.now(timezone.utc))
    db.add(doc)
    db.commit()
    document_id = str(doc.id)
    db.close()

    try:
        assert client.get(f"/documents/{document_id}").json()["status"] == "processing"
    finally:
        db = SessionLocal()
        db.query(Document).filter(Document.id == document_id).delete()
        db.commit()
        db.close()
