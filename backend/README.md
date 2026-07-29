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

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | API + Qdrant + Postgres connectivity check |
| POST | `/documents` | Upload a PDF; ingestion runs in the background |
| GET | `/documents/{id}` | Check ingestion status (`processing` \| `ready` \| `failed`) |
| POST | `/sessions` | Start a new Q&A session tied to a document |
| GET | `/sessions/{id}/messages` | Retrieve a session's full chat history |
| POST | `/ask` | Ask a question within a session |

**Typical flow:** `POST /documents` → poll `GET /documents/{id}` until `status: "ready"` →
`POST /sessions` with the `document_id` → `POST /ask` any number of times with that
`session_id` for a multi-turn conversation.

`POST /ask` request/response:
```jsonc
// Request
{ "document_id": "...", "session_id": "...", "question": "What is the termination clause?" }

// Response
{
  "answer": "The contract can be terminated with 30 days written notice...",
  "sources": [{ "page_number": 4, "chunk_text": "Either party may terminate..." }],
  "session_id": "..."
}
```

Error responses: `400` invalid input / non-PDF upload, `404` unknown document or session,
`409` question asked before ingestion finishes, `422` document failed ingestion (e.g.
scanned/no extractable text), `502` upstream OpenAI failure, `503` Qdrant unreachable.

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
│   └── models/               # Document, ChatSession, Message ORM models
├── tests/
├── Dockerfile
├── docker-compose.yml
└── requirements.txt
```
