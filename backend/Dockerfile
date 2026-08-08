FROM python:3.11-slim

# Fail fast and log immediately — buffered stdout hides tracebacks in hosted log viewers.
# fastembed defaults its cache to /tmp/fastembed_cache. Baking the model at build time (as
# root) would leave that owned by root, so the non-root runtime user can't write to it and
# every startup logs a permission error while re-checking the cache. Pin both caches to a
# directory we explicitly own instead.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HF_HOME=/opt/models \
    FASTEMBED_CACHE_PATH=/opt/models/fastembed

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Bake the embedding model into the image. Without this, fastembed downloads ~90 MB the first
# time app.core.embeddings is imported — which happens at startup, so every cold start on a
# host that sleeps would re-fetch it before the service could serve a single request.
RUN python -c "from fastembed import TextEmbedding; TextEmbedding(model_name='BAAI/bge-small-en-v1.5')"

COPY . .

# Drop privileges, giving the app ownership of its own model cache.
RUN useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app /opt/models
USER appuser

EXPOSE 8000

# Shell form so ${PORT} expands: hosts like Render assign the port at runtime and a hardcoded
# port means the health check never passes. Falls back to 8000 for local docker-compose.
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
