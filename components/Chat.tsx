"use client";

import { useChat } from "@ai-sdk/react";
import { Composer } from "./Composer";
import { MessageList } from "./MessageList";

const EXAMPLE_PROMPTS = [
  "Tell me about Eleanor Shellstrop",
  "Show unpaid invoices",
  "What open incidents do we have?",
];

export function Chat() {
  const { messages, input, handleInputChange, handleSubmit, append, status } = useChat({
    api: "/api/chat",
  });

  const isLoading = status === "submitted" || status === "streaming";
  const isSearching = messages.some(
    (m) =>
      m.role === "assistant" &&
      m.parts?.some((part) => part.type === "tool-invocation"),
  );

  function handleExampleClick(prompt: string) {
    void append({ role: "user", content: prompt });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          <h1 className="text-lg font-semibold tracking-tight text-accent-light">
            DataChat
          </h1>
          <span className="ml-3 text-sm text-muted">CRM database assistant</span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-4">
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
                  onClick={() => handleExampleClick(prompt)}
                  className="rounded-full border border-border bg-surface px-4 py-2 text-sm text-foreground transition hover:border-accent hover:text-accent-light"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <MessageList messages={messages} />
        )}

        {isLoading && isSearching && (
          <div className="py-2 text-center text-sm text-accent-light">
            Searching the database…
          </div>
        )}

        <Composer
          input={input}
          isLoading={isLoading}
          onInputChange={handleInputChange}
          onSubmit={handleSubmit}
        />
      </main>
    </div>
  );
}
