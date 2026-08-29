# Testing

```bash
npm test
npm run test:watch
```

Stack: **Vitest**, Testing Library for components, `jsdom`. Env for live tests is loaded via `dotenv` in `vitest.setup.ts` when present.

## Layers

| Suite | Location | What it covers |
| --- | --- | --- |
| Tool unit tests | `lib/__tests__/tools.test.ts` | Mocked Supabase client; search / dossier / topic / errors / blank query |
| Tool integration | `lib/__tests__/tools.integration.test.ts` | Live Supabase when `SUPABASE_URL` + `SUPABASE_SECRET_KEY` are set; otherwise `describe.skip` |
| Chat route | `app/api/chat/__tests__/route.integration.test.ts` | Real `POST` handler; OpenAI / `streamText` mocked; Basic Auth stubs |
| Access | `lib/__tests__/access.test.ts` | Auth and rate limiter |
| Chat request | `lib/__tests__/chat-request.test.ts` | Payload validation |
| UI | `components/__tests__/*.test.tsx` | Chat / MessageList behavior |

## What is mocked

- **Unit tools:** fake `from().select()…` chains — no network.
- **Route tests:** `@ai-sdk/openai` and `streamText` — no token spend, no flaky LLM wording. Scripted tool `execute` calls assert `searchCustomers` / `getCustomerDossier` invocation.
- **Live Supabase tests:** real reads only (Eleanor exists; Peterson empty; dossier has subscriptions/invoices). Skipped in CI without secrets.

## Design for testability

Tools accept the Supabase client as an argument (`searchCustomers(client, { query })`), so unit tests never need a live OpenAI key or a real database.

## Out of scope (v1)

- Playwright / E2E browser tests
- Live OpenAI calls in the test suite
