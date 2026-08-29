# POST /api/chat

Streaming chat endpoint. The browser should use `@ai-sdk/react` `useChat` (default transport hits this path). Manual clients must send Basic Auth and a UI-message-shaped body.

## Authentication

```http
Authorization: Basic <base64(user:password)>
Content-Type: application/json
```

Missing or wrong credentials → **401** with `WWW-Authenticate: Basic realm="DataChat"`.

Also subject to the ~20 req/min IP rate limit → **429**.

## Request body

```json
{
  "messages": [
    {
      "id": "user-1",
      "role": "user",
      "parts": [{ "type": "text", "text": "Tell me about Eleanor Shellstrop" }]
    }
  ]
}
```

| Constraint | Value |
| --- | --- |
| Messages | 1–20 |
| Roles | `user` or `assistant` |
| Text length | ≤ 8000 per text part |
| Parts per message | ≤ 64 |

`parseChatRequest` strips non-text parts before conversion to model messages. If no usable text remains → **400**.

## Processing

1. `enforceChatAccess`
2. Parse JSON
3. `parseChatRequest`
4. Create Supabase client
5. `convertToModelMessages`
6. `streamText` with GPT-4o, system prompt, three tools, `stopWhen: stepCountIs(5)`
7. Return `toUIMessageStreamResponse()`

`maxDuration` is **60** seconds.

## Response

- **200** — UI message stream (AI SDK protocol). Tokens and tool activity are streamed to the client.
- **400** — `{ "error": "Invalid request" }` (bad JSON, schema, or convert failure)
- **401** — Unauthorized
- **429** — Too many requests
- **500** — `{ "error": "Internal server error" }` (client creation or `streamText` setup failure)

Stream runtime errors are logged via `onError`; the client may show the generic error + Retry UI.

## Tools exposed to the model

| Name | Input |
| --- | --- |
| `searchCustomers` | `{ query: string }` |
| `getCustomerDossier` | `{ customerId: string }` (UUID) |
| `searchByTopic` | `{ query: string }` |

Tool implementations: [Tools reference](../database/tools.md).
