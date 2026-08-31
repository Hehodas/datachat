"use client";

import { useChat } from "@ai-sdk/react";
import { isToolOrDynamicToolUIPart } from "ai";
import { useEffect, useMemo, useState } from "react";
import { getMessageText } from "@/lib/messages";
import { Composer } from "./Composer";
import { MessageList } from "./MessageList";

const EXAMPLE_PROMPTS = [
  "Tell me about Eleanor Shellstrop",
  "Show unpaid invoices",
  "What open incidents do we have?",
];

const THEME_STORAGE_KEY = "datachat-theme";
const DEFAULT_THEME = "dark-blue";
const THEMES = [
  { value: "dark-blue", label: "Dark Blue" },
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
] as const;

type ThemeName = (typeof THEMES)[number]["value"];

function isThemeName(value: string): value is ThemeName {
  return THEMES.some((theme) => theme.value === value);
}

export function Chat() {
  const { messages, sendMessage, status, error, stop, clearError, regenerate } =
    useChat();
  const [input, setInput] = useState("");
  const [theme, setTheme] = useState<ThemeName>(DEFAULT_THEME);

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

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && isThemeName(stored)) {
      setTheme(stored);
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function submitPrompt(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isBusy) {
      return;
    }
    clearError();
    void sendMessage({ text: trimmed });
    setInput("");
  }

  return (
    <div className="flex h-screen bg-background">
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-surface-elevated px-4 py-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Appearance
        </h2>
        <div className="mt-4 flex flex-col gap-2" role="radiogroup" aria-label="Theme">
          {THEMES.map((themeOption) => {
            const isActive = theme === themeOption.value;
            return (
              <button
                key={themeOption.value}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => {
                  setTheme(themeOption.value);
                  if (themeOption.value === DEFAULT_THEME) {
                    window.localStorage.removeItem(THEME_STORAGE_KEY);
                    return;
                  }
                  window.localStorage.setItem(THEME_STORAGE_KEY, themeOption.value);
                }}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                  isActive
                    ? "border-accent bg-accent/10 text-accent-light"
                    : "border-border text-foreground hover:border-accent hover:text-accent-light"
                }`}
              >
                {themeOption.label}
              </button>
            );
          })}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
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
            <div className="flex items-center justify-center gap-3 pb-2 text-sm text-red-400">
              <span>Something went wrong. Please try again.</span>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => {
                  void regenerate();
                }}
                className="rounded-md border border-red-400/40 px-2 py-1 text-red-300 transition hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => clearError()}
                className="rounded-md border border-red-400/40 px-2 py-1 text-red-300 transition hover:bg-red-400/10"
              >
                Dismiss
              </button>
            </div>
          )}

          <Composer
            input={input}
            isLoading={isBusy}
            onInputChange={setInput}
            onSubmit={submitPrompt}
            onStop={stop}
          />
        </main>
      </div>
    </div>
  );
}
