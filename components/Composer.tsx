"use client";

type ComposerProps = {
  input: string;
  isLoading: boolean;
  onInputChange: (value: string) => void;
  onSubmit: (value: string) => void;
};

export function Composer({ input, isLoading, onInputChange, onSubmit }: ComposerProps) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(input);
      }}
      className="sticky bottom-0 shrink-0 border-t border-border bg-background pt-4 pb-4"
    >
      <div className="flex items-end gap-3 rounded-2xl border border-border bg-surface p-2 shadow-lg">
        <textarea
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder="Ask about a customer or topic…"
          rows={1}
          disabled={isLoading}
          aria-label="Message"
          className="max-h-32 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none disabled:opacity-50"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSubmit(input);
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
