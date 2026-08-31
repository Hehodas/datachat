# Getting started

## Prerequisites

- **Node.js 20+** (AI SDK 7 requires Node 22; this project targets AI SDK 5 and works on Node 20)
- npm (bundled with Node)
- A Supabase project with the CRM schema
- An OpenAI API key

## Install

```bash
npm install
cp .env.example .env.local
```

## Environment variables

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

!!! warning "Required credentials"
    `CHAT_BASIC_USER` and `CHAT_BASIC_PASSWORD` are required. If either is missing, every request is denied (fail closed). Never put them in a `NEXT_PUBLIC_` variable.

!!! danger "Secrets"
    Never commit `.env.local`. `.gitignore` excludes `.env*` (except `.env.example`).

`POST /api/chat` is also limited to about **20 requests per minute per authenticated Basic user**.

## Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with the Basic Auth credentials from `.env.local`.

## Example questions

Demo customers:

- Eleanor Shellstrop
- Chidi Anagonye
- Tahani Al-Jamil

Try:

- Tell me about Eleanor Shellstrop
- Show unpaid invoices
- What open incidents do we have?

Madam Peterson is not in the data; the agent should say nothing was found.

## Preview this documentation locally

```bash
pip install -r requirements-docs.txt
mkdocs serve
```

Then open [http://127.0.0.1:8000](http://127.0.0.1:8000).
