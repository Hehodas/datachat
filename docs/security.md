# Security

DataChat is an internal-style demo: anyone with the shared Basic Auth password can query CRM data through the chat tools. Auth stops **anonymous** access; it does not stop insider misuse.

## HTTP Basic Auth

Implemented in `lib/access.ts` and enforced by:

1. **`middleware.ts`** — every page and API route (except static Next assets)
2. **`enforceChatAccess`** in `POST /api/chat` — defense in depth

Credentials come from:

- `CHAT_BASIC_USER`
- `CHAT_BASIC_PASSWORD`

!!! warning "Fail closed"
    If either variable is missing, **all requests are denied**. The app logs once that credentials are not set.

Comparison uses a timing-safe UTF-8 equality check so password length and content are not leaked via early exits.

Never expose these as `NEXT_PUBLIC_*` — they must stay server-side. The browser’s native Basic Auth prompt sends them on each request.

## Rate limiting

`POST /api/*` is limited to about **20 requests per minute per IP** (`RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` in `lib/access.ts`).

- IP is taken from `x-forwarded-for` (first hop) or `x-real-ip`, else `"unknown"`.
- Buckets live in process memory (fine for a single Node instance; not shared across serverless replicas unless you add Redis or similar).
- Exceeded limit → **429 Too many requests**.

Middleware applies the limit for `POST /api/*`. The chat route also calls `consumeRateLimit` again when using `enforceChatAccess`.

## Secrets handling

| Secret | Where it lives | Client-visible? |
| --- | --- | --- |
| `OPENAI_API_KEY` | Server env | No |
| `SUPABASE_SECRET_KEY` | Server env | No |
| `SUPABASE_URL` | Server env | No (only used server-side) |
| Basic Auth user/password | Server env | Sent by browser only after login prompt |

The frontend never creates a Supabase client. RLS on public tables has no policies; the secret key bypasses RLS on the server.

!!! danger "Rotated keys"
    If API keys were ever pasted into chat, tickets, or commits, rotate them in the OpenAI and Supabase dashboards and update `.env.local`.

## Request validation

`lib/chat-request.ts` validates payloads before they reach the model:

- Max **20** messages
- Max **8000** characters per text part
- Only `user` / `assistant` roles with text parts kept for the model
- Malformed bodies → **400 Invalid request**

## Markdown safety

Assistant markdown is rendered with `react-markdown` **without** `rehype-raw`. Link URLs are filtered to `http:`, `https:`, and `mailto:` (`safeMarkdownUrlTransform` in `lib/messages.ts`).
