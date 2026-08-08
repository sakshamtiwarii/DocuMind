# DocuMind

A chat app for your PDFs. Upload one or more documents into a conversation, ask questions
in plain English, and get answers grounded in what's actually on the page — with
page-level citations and no guessing when the answer isn't in the document.

Conversations work like a normal chat app: a sidebar lists them (rename or delete anytime),
each one can hold multiple PDFs that grow its context over time (attach or detach as you
go), and history is remembered across turns — including pronoun follow-ups like "why was it
chosen?".

**Bring your own key, nothing else to pay for:** this app has no server-side LLM key at
all. You connect your own OpenAI or Groq API key from the browser; it's kept in
`localStorage` and sent only with each `/ask` request, straight through to that provider.
Document embeddings run locally on the backend (via `fastembed`), so uploading and indexing
PDFs costs nothing and needs no key — a key is only required once you start asking
questions.

**Stack:** FastAPI · LangChain · Qdrant · fastembed (local embeddings) · OpenAI / Groq (chat, user-supplied key) · PostgreSQL · Docker · React (Vite) · Tailwind CSS

## Features

- **Bring-your-own-key** — OpenAI or Groq (Groq is free); the key never touches this app's
  database or leaves the browser except in a direct per-question request.
- **Multi-document conversations** — attach or detach any number of PDFs from a chat;
  answers and citations are disambiguated by filename once more than one document is
  attached.
- **Grounded answers only** — retrieval is filtered per-conversation so questions never
  leak context from unrelated documents/chats; if the answer isn't in the retrieved
  context, the model says so instead of hallucinating.
- **Real conversation history** — follow-up questions are rewritten against prior turns
  before retrieval, so "tell me more about it" resolves correctly.
- **Page-cited sources** — every answer links back to the page(s) and quoted chunk(s) it
  was built from.
- **Persistent, resumable sessions** — conversations, messages, and document status live
  in Postgres; refreshing the page restores exactly where you left off. Rename or delete
  conversations from the sidebar.

## Architecture

```
┌─────────────┐      REST/JSON      ┌──────────────┐
│   frontend   │ ──────────────────▶ │   backend    │
│  React+Vite  │ ◀────────────────── │   FastAPI    │
└──────┬──────┘                     └──────┬───────┘
       │                                    │
       │ (key stored in localStorage,       │
       │  sent only with /ask)              │
       ▼                                    │
┌─────────────┐                             │
│ OpenAI/Groq │ ◀───────────────────────────┘  (chat completions, user's own key)
└─────────────┘
                     ┌──────────────────────┴──────────────────────┐
                     ▼                                             ▼
              ┌─────────────┐                             ┌──────────────┐
              │   Qdrant    │                             │  PostgreSQL  │
              │  (vectors)  │                             │ (docs/chats) │
              └─────────────┘                             └──────────────┘
                     ▲
                     │
              fastembed — local embedding model, runs in the backend process
```

Two independent flows sharing one vector store:

- **Ingestion** (once per document, no API key needed): PDF → per-page text extraction →
  chunking (`RecursiveCharacterTextSplitter`, ~1000 chars with 200 overlap) → embedded
  locally with `fastembed` (`BAAI/bge-small-en-v1.5`, 384-dim) → stored in Qdrant tagged
  with `document_id`/`page_number`/`chunk_index`.
