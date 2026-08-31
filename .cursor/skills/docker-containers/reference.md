# Docker file templates and troubleshooting

Create or update these files to match the templates below. Keep comments minimal.

## `next.config.ts`

Inside the existing `nextConfig` object, add:

```ts
output: "standalone",
```

Do not remove the security `headers()` block.

## `Dockerfile`

Multi-stage, Alpine, non-root, standalone output. Node 20 to match getting-started.

```dockerfile
FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# No secrets in the image: unauthenticated / is 401 when middleware is up.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/',(r)=>process.exit(r.statusCode===401||r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]
```

Do not put Basic Auth passwords in `HEALTHCHECK`.

## `docker-compose.yml`

```yaml
services:
  datachat:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    env_file:
      - .env.local
    environment:
      HOSTNAME: "0.0.0.0"
      PORT: "3000"
    restart: unless-stopped
```

One service only. No `volumes` for source. No extra databases.

## `.dockerignore`

```
Dockerfile*
docker-compose*.yml
.dockerignore
.git
.github
.cursor
.vscode
.next
node_modules
coverage
.vitest
site
docs
mkdocs.yml
requirements-docs.txt
*.md
.env*
!.env.example
npm-debug.log*
*.log
.DS_Store
```

Ignoring `docs/` and `*.md` keeps the image small. Do **not** ignore files the Next build needs (`app/`, `components/`, `lib/`, `public/`, `middleware.ts`, `next.config.ts`, `tsconfig.json`, `postcss.config.*`, `package.json`, `package-lock.json`).

## Troubleshooting

| Symptom | Likely cause | What to do |
| --- | --- | --- |
| `RUN npm run build` fails with a TypeScript error | `next build` typechecks; `next dev` does not | Fix the error on the host (`npx tsc --noEmit`), then rebuild |
| Build fails: no `.next/standalone` | `output: "standalone"` missing | Add it to `next.config.ts`, rebuild |
| Container running, every request 401 even with `-u` | Wrong user/pass, or Compose not loading `.env.local` | Confirm `env_file` path; `docker compose exec datachat sh` then `env` (do not paste secrets into chat) |
| Container running, 401 and logs say credentials not set | `.env.local` missing/empty or not passed | Fix host file; `docker compose up -d` (no rebuild) |
| `EADDRINUSE` / port 3000 | Host `next dev` or another container | Stop the other process or change the **host** port mapping only (`3001:3000`) |
| Chat stream cuts off ~30s | Proxy/idle timeout in front of Docker | This app allows 60s; do not put a 30s reverse proxy in front without raising timeouts |
| Slow or flaky bind-mount (if someone added one) | OneDrive + Docker Desktop WSL2 | Remove the mount; rebuild the image instead |
| `npm ci` fails in deps stage | Lockfile out of date | Run `npm install` on the host, commit `package-lock.json`, rebuild |
| `curl` in PowerShell hits the wrong tool | Alias to `Invoke-WebRequest` | Use `curl.exe` |
| Compose file not found | Not in repo root | `cd` to the DataChat repo root first |

### Inspect without leaking secrets

```powershell
docker compose logs --tail 100 datachat
docker compose exec datachat sh -c "node -e \"console.log(process.env.PORT, Boolean(process.env.OPENAI_API_KEY), Boolean(process.env.CHAT_BASIC_USER))\""
```

Print only booleans / non-secret values. Never dump `env` into the conversation.

### Recreate container after env change

```powershell
docker compose up -d --force-recreate --no-build
```
