# Deployment

## Next.js app (the chatbot)

GitHub Pages hosts **documentation only**. The chat app needs a Node host (or Vercel / similar) that can run Next.js API routes and hold secrets.

### Build and run

```bash
npm install
npm run build
npm start
```

Set the same environment variables as local development on the host (never commit them):

- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `CHAT_BASIC_USER`
- `CHAT_BASIC_PASSWORD`

### Hosting notes

| Concern | Guidance |
| --- | --- |
| Serverless cold starts | In-memory rate limiter resets per instance; consider Redis if you need global limits |
| Timeouts | Route `maxDuration` is 60s — ensure the platform allows streaming that long |
| HTTPS | Prefer TLS so Basic Auth credentials are not sent in cleartext |
| RLS | Keep using the secret key only on the server |

Generic targets: Vercel, Railway, Fly.io, a VPS with Docker/`node`, etc. Exact platform config is out of scope of this repo.

---

## Documentation site (GitHub Pages)

### Local

```bash
pip install -r requirements-docs.txt
mkdocs serve          # http://127.0.0.1:8000
mkdocs build --strict # verify links
```

### CI deploy

Workflow: `.github/workflows/docs.yml`

- Triggers on pushes to `main` that touch `docs/**`, `mkdocs.yml`, `requirements-docs.txt`, or the workflow itself.
- Installs MkDocs Material and runs `mkdocs gh-deploy --force` to the `gh-pages` branch.

### One-time GitHub settings

After the first successful workflow run:

1. Open the repo on GitHub → **Settings** → **Pages**
2. **Source:** Deploy from a branch
3. **Branch:** `gh-pages` / `/ (root)`
4. Save

Site URL: [https://hehodas.github.io/datachat/](https://hehodas.github.io/datachat/)

### What Pages does *not* host

The Next.js chat UI, API routes, and secrets. Pages only serves the static MkDocs output from `gh-pages`.
