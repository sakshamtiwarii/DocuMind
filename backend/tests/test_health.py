"""
/health is public and is what Render polls. It must never echo raw connection errors in
production — SQLAlchemy/psycopg2 messages carry the host, port, database and user from the DSN.
"""
from app import main
from app.config import settings


def _fail(*_args, **_kwargs):
    raise RuntimeError(
        'connection to server at "ep-secret-123.aws.neon.tech" (10.0.0.1), port 5432 failed: '
        'FATAL: password authentication failed for user "documind_admin"'
    )


def test_health_masks_connection_errors_in_production(client, mocker, monkeypatch):
    monkeypatch.setattr(settings, "environment", "production")
    mocker.patch.object(main.qdrant, "get_collections", side_effect=_fail)
    mocker.patch.object(main.engine, "connect", side_effect=_fail)

    body = client.get("/health").json()

    assert body["status"] == "degraded"
    assert body["qdrant"] == "unreachable"
    assert body["postgres"] == "unreachable"
    # None of the DSN detail may reach a public response.
    serialised = str(body)
    for secret in ["neon.tech", "documind_admin", "password authentication", "5432"]:
        assert secret not in serialised


def test_health_keeps_detail_in_development(client, mocker, monkeypatch):
    monkeypatch.setattr(settings, "environment", "development")
    mocker.patch.object(main.engine, "connect", side_effect=_fail)

    body = client.get("/health").json()

    assert body["status"] == "degraded"
    assert "password authentication failed" in body["postgres"]


def test_health_reports_ok_when_both_backends_answer(client):
    body = client.get("/health").json()
    assert body == {"status": "ok", "qdrant": "connected", "postgres": "connected"}
