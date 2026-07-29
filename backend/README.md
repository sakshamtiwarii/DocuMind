# DocuMind — RAG Document Q&A System

Upload a PDF, ask questions about it in plain English, and get answers grounded in the
document's actual content — with page-level source citations and multi-turn conversation
support. Answers are constrained to retrieved context only; if something isn't in the
document, the system says so instead of guessing.

**Stack:** FastAPI · LangChain · Qdrant · OpenAI (`text-embedding-3-small` + `gpt-4o-mini`) · PostgreSQL · Redis · Docker

## Architecture

Two independent flows sharing one vector store:

- **Ingestion** (once per document): PDF → per-page text extraction → chunking
  (`RecursiveCharacterTextSplitter`, ~800–1000 chars with overlap) → OpenAI embeddings →
  stored in Qdrant with `document_id`/`page_number`/`chunk_index` metadata.
- **Query** (per question): question is embedded → Qdrant similarity search, filtered by
  `document_id` so questions never leak across documents → top-k chunks inserted into a
  prompt that restricts the LLM to that context → grounded answer + source citations.

Qdrant holds vectors; Postgres holds relational bookkeeping (`documents`, `sessions`,
`messages`) — chat history is persisted and replayed into the LLM as conversational context
on follow-up questions.

## Setup

1. Copy the env template and fill in your OpenAI key:
   ```bash
   cp .env.example .env
   # edit .env — set OPENAI_API_KEY
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

## API

A session is a *conversation*, not a single-document pairing — it can hold zero or more
documents, attached independently of asking questions.

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | API + Qdrant + Postgres connectivity check |
| POST | `/documents` | Upload a PDF; ingestion runs in the background |
| GET | `/documents/{id}` | Check ingestion status (`processing` \| `ready` \| `failed`) |
| POST | `/sessions` | Start a new, empty conversation |
| GET | `/sessions` | List all conversations (sidebar), most recently active first |
| GET | `/sessions/{id}` | Full detail: title, attached documents, full message history |
| POST | `/sessions/{id}/documents` | Attach a document to a conversation (idempotent) |
| DELETE | `/sessions/{id}` | Delete a conversation and its messages/attachments |
| POST | `/ask` | Ask a question grounded in the conversation's attached documents |

**Typical flow:** `POST /sessions` (empty conversation) → `POST /documents` to upload each
PDF, poll `GET /documents/{id}` until `status: "ready"`, then `POST /sessions/{id}/documents`
to attach it → `POST /ask` any number of times with that `session_id`. Documents can be
attached before, during, or between questions — `/ask` only requires that *at least one*
attached document is `ready`, not all of them.

`POST /ask` request/response:
```jsonc
// Request
{ "session_id": "...", "question": "What is the termination clause?" }

// Response
{
  "answer": "The contract can be terminated with 30 days written notice...",
  "sources": [{ "page_number": 4, "chunk_text": "Either party may terminate...", "filename": null }],
  "session_id": "..."
}
```
`sources[].filename` is only populated when a conversation has more than one attached
document, so single-PDF answers stay uncluttered.

Error responses: `400` invalid input, non-PDF upload, malformed UUID, or no ready document
attached yet; `404` unknown document or session; `502` upstream OpenAI failure; `503`
Qdrant unreachable.

## Testing

Requires the infra containers running (tests hit real Postgres; OpenAI/Qdrant calls in the
API layer are mocked where they'd otherwise cost money):
```bash
docker compose up -d qdrant redis postgres
pytest tests/ -v
```

## Project structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app, CORS, lifespan (creates tables), /health
│   ├── config.py            # env-driven settings
│   ├── api/                 # routes: documents.py, ask.py, sessions.py
│   ├── core/                # RAG pipeline: ingestion, chunking, embeddings,
│   │                        #   retriever, prompts, chain (answer generation)
│   ├── db/postgres.py       # SQLAlchemy engine/session
│   ├── models/               # Document, ChatSession, SessionDocument, Message ORM models
│   └── schemas/schemas.py   # Pydantic request/response models
├── tests/
├── Dockerfile
├── docker-compose.yml
└── requirements.txt
```
