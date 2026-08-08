# DocuMind — RAG Document Q&A System

Upload PDFs into a conversation, ask questions about them in plain English, and get answers
grounded in the documents' actual content — with page-level source citations and multi-turn
history. Answers are constrained to retrieved context only; if something isn't in the
document, the system says so instead of guessing.

**No server-side LLM key.** Embeddings (used to index and search documents) run locally via
`fastembed` — free, no key, no external call. Chat completions use a key the caller supplies
per-request (OpenAI or Groq); this backend never stores or logs it, and doesn't work without
one being sent on `/ask`.

**Stack:** FastAPI · LangChain · Qdrant · fastembed (local embeddings) · OpenAI / Groq (chat, caller-supplied key) · PostgreSQL · Redis · Docker

## Architecture

Two independent flows sharing one vector store:

- **Ingestion** (once per document, no API key involved): PDF → per-page text extraction →
  chunking (`RecursiveCharacterTextSplitter`, chunk_size=1000/overlap=200) → embedded
  locally with `fastembed` (`BAAI/bge-small-en-v1.5`, 384-dim vectors) → stored in Qdrant
  with `document_id`/`page_number`/`chunk_index` metadata.
- **Query** (per question, requires a caller-supplied key): question embedded locally →
  Qdrant similarity search filtered to the conversation's attached `document_id`s so
  questions never leak across conversations → top-k chunks inserted into a prompt that
  restricts the LLM to that context → the chat call is made with the caller's own OpenAI or
  Groq key (`app/core/chain.py` builds a `ChatOpenAI` client per request; Groq is used via
  its OpenAI-compatible endpoint, so one code path drives both) → grounded answer + source
  citations.

Qdrant holds vectors; Postgres holds relational bookkeeping (`documents`, `sessions`,
`session_documents`, `messages`) — chat history is persisted and replayed into the LLM as
conversational context on follow-up questions. A session is a many-to-many join over
documents (via `session_documents`), not a 1:1 pairing, so one conversation can carry
several PDFs and a document can be detached without deleting it.

## Setup

1. Copy the env template — no key to fill in, embeddings run locally:
   ```bash
   cp .env.example .env
   ```
2. Bring up the full stack (API + Qdrant + Postgres + Redis):
   ```bash
   docker compose up -d --build
   ```
3. Confirm it's healthy:
   ```bash
   curl http://localhost:8000/health
   # {"status":"ok","qdrant":"connected","postgres":"connected"}
   ```

The OpenAI or Groq API key only comes into play on `/ask` — it's supplied by the caller
(the frontend collects it from the user and sends it per-request; see the root
[README](../README.md)), never configured on the backend.

API docs (interactive): http://localhost:8000/docs
Qdrant dashboard: http://localhost:6333/dashboard

### Running the API locally instead of in Docker

Useful for active development (faster reload loop):
```bash
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
docker compose up -d qdrant redis postgres   # just the infra, not the api container
uvicorn app.main:app --reload --port 8000
```
`fastembed` downloads its model weights on first use and caches them locally — the first
document upload (or the first test run) after a fresh install will be slower.

## API

A session is a *conversation*, not a single-document pairing — it can hold zero or more
documents, attached or detached independently of asking questions.

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | API + Qdrant + Postgres connectivity check |
| POST | `/documents` | Upload a PDF; ingestion (local embeddings) runs in the background |
| GET | `/documents/{id}` | Check ingestion status (`processing` \| `ready` \| `failed`) |
| POST | `/sessions` | Start a new, empty conversation |
| GET | `/sessions` | List all conversations (sidebar), most recently active first |
| GET | `/sessions/{id}` | Full detail: title, attached documents, full message history |
| PATCH | `/sessions/{id}` | Rename a conversation |
| DELETE | `/sessions/{id}` | Delete a conversation and its messages/attachments |
| POST | `/sessions/{id}/documents` | Attach a document to a conversation (idempotent) |
| DELETE | `/sessions/{id}/documents/{document_id}` | Detach a document from a conversation |
| POST | `/ask` | Ask a question, grounded in the conversation's attached documents |

**Typical flow:** `POST /sessions` (empty conversation) → `POST /documents` to upload each
PDF, poll `GET /documents/{id}` until `status: "ready"`, then `POST /sessions/{id}/documents`
to attach it → `POST /ask` any number of times with that `session_id` plus a provider/key.
Documents can be attached, detached, or still processing at any point — `/ask` only requires
that *at least one* attached document is currently `ready`.

`POST /ask` request/response:
```jsonc
// Request
{
  "session_id": "...",
  "question": "What is the termination clause?",
  "provider": "openai",       // or "groq"
  "api_key": "sk-...",        // caller-supplied; never stored server-side
  "model": null                // optional override; defaults to gpt-4o-mini (openai) or llama-3.3-70b-versatile (groq)
}

// Response
{
  "answer": "The contract can be terminated with 30 days written notice...",
  "sources": [{ "page_number": 4, "chunk_text": "Either party may terminate...", "filename": null }],
  "session_id": "..."
}
```
`sources[].filename` is only populated when a conversation has more than one attached
document, so single-PDF answers stay uncluttered.

Error responses: `400` invalid input, malformed UUID, non-PDF upload, or no ready document
attached yet; `401` the supplied API key was rejected by the provider; `404` unknown
document or session; `422` blank question, blank rename title, or a document that failed
ingestion; `429` the provider rate-limited the request; `502` other upstream provider
failure; `503` Qdrant unreachable.

## Testing

Requires the infra containers running (tests hit real Postgres; Qdrant calls are real,
provider chat calls are mocked so the suite needs no real API key and costs nothing):
```bash
docker compose up -d qdrant redis postgres
pytest tests/ -v
```

## Project structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app, CORS, lifespan (creates tables), /health
│   ├── config.py            # env-driven settings (no LLM key — see app/core/chain.py)
│   ├── api/                 # routes: documents.py, ask.py, sessions.py
│   ├── core/                # RAG pipeline: ingestion, chunking, embeddings (local/fastembed),
│   │                        #   retriever, prompts, chain (builds OpenAI/Groq client per request)
│   ├── db/postgres.py       # SQLAlchemy engine/session
│   ├── models/               # Document, ChatSession, SessionDocument, Message ORM models
│   └── schemas/schemas.py   # Pydantic request/response models
├── tests/
├── Dockerfile
├── docker-compose.yml
└── requirements.txt
```
