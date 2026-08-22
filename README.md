# DataChat

ChatGPT-style Q&A over a telecom CRM in Supabase. Ask about a customer or topic; the server-side agent searches the database and streams a structured summary.

The browser talks only to `/api/chat`. OpenAI and Supabase secret keys stay on the server.

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
```

Never commit `.env.local`. `.gitignore` already excludes `.env*` (except `.env.example`).

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

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