- **Query** (per question, needs the user's key): the question is rewritten against chat
  history (if any) into a standalone query → embedded locally → Qdrant similarity search
  filtered to the conversation's attached document IDs → top-k chunks inserted into a
  prompt that restricts the LLM to that context → the chat call is made with the user's own
  OpenAI or Groq key (Groq is used through its OpenAI-compatible endpoint, so the same
  client code drives both) → grounded answer + source citations, persisted to Postgres.

Qdrant holds vectors; Postgres holds relational bookkeeping (`documents`, `sessions`,
`session_documents`, `messages`) — a session (conversation) is a many-to-many join over
documents, not a 1:1 pairing, which is what lets one chat carry several PDFs and lets a
document be detached without losing it. No table stores an API key — it never leaves the
browser except inside a request to the model provider.

## Project structure

```
DocuMind/
├── backend/          # FastAPI + RAG pipeline — see backend/README.md for full detail
│   ├── app/
│   │   ├── api/          # routes: documents.py, ask.py, sessions.py
│   │   ├── core/         # ingestion, chunking, embeddings (local/fastembed), retriever,
│   │   │                 #   prompts, chain (builds the OpenAI/Groq client per request)
│   │   ├── db/, models/  # Postgres (SQLAlchemy) — Document, ChatSession, SessionDocument, Message
│   │   └── main.py       # app setup, CORS, /health
│   ├── tests/
│   ├── docker-compose.yml
│   └── Dockerfile
└── frontend/         # React + Vite + Tailwind chat UI
    └── src/
        ├── api/client.js              # fetch wrappers
        ├── lib/apiKey.js              # localStorage-backed provider/key config
        ├── hooks/useConversations.js  # state: conversation list, active chat, sending/uploading
        └── components/    # Sidebar, ChatScreen, ApiKeyForm/ApiKeySettings, DocumentChip,
                            #   Dropzone, SourceCitation, ...
```

## Quickstart

**Prerequisites:** Docker, Node.js. No API key needed to set up the backend — you'll
connect one (OpenAI or Groq) from the browser on first run.

1. **Backend** — bring up the API + Qdrant + Postgres:
   ```bash
   cd backend
   cp .env.example .env
   docker compose up -d --build
   curl http://localhost:8000/health   # {"status":"ok","qdrant":"connected","postgres":"connected"}
   ```
   API docs: http://localhost:8000/docs · Qdrant dashboard: http://localhost:6333/dashboard

2. **Frontend** — in a second terminal:
   ```bash
   cd frontend
   cp .env.example .env   # VITE_API_URL=http://localhost:8000
   npm install
   npm run dev
   ```
   Open http://localhost:5173 — you'll be asked to connect an API key first (Groq's is
   free: console.groq.com/keys). After that, start a new conversation, drop in a PDF, and
   ask it something.

See [backend/README.md](backend/README.md) for running the API outside Docker, the full
API reference, and error-response details.

## Testing

```bash
# backend (needs the infra containers up; provider calls are mocked in tests)
cd backend
docker compose up -d qdrant postgres
pytest tests/ -v

# frontend
cd frontend
npm run lint
npm run build
```

## Deployment

Production runs as a split deploy — see **[DEPLOYMENT.md](DEPLOYMENT.md)** for the
step-by-step runbook.

| Piece | Host | Notes |
|---|---|---|
| Frontend | Vercel | Static Vite build; `VITE_API_URL` is inlined at build time |
| API | Render (Docker) | Free tier sleeps when idle — first request after ~15 min is slow |
| Postgres | Neon | Pooled connection string, `?sslmode=require` |
| Vectors | Qdrant Cloud | Free 1 GB cluster, 384-dim collection |

The API can't run on Vercel: ingestion continues in a background task *after* the HTTP
response returns, which serverless functions don't allow, and the image carries a local
embedding model. [`render.yaml`](render.yaml) and
[`frontend/vercel.json`](frontend/vercel.json) hold the deploy config.

Because the API is public and unauthenticated by design, production adds env-driven CORS,
a 10 MB upload cap, per-IP rate limiting on `/documents` and `/ask`, and a `/health` endpoint
that reports status without echoing connection errors.

## Status

Feature-complete and verified end-to-end (connect a key → upload → multi-document
conversations → grounded, cited, multi-turn chat → rename/detach/delete) against the real
local stack, with 45 backend tests passing. Deployment config and runbook are in place and
verified against a production-shaped container run; the live URLs go here once deployed.
