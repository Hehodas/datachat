# Data freshness

## Short answer

**No — DataChat does not subscribe to live Supabase changes.**

There is no Supabase Realtime usage in the app (no `channel`, `subscribe`, or `postgres_changes` listeners). Queries are **request-driven**.

## What that means

| Scenario | Behavior |
| --- | --- |
| CRM edited while you read an old answer | **No change.** That answer is already rendered in React state. |
| You ask a **new** question after a DB edit | **Fresh data.** Tools run new SELECTs at request time. |
| Someone edits the DB mid-stream | You get a **point-in-time snapshot** from when each tool ran. |
| Polling / websockets | **Not used.** |

## What is cached

The only server-side cache is the **Supabase client instance** in `lib/supabase.ts` (connection/config reuse). Query results are **not** cached across requests.

## Conversation history

Chat messages live only in the browser via `useChat`. Reloading the page clears the conversation. Past summaries are not re-queried automatically.

## If you need live updates later

Possible approaches (not implemented):

- Supabase Realtime on CRM tables + UI toast / “data changed — ask again”
- Periodic re-fetch of a pinned customer dossier
- Explicit “Refresh” that re-runs tools for the last question

For the current product, “ask again” is the intended way to see updated CRM state.
