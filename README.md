# DataChat

ChatGPT-style Q&A over a telecom CRM in Supabase. Ask about a customer or topic; the server-side agent searches the database and streams a structured summary.

The browser talks only to `/api/chat`. OpenAI and Supabase secret keys stay on the server.

Access is gated with **HTTP Basic Auth**. The browser shows a native prompt; there is no login UI. Anyone with the shared password can still query CRM data through the chat tools. This stops anonymous access, not insider misuse.

## Documentation

Full documentation (architecture, API, security, testing, deployment):

**https://hehodas.github.io/datachat/**

Preview docs locally:

```bash
pip install -r requirements-docs.txt
mkdocs serve
```

## Setup

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

```
OPENAI_API_KEY=
SUPABASE_URL=
SUPABASE_SECRET_KEY=
CHAT_BASIC_USER=
CHAT_BASIC_PASSWORD=
```

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Server-side OpenAI key for `gpt-4o` |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SECRET_KEY` | Service-role / secret key (server only; bypasses RLS) |
| `CHAT_BASIC_USER` | HTTP Basic username for the site and `/api/*` |
| `CHAT_BASIC_PASSWORD` | HTTP Basic password |

`CHAT_BASIC_USER` and `CHAT_BASIC_PASSWORD` are required. If either is missing, every request is denied (fail closed). Never put them in a `NEXT_PUBLIC_` variable.

`POST /api/chat` is also limited to about 20 requests per minute per IP.

Never commit `.env.local`. `.gitignore` already excludes `.env*` (except `.env.example`).

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with the Basic Auth credentials from `.env.local`.

## Test

```bash
npm test
```

Watch mode:

```bash
npm run test:watch
```

Unit tests mock Supabase. Chat route tests mock OpenAI / `streamText` (no live token spend). Read-only live Supabase tool tests run only when `SUPABASE_URL` and `SUPABASE_SECRET_KEY` are set; otherwise they are skipped.

## Example questions

Demo customers in the CRM:

- **Eleanor Shellstrop**
- **Chidi Anagonye**
- **Tahani Al-Jamil**

Try:

- Tell me about Eleanor Shellstrop
- Show unpaid invoices
- What open incidents do we have?

There is no Madam Peterson in the data; that search should return a clear “no matching records” answer.
