"use client";

import { useChat } from "@ai-sdk/react";
import { isToolOrDynamicToolUIPart, type UIMessage } from "ai";
import { useMemo, useState } from "react";
import { Composer } from "./Composer";
import { MessageList } from "./MessageList";

const EXAMPLE_PROMPTS = [
  "Tell me about Eleanor Shellstrop",
  "Show unpaid invoices",
  "What open incidents do we have?",
];

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export function Chat() {
  const { messages, sendMessage, status, error } = useChat();
  const [input, setInput] = useState("");

  const isBusy = status === "submitted" || status === "streaming";

  const isSearching = useMemo(() => {
    if (status === "submitted") {
      return true;
    }

    if (status !== "streaming") {
      return false;
    }

    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") {
      return true;
    }

    const hasTools = last.parts.some((part) => isToolOrDynamicToolUIPart(part));
    return hasTools && getMessageText(last).trim().length === 0;
  }, [messages, status]);

  function submitPrompt(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isBusy) {
      return;
    }
    void sendMessage({ text: trimmed });
    setInput("");
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="shrink-0 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          <h1 className="text-lg font-semibold tracking-tight text-accent-light">
            DataChat
          </h1>
          <span className="ml-3 text-sm text-muted">CRM database assistant</span>
        </div>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-4">
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
            <div className="mb-2 text-2xl font-semibold text-foreground">
              Ask about your customers
            </div>
            <p className="mb-8 max-w-md text-muted">
              Search the CRM by name or topic. DataChat queries Supabase and
              summarizes subscriptions, invoices, equipment, and support history.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {EXAMPLE_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => submitPrompt(prompt)}
                  className="rounded-full border border-border bg-surface px-4 py-2 text-sm text-foreground transition hover:border-accent hover:text-accent-light"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <MessageList messages={messages} isStreaming={status === "streaming"} />
        )}

        {isSearching && (
          <div className="py-2 text-center text-sm text-accent-light">
            Searching the database…
          </div>
        )}

        {error && (
          <div className="pb-2 text-center text-sm text-red-400">
            Something went wrong. Please try again.
          </div>
        )}

        <Composer
          input={input}
          isLoading={isBusy}
          onInputChange={setInput}
          onSubmit={submitPrompt}
        />
      </main>
    </div>
  );
}
