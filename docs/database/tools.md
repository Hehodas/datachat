# Tools reference

All tools live in `lib/tools.ts`. Each function takes a Supabase client as the first argument so they can be unit-tested with mocks.

## Result shape

```ts
type ToolSuccess<T> = { success: true; data: T };
type ToolFailure = { success: false; error: string };
```

On database errors, tools return `{ success: false, error: "database query failed" }` (details are logged server-side). They do not throw unhandled exceptions into the agent loop.

## Limits

| Constant | Value | Applies to |
| --- | --- | --- |
| `CUSTOMER_SEARCH_LIMIT` | 25 | `searchCustomers` |
| `CHILD_ROW_LIMIT` | 50 | Child tables in dossier / topic search |

When a limit is hit, results may include `truncated: true`.

---

## `searchCustomers(client, { query })`

Searches `customers` by name or email tokens.

**Behavior**

1. Split query into tokens (whitespace; strip punctuation).
2. `ILIKE` on `first_name`, `last_name`, and `email` for each token.
3. Classify each hit as **`full`** or **`partial`** (`classifyCustomerMatch`).
4. Sort full matches first, then by last name / first name.
5. Cap at 25 rows.

**Full vs partial**

- One token: match on first name, last name, or email → `full`.
- Multiple tokens: first+last (or last+first) both match → `full`; otherwise `partial`.

**Success payload**

```json
{
  "query": "Eleanor Shellstrop",
  "matches": [
    {
      "customer": { "id": "...", "first_name": "Eleanor", "last_name": "Shellstrop", "...": "..." },
      "match": "full"
    }
  ]
}
```

Empty or blank query → `{ matches: [] }` without hitting the database.

---

## `getCustomerDossier(client, { customerId })`

Loads one customer plus related rows from six child tables in parallel:

- `subscriptions`
- `invoices`
- `payment_methods`
- `equipment`
- `incidents`
- `interaction_logs`

Each child query uses a fixed column list and `.limit(50)`.

**Failure cases**

- Customer missing → `{ success: false, error: "No customer found with id …" }`
- Any child query error → `{ success: false, error: "database query failed" }`

---

## `searchByTopic(client, { query })`

Cross-table keyword search:

| Table | Fields searched |
| --- | --- |
| `incidents` | `description`, `issue_type` |
| `interaction_logs` | `agent_notes` |
| `subscriptions` | `plan_name`, `service_category` |
| `equipment` | `model_name`, `device_type` |
| `invoices` | `status` |

Uses `ILIKE` with escaped patterns (and quoted PostgREST filter terms where needed). Blank query returns empty arrays for all keys.
