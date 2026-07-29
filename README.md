# DocuMind

A chat app for your PDFs. Upload one or more documents into a conversation, ask questions
in plain English, and get answers grounded in what's actually on the page — with
page-level citations and no guessing when the answer isn't in the document.

Conversations work like a normal chat app: a sidebar lists them, each one can hold
multiple PDFs that grow its context over time, and history is remembered across turns
(including pronoun follow-ups like "why was it chosen?").

**Stack:** FastAPI · LangChain · Qdrant · OpenAI (`text-embedding-3-small` + `gpt-4o-mini`) · PostgreSQL · Redis · Docker · React (Vite) · Tailwind CSS

## Features

- **Multi-document conversations** — attach as many PDFs as you want to a chat; answers
  and citations are disambiguated by filename once more than one document is attached.
- **Grounded answers only** — retrieval is filtered per-conversation so questions never
  leak context from unrelated documents/chats; if the answer isn't in the retrieved
  context, the model says so instead of hallucinating.
- **Real conversation history** — follow-up questions are rewritten against prior turns
  before retrieval, so "tell me more about it" resolves correctly.
- **Page-cited sources** — every answer links back to the page(s) and quoted chunk(s) it
  was built from.
- **Persistent, resumable sessions** — conversations, messages, and document status live
  in Postgres; refreshing the page restores exactly where you left off.

## Architecture

```
┌─────────────┐      REST/JSON      ┌──────────────┐
│   frontend   │  ─────────────────▶ │   backend    │
│  React+Vite  │ ◀───────────────── │   FastAPI    │
└─────────────┘                     └──────┬───────┘
                                            │
                     ┌──────────────────────┼──────────────────────┐
                     ▼                      ▼                      ▼
              ┌─────────────┐       ┌──────────────┐        ┌───────────┐
              │   Qdrant    │       │  PostgreSQL  │        │   Redis   │
              │  (vectors)  │       │ (docs/chats) │        │  (jobs)   │
              └─────────────┘       └──────────────┘        └───────────┘
                     ▲
                     │
              OpenAI embeddings + chat completions
```

Two independent flows sharing one vector store:

- **Ingestion** (once per document): PDF → per-page text extraction → chunking
  (`RecursiveCharacterTextSplitter`, ~1000 chars with 200 overlap) → OpenAI embeddings →
  stored in Qdrant tagged with `document_id`/`page_number`/`chunk_index`.
- **Query** (per question): the question is rewritten against chat history (if any) into
  a standalone query → embedded → Qdrant similarity search filtered to the conversation's
  attached document IDs → top-k chunks inserted into a prompt that restricts the LLM to
  that context → grounded answer + source citations, persisted to Postgres.

Qdrant holds vectors; Postgres holds relational bookkeeping (`documents`, `sessions`,
`session_documents`, `messages`) — a session (conversation) is a many-to-many join over
documents, not a 1:1 pairing, which is what lets one chat carry several PDFs.

## Project structure

```
DocuMind/
├── backend/          # FastAPI + RAG pipeline — see backend/README.md for full detail
│   ├── app/
│   │   ├── api/          # routes: documents.py, ask.py, sessions.py
│   │   ├── core/         # ingestion, chunking, embeddings, retriever, prompts, chain
│   │   ├── db/, models/  # Postgres (SQLAlchemy) — Document, ChatSession, SessionDocument, Message
│   │   └── main.py       # app setup, CORS, /health
│   ├── tests/
│   ├── docker-compose.yml
│   └── Dockerfile
└── frontend/         # React + Vite + Tailwind chat UI
    └── src/
        ├── api/client.js         # fetch wrappers
        ├── hooks/useConversations.js  # state: conversation list, active chat, sending/uploading
        └── components/           # Sidebar, ChatScreen, DocumentChip, Dropzone, SourceCitation, ...
```

## Quickstart

**Prerequisites:** Docker, Node.js, an OpenAI API key.

1. **Backend** — bring up the API + Qdrant + Postgres + Redis:
   ```bash
   cd backend
   cp .env.example .env
   # edit .env — set OPENAI_API_KEY
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
   Open http://localhost:5173 — start a new conversation, drop in a PDF, and ask it something.

See [backend/README.md](backend/README.md) for running the API outside Docker, the full
API reference, and error-response details.

## Testing

```bash
# backend (needs the infra containers up; OpenAI/Qdrant calls are mocked in tests)
cd backend
docker compose up -d qdrant redis postgres
pytest tests/ -v

# frontend
cd frontend
npm run lint
npm run build
```

## Status

Core product is feature-complete and verified end-to-end (upload → multi-document
conversations → grounded, cited, multi-turn chat) against the real local stack. Not yet
done: a hosted deploy and a demo asset — both deliberately left open since they depend on
account/hosting choices.
