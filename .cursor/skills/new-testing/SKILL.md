---
name: new-testing
description: >-
  Assert whether a change needs new unit or integration tests, then create or
  extend them in this Vitest repo when they are necessary. Use when adding
  features, fixing bugs, changing lib/tools/API/UI behavior, writing tests, or
  when the user mentions unit tests, integration tests, coverage, or npm test.
---

# New testing

After any behavior change, **assert** whether new tests are needed. Create or extend them when they are. Do not skip this step because the user did not mention tests.

Stack: Vitest, Testing Library + jsdom for components. Run `npm test` (PowerShell-safe). No Playwright. No live OpenAI.

## 1. Assert (required)

Map the change to suites **before** writing files. Decide independently; do not ask the user unless the change is genuinely ambiguous (e.g. live DB vs mock).

| Need | Unit | Integration |
| --- | --- | --- |
| **Required** | New/changed logic in `lib/` (tools, access, validation, message helpers); bug fix with a reproducible input; security/auth/query-escaping | New/changed live Supabase query shape, column allow-list, or skip-if-no-env contract; new `POST /api/chat` wiring (auth, status, tool invoke) |
| **Not needed** | Types-only, comments, docs, CSS with no behavior; duplicate of an existing `it(...)` | Live OpenAI; E2E browser; extra replica/infra |

**Unit** = mocked I/O (fake Supabase chains, mocked `streamText` / `useChat`). **Integration** in this repo means either:

- live Supabase in `tools.integration.test.ts` (`describe.skip` when env missing), or
- real `POST` handler with OpenAI/`streamText` mocked (`route.integration.test.ts`)

Prefer **extending** the existing `describe` for that module over a new file.

If **not needed**, stop after one sentence to the user (what changed, why no test). Do not add a test file for documentation.

If **needed**, go to step 2.

## 2. Create

Read the matching existing test and copy its helpers. Templates: [reference.md](reference.md).

| Code | Test file |
| --- | --- |
| `lib/tools.ts` | `lib/__tests__/tools.test.ts` (mock client) and/or `lib/__tests__/tools.integration.test.ts` |
| `lib/<module>.ts` | `lib/__tests__/<module>.test.ts` |
| `app/api/chat/route.ts` | `app/api/chat/__tests__/route.integration.test.ts` |
| `components/<Name>.tsx` | `components/__tests__/<Name>.test.tsx` (`@vitest-environment jsdom`) |

Rules:

- Tools take the Supabase client as an argument; unit tests pass `createMockClient` — never a live client.
- Live tests use `describeIntegration` and **reads only**. Seed data: Eleanor Shellstrop exists; Madam Peterson does not.
- Route tests send Basic Auth (`authHeaders()`). Stub `CHAT_BASIC_USER` / `CHAT_BASIC_PASSWORD`.
- Mock `@ai-sdk/openai` and `streamText`; never spend tokens.
- Assert behavior and contracts (status, allow-listed columns, generic `"database query failed"`), not LLM prose.
- Bug fixes: add a test that **fails on the old code** and passes after the fix.

## 3. Run

```powershell
npm test
```

Fix failures you introduced. If a live integration test is skipped, that is expected without `SUPABASE_URL` + `SUPABASE_SECRET_KEY`.

## Additional resources

- File templates, mock chains, and skip patterns: [reference.md](reference.md)
