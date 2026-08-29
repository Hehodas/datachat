# Test templates and conventions

Match existing files. Do not invent a second mock style.

## Unit: mocked Supabase (`lib/__tests__/tools.test.ts`)

```ts
function createChain(result: QueryResult) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    single: vi.fn().mockResolvedValue(result),
    then: (resolve: (value: QueryResult) => void) => Promise.resolve(result).then(resolve),
  };
  return chain;
}

function createMockClient(handlers: Record<string, () => object>) {
  return {
    from: vi.fn((table: string) => {
      const handler = handlers[table];
      if (!handler) {
        throw new Error(`Unexpected table: ${table}`);
      }
      return handler();
    }),
  } as unknown as DataChatSupabaseClient;
}
```

Add chain methods when the production code calls them. Assert `.select(...)` column lists and `.limit(...)` — not `select("*")`.

DB failures: `expect(result.error).toBe("database query failed")` (generic string; do not leak driver messages).

## Integration: live Supabase

```ts
const hasSupabaseEnv =
  Boolean(process.env.SUPABASE_URL) && Boolean(process.env.SUPABASE_SECRET_KEY);

const describeIntegration = hasSupabaseEnv ? describe : describe.skip;

describeIntegration("tools integration (live Supabase)", () => {
  it("…", async () => {
    const client = createServerSupabaseClient();
    // read-only assertions
  });
});
```

Env is loaded from `.env.local` in `vitest.setup.ts`. Do not commit secrets. Do not write/update/delete CRM rows.

## Route: real POST, mocked model

Reuse `authHeaders()`, `userMessage()`, and `createMockStreamResponse` in `app/api/chat/__tests__/route.integration.test.ts`.

```ts
vi.mock("@ai-sdk/openai", () => ({ openai: vi.fn(() => "mock-model") }));
vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return { ...actual, streamText: (...args: unknown[]) => mockStreamText(...args) };
});
```

`beforeEach`: `vi.stubEnv("CHAT_BASIC_USER", "testuser")`, `vi.stubEnv("CHAT_BASIC_PASSWORD", "testpass")`.

Unauthenticated POST → **401**. Invalid body → **400** `"Invalid request"`.

## Component (jsdom)

```tsx
/**
 * @vitest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
```

`vitest.config.ts` already maps `components/**` to jsdom; keep the file pragma. Mock `@ai-sdk/react` `useChat` like `Chat.test.tsx`. Query by role/text, not CSS class.

`scrollIntoView` is stubbed in `vitest.setup.ts`.

## Access / request validation

Copy `lib/__tests__/access.test.ts` and `lib/__tests__/chat-request.test.ts`: `vi.stubEnv` + `vi.unstubAllEnvs()`, exported constants (`RATE_LIMIT_MAX`, `MAX_CHAT_MESSAGES`).

## What not to add

- Playwright / Cypress / browser E2E
- Tests that call the real OpenAI API
- Snapshots of markdown model output
- Tests whose only assertion is that a mock was constructed
- New suites that duplicate an existing `it` title

## Troubleshooting

| Symptom | Cause | What to do |
| --- | --- | --- |
| `document is not defined` | Component test in node env | Add `@vitest-environment jsdom` and put the file under `components/` |
| Live tests skipped in CI | Missing Supabase env | Expected; keep `describe.skip`. Unit tests must still cover the logic |
| Route test 401 | Missing Basic Auth stub | Use `authHeaders()` and stub env in `beforeEach` |
| Tool unit test hits network | Passed real client | Use `createMockClient` only |
