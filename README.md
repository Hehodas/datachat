# DataChat

AI-powered database Q&A chatbot for a telecom CRM stored in Supabase. Ask about customers by name or search by topic (invoices, incidents, equipment, subscriptions) and get a structured summary streamed back in a ChatGPT-style interface.

## Prerequisites

- Node.js 18+
- OpenAI API key
- Supabase project with the CRM schema (server secret key required — RLS is enabled with no anon policies)

## Setup

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

```
OPENAI_API_KEY=your_openai_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your_sb_secret_key
```

## Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Example questions

Try these in the chat:

- **Tell me about Eleanor Shellstrop**
- **What do we know about Chidi Anagonye?**
- **Show unpaid invoices**
- **What open incidents do we have?**
- **Find Madam Peterson** (returns no matches — she is not in the database)

Sample customers in the demo database: **Eleanor Shellstrop**, **Chidi Anagonye**, **Tahani Al-Jamil**.

## Tests

```bash
npm test
```

Watch mode:

```bash
npm run test:watch
```

- **Unit tests** mock Supabase — no network required.
- **Route integration tests** mock OpenAI — no token spend.
- **Supabase integration tests** hit the live project when `SUPABASE_URL` and `SUPABASE_SECRET_KEY` are set in `.env.local`; they skip automatically otherwise.

## Architecture

- **Frontend**: Next.js App Router, `useChat` from `@ai-sdk/react`, dark navy UI
- **Backend**: `POST /api/chat` with OpenAI `gpt-4o` and agentic tool loop
- **Tools**: `searchCustomers`, `getCustomerDossier`, `searchByTopic` (server-side Supabase secret client)

Secrets never leave the server. The browser only talks to `/api/chat`.

## Security note

Rotate any API keys that were shared in chat or committed by mistake. Keep secrets in `.env.local` only — never commit them.
