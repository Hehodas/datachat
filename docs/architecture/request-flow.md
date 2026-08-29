# Request flow

This page walks through what happens from opening the app to receiving the first answer.

## Startup

```mermaid
flowchart TD
  Browser[Browser opens localhost:3000] --> MW[middleware.ts]
  MW -->|401 if no Basic Auth| AuthPrompt[Browser login prompt]
  MW -->|authorized| Page[app/page.tsx]
  Page --> Chat[components/Chat.tsx]
  Chat --> Empty[Empty state with example chips]
```

1. Next.js loads env vars from `.env.local`.
2. Middleware checks Basic Auth (`lib/access.ts`). Missing or wrong credentials → **401**.
3. `app/page.tsx` renders `Chat`.
4. `useChat()` initializes empty in-memory messages and `status: "ready"`.
5. The Supabase client is **not** created yet; it is created lazily on the first API request and then cached (`lib/supabase.ts`).

## First question

Example: “Tell me about Eleanor Shellstrop”.

```mermaid
sequenceDiagram
  participant UI as Chat.tsx
  participant API as POST /api/chat
  participant GPT as GPT-4o
  participant Tools as lib/tools.ts
  participant DB as Supabase

  UI->>UI: sendMessage text
  UI->>API: POST messages
  API->>API: enforceChatAccess + parseChatRequest
  API->>GPT: streamText system + messages + tools
  GPT->>Tools: searchCustomers
  Tools->>DB: SELECT ILIKE
  DB-->>Tools: matches
  Tools-->>GPT: full or partial hits
  GPT->>Tools: getCustomerDossier
  Tools->>DB: parallel child table SELECTs
  DB-->>Tools: dossier
  Tools-->>GPT: customer record
  GPT-->>API: streamed markdown
  API-->>UI: UI message stream
  UI->>UI: MessageList renders markdown
```

### Frontend

1. `submitPrompt()` calls `sendMessage({ text })`.
2. The user message is added to local state immediately.
3. `useChat` POSTs the conversation (validated on the server; max 20 messages) to `/api/chat`.
4. While waiting:
   - `status === "submitted"` → “Searching the database…”
   - During streaming, if the assistant message has tool parts but no text yet → same indicator.

### Backend (`app/api/chat/route.ts`)

1. **`enforceChatAccess`** — Basic Auth + rate limit (defense in depth; middleware already checked).
2. **`parseChatRequest`** — Zod validation; keeps text parts only; rejects malformed bodies with **400**.
3. **`createServerSupabaseClient()`** — secret key client (bypasses RLS).
4. **`streamText`** — agentic tool loop with GPT-4o, capped at **5 steps** (`stopWhen: stepCountIs(5)`).
5. Response is a **UI message stream** consumed by `useChat`.

## Status codes at a glance

| Status | Meaning |
| --- | --- |
| 200 | Streaming success |
| 400 | Invalid JSON or invalid messages |
| 401 | Missing / wrong Basic Auth |
| 429 | Rate limit exceeded |
| 500 | Supabase client or stream setup failure |
