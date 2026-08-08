"""
A small per-IP fixed-window rate limiter.

Deliberately in-process: this app runs as a single instance and has no Redis (the dependency
was declared but never used, so it was removed rather than paid for). That means the counters
are per-process — if the service is ever scaled to multiple instances, the effective limit
becomes N x the configured value, and this should move to a shared store.
"""
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

from app.config import settings


class RateLimiter:
    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def _client_key(self, request: Request) -> str:
        # Render (like most PaaS) terminates TLS at a proxy, so the real client address is in
        # X-Forwarded-For; request.client.host would be the proxy for every caller.
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def check(self, request: Request) -> None:
        now = time.monotonic()
        key = self._client_key(request)
        hits = self._hits[key]

        cutoff = now - self.window_seconds
        while hits and hits[0] <= cutoff:
            hits.popleft()

        if len(hits) >= self.max_requests:
            retry_after = max(1, int(self.window_seconds - (now - hits[0])))
            raise HTTPException(
                status_code=429,
                detail="Too many requests — please slow down and try again shortly.",
                headers={"Retry-After": str(retry_after)},
            )

        hits.append(now)

        # Without this the dict grows one entry per IP forever.
        if len(self._hits) > 10_000:
            for stale_key in [k for k, v in self._hits.items() if not v or v[-1] <= cutoff]:
                del self._hits[stale_key]


_upload_limiter = RateLimiter(settings.upload_rate_limit, settings.rate_limit_window_seconds)
_ask_limiter = RateLimiter(settings.ask_rate_limit, settings.rate_limit_window_seconds)


def limit_uploads(request: Request) -> None:
    """FastAPI dependency — ingestion is the most expensive thing an anonymous caller can do."""
    _upload_limiter.check(request)


def limit_asks(request: Request) -> None:
    """FastAPI dependency. The LLM cost lands on the caller's own key, but retrieval and
    Postgres writes are still ours to pay for."""
    _ask_limiter.check(request)
