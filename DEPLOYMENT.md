# Deploying DocuMind

Four services, all on free tiers:

| Piece | Host | Why not Vercel |
|---|---|---|
| Frontend (Vite/React) | **Vercel** | — |
| API (FastAPI, Docker) | **Render** | Ingestion continues in a background task *after* the response returns; Vercel kills the process at response time |
| Postgres | **Neon** | Vercel has no persistent database |
| Vectors | **Qdrant Cloud** | Needs a long-lived service |

There is **no server-side LLM key**. Each visitor supplies their own OpenAI or Groq key in the
UI, stored in their browser and sent per request. Embeddings run locally inside the API
container, so ingestion costs nothing and needs no key.

Do the steps in order — Render needs the database URLs, and the API's CORS setting needs the
Vercel URL, so there is one deliberate loop back at the end.

---

## 1. Postgres — Neon

1. Create a project at [neon.tech](https://neon.tech). Any region near your Render region.
2. Copy the connection string. Use the **pooled** one and keep `?sslmode=require`:
   ```
   postgresql://user:password@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require
   ```
3. Nothing else to do — tables are created automatically on first boot.

## 2. Vectors — Qdrant Cloud

1. Create a free 1 GB cluster at [cloud.qdrant.io](https://cloud.qdrant.io).
2. Copy the **cluster URL** (`https://xxx.aws.cloud.qdrant.io:6333`) and create an **API key**.

The collection is created automatically on first upload, with 384 dimensions to match the
local `BAAI/bge-small-en-v1.5` embedding model.

> If you ever change `EMBEDDING_MODEL`, the vector size changes with it and the existing
> collection will reject writes. Delete the collection and re-upload.

## 3. API — Render

1. [render.com](https://render.com) → **New → Web Service** → connect this GitHub repo.
2. Render reads [`render.yaml`](render.yaml) and preconfigures Docker, `rootDir: backend`,
   and the `/health` check. Confirm **Instance Type: Free**.
3. Set these environment variables (the ones marked `sync: false` in the blueprint):

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | the Neon pooled string from step 1 |
   | `QDRANT_URL` | the Qdrant cluster URL from step 2 |
   | `QDRANT_API_KEY` | the Qdrant API key from step 2 |
   | `CORS_ORIGINS` | leave blank for now — filled in step 5 |

   `ENVIRONMENT=production`, `CORS_ORIGIN_REGEX` and `MAX_UPLOAD_MB` come from the blueprint.
4. Deploy. The first build takes ~5-10 minutes (it bakes the embedding model into the image).
5. Check it: `curl https://<your-service>.onrender.com/health` →
   `{"status":"ok","qdrant":"connected","postgres":"connected"}`

   If it says `degraded`, one of the two URLs or the Qdrant key is wrong. Production
   deliberately hides the underlying error; check the Render logs for detail.

## 4. Frontend — Vercel

1. [vercel.com](https://vercel.com) → **Add New → Project** → import the same repo.
2. **Root Directory: `frontend`** — this is the one setting people miss; without it the build
   fails because `package.json` isn't at the repo root.
3. Framework preset **Vite** is detected from [`frontend/vercel.json`](frontend/vercel.json).
4. Add one environment variable, for all environments:

   | Variable | Value |
   |---|---|
   | `VITE_API_URL` | `https://<your-service>.onrender.com` (https, no trailing slash) |

5. Deploy, and note the resulting URL (e.g. `https://documind-xyz.vercel.app`).

> `VITE_API_URL` is inlined at **build** time, not read at runtime. Changing it later requires
> a redeploy, not just an env-var edit.

## 5. Close the loop — allow the frontend through CORS

Back in Render, set:

```
CORS_ORIGINS = https://documind-xyz.vercel.app
```

Use the exact origin: `https://`, no trailing slash, no path. Multiple origins are
comma-separated (add a custom domain here later).

Preview deploys are handled separately by `CORS_ORIGIN_REGEX`. Update the default in
`render.yaml` to match your project name, or delete it to block previews:

```
^https://documind-.*\.vercel\.app$
```

Render redeploys on save. Then open the Vercel URL, add your Groq or OpenAI key under
**Settings**, upload a PDF and ask something.

---

## Verifying a live deployment

```bash
API=https://<your-service>.onrender.com
APP=https://<your-app>.vercel.app

curl -s $API/health                                   # all connected

# The frontend's origin is allowed…
curl -s -o /dev/null -D - -X OPTIONS $API/sessions \
  -H "Origin: $APP" -H "Access-Control-Request-Method: POST" | grep -i access-control-allow-origin

# …and nothing else is.
curl -s -o /dev/null -D - -X OPTIONS $API/sessions \
  -H "Origin: https://evil.example.com" -H "Access-Control-Request-Method: POST" \
  | grep -i access-control-allow-origin || echo "correctly refused"
```

In the browser, check the console is free of CORS and mixed-content errors, then run through:
new conversation → upload a PDF → ask a question → expand citations → rename → reload.

## Things to expect

- **The first request after ~15 minutes idle is slow.** Render's free tier sleeps; the
  container must start and load the embedding model. Expect tens of seconds, then it's fast
  until it idles again. Fixes, in increasing order of cost: an uptime pinger, or a paid
  always-on instance (Render Starter, or Railway ~$5/mo).
- **Free tier is 512 MB RAM.** onnxruntime plus the embedding model fits, but not with much
  headroom. If the service restarts during ingestion of a large PDF, suspect memory.
- **Rate limits are per instance**, held in process memory (there is no Redis). Fine for one
  free instance; if you ever scale to several, the effective limit multiplies and it should
  move to a shared store.
- **Uploads are capped at 10 MB** (`MAX_UPLOAD_MB`) and the API is unauthenticated by design —
  anyone with the URL can upload and ask. Rate limits are the only abuse control.
- **Documents stuck "processing"** for more than 10 minutes are reported as failed. That
  happens when the instance sleeps or restarts mid-ingestion; re-upload the file.
