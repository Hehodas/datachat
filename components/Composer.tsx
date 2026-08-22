"use client";

import type { ChangeEvent, FormEvent } from "react";

type ComposerProps = {
  input: string;
  isLoading: boolean;
  onInputChange: (event: ChangeEvent<HTMLInputElement> | ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function Composer({ input, isLoading, onInputChange, onSubmit }: ComposerProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="sticky bottom-0 border-t border-border bg-background pt-4"
    >
      <div className="flex items-end gap-3 rounded-2xl border border-border bg-surface p-2 shadow-lg">
        <textarea
          value={input}
          onChange={onInputChange}
          placeholder="Ask about a customer or topic…"
          rows={1}
          disabled={isLoading}
          className="max-h-32 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none disabled:opacity-50"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-light disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "…" : "Send"}
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-muted">
        Answers are generated from Supabase CRM data only.
      </p>
    </form>
  );
}
