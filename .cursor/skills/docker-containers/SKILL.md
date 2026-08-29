---
name: docker-containers
description: >-
  Create, run, rebuild, inspect, and stop the DataChat Docker image and Compose
  service. Use when the user mentions Docker, containers, docker compose,
  Dockerfile, images, ports, env_file, or running the Next.js app in a
  container. Also use when adding or changing Docker files for this repo.
---

# DataChat Docker containers

Manage **one production-style Next.js container** for the chat app. Do not Dockerize MkDocs (docs stay on GitHub Pages / `mkdocs serve` on the host).

Prefer `npm run dev` on the host for day-to-day coding. Use Docker to run a production-like build (`next start` via standalone).

## Project facts

| Item | Value |
| --- | --- |
| App | Next.js 15, Node **20**, `npm run build` then `node server.js` (standalone) |
| Compose service | `datachat` |
| Host port | `3000` |
| Secrets | `.env.local` at repo root — never `COPY` into the image |
| Required env | `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `CHAT_BASIC_USER`, `CHAT_BASIC_PASSWORD` |
| Auth | HTTP Basic Auth on every page and `/api/*`; missing creds → deny all |
| Chat | `POST /api/chat` streams up to **60s**; in-memory rate limit → **one replica** |
| Host | Windows + PowerShell. Repo is often under OneDrive — avoid source bind-mounts |

## First-time setup

If `Dockerfile`, `.dockerignore`, or `docker-compose.yml` are missing, create them from [reference.md](reference.md). Then:

1. Add `output: "standalone"` to `next.config.ts` (required for the runner stage). Do not change other Next config.
2. Confirm `.env.local` exists and all five variables are set. Do not create or commit real secrets.
3. Confirm `.dockerignore` excludes `.env*`, `node_modules`, `.next`, `/site`.

Do not add an unauthenticated `/api/health` route unless the user asks. Middleware would still require Basic Auth unless the matcher is changed.

## Commands (PowerShell)

Run from the **repo root**. Use `docker compose` (v2), not `docker-compose`. Do not use bash heredocs or `&&` chains that fail on Windows PowerShell 5.1 — run commands separately.

**Start / rebuild**

```powershell
docker compose up -d --build
```

**Status**

```powershell
docker compose ps
```

**Logs** (follow; stop with Ctrl+C)

```powershell
docker compose logs -f datachat
```

**Stop (keep the image)**

```powershell
docker compose stop
```

**Stop and remove the container** (does not delete the image)

```powershell
docker compose down
```

**Rebuild after Dockerfile, lockfile, or `next.config.ts` changes**

```powershell
docker compose up -d --build
```

**Shell inside the running container**

```powershell
docker compose exec datachat sh
```

**Remove dangling build cache only when the user asks** (this is destructive to unused images/cache):

```powershell
docker image prune
```

Never `docker system prune -a` or `docker volume prune` unless the user explicitly requests it.

## Environment and secrets

- Inject runtime env with Compose `env_file: .env.local`. Do not bake keys into `ENV` in the Dockerfile.
- Do not prefix secrets with `NEXT_PUBLIC_`.
- `HOSTNAME=0.0.0.0` and `PORT=3000` belong in Compose `environment:` (or the Dockerfile runner) so Node listens on all interfaces.
- If `.env.local` is missing or a required var is empty, the container will start but every HTTP request is **401** (fail closed). Check logs for the “credentials are not set” message.

## Verify after start

1. `docker compose ps` — service `running`.
2. Request `http://localhost:3000` **without** credentials → **401** (middleware up).
3. Same URL with Basic Auth from `.env.local` → chat UI.
4. Send a chat message and confirm the stream completes (allow up to 60s).

On Windows, `curl.exe` is the real curl (PowerShell `curl` is `Invoke-WebRequest`):

```powershell
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3000/
```

Expect `401`. Then:

```powershell
curl.exe -s -o NUL -w "%{http_code}" -u "USER:PASSWORD" http://localhost:3000/
```

Expect `200`. Substitute USER/PASSWORD from `.env.local`; do not print those values in chat.

Treat HTTP **401** as a healthy “process is up” signal in Compose healthchecks. Do not use `wget -qO-` / `curl -f` against `/` without credentials — they fail on 401.

## Change rules

- **App code only** → `--build` (image copies source at build time; no bind-mount).
- **Env vars only** → `docker compose up -d` (recreate container; no rebuild).
- **Dockerfile / `.dockerignore` / `output: "standalone"`** → `--build`.
- Keep a **single** `datachat` replica. Do not add Compose `deploy.replicas` or a second app service; rate limits are per process.
- Do not add a Postgres/Supabase service. The app uses hosted Supabase via `SUPABASE_URL`.
- Do not mount the repo into the container for production runs. OneDrive + WSL2 bind-mounts are unreliable.

## Dev vs production

| Goal | How |
| --- | --- |
| Iterate on UI/API | `npm run dev` on the host (Turbopack). Not Docker. |
| Production-like run | `docker compose up -d --build` |
| Docs preview | `mkdocs serve` on the host. Not a container. |

Do not add a Compose `dev` service with a bind-mounted source tree unless the user explicitly wants it and understands OneDrive file-watch issues.

## Additional resources

- Canonical `Dockerfile`, `docker-compose.yml`, `.dockerignore`, and troubleshooting: [reference.md](reference.md)
