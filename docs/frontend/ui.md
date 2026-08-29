# Frontend UI

Dark navy ChatGPT-style chat, no left sidebar. Accent colors: `#0B1220` background, `#3B82F6` / `#60A5FA` accents.

## Components

| File | Role |
| --- | --- |
| `app/page.tsx` | Renders `<Chat />` |
| `components/Chat.tsx` | Layout, `useChat`, empty state, searching banner, errors |
| `components/MessageList.tsx` | Scrollable bubbles, markdown, streaming cursor |
| `components/Composer.tsx` | Textarea, Send / Stop |

## Chat shell (`Chat.tsx`)

- Uses `useChat()` from `@ai-sdk/react` for messages, `sendMessage`, `status`, `error`, `stop`, `clearError`, `regenerate`.
- Empty state shows example chips that call `submitPrompt`.
- **Searching the database…** when `status` is `submitted`, or streaming with tool parts and no text yet.
- Error bar with **Retry** (`regenerate`) and **Dismiss** (`clearError`).
- Composer receives `onStop={stop}` while busy.

## Message list

- User: right-aligned blue bubble.
- Assistant: left-aligned surface bubble with `ReactMarkdown`.
- Streaming last empty assistant message → pulse cursor.
- Empty finished assistant message → muted fallback text (`EMPTY_ASSISTANT_FALLBACK`).
- Auto-scroll to bottom only if the user is already near the bottom (~120px threshold).

## Composer

- Enter sends (Shift+Enter for newline).
- While loading, **Stop** replaces **Send**.
- Footer note: answers come from Supabase CRM data only.

## Shared helpers (`lib/messages.ts`)

- `getMessageText` — join text parts from a `UIMessage`
- `safeMarkdownUrlTransform` — allow only `http:`, `https:`, `mailto:`
- `EMPTY_ASSISTANT_FALLBACK` — copy when the step limit ends without text
