import type { UIMessage } from "ai";

export const EMPTY_ASSISTANT_FALLBACK =
  "I couldn't produce a text reply for this turn (for example, the step limit was reached after tool calls). Ask a follow-up or try again.";

export function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");
}

/** Allow only http:, https:, and mailto: links. Do not enable rehype-raw. */
export function safeMarkdownUrlTransform(url: string): string {
  const trimmed = url.trim();
  const colon = trimmed.indexOf(":");
  if (colon === -1) {
    return "";
  }
  const protocol = trimmed.slice(0, colon + 1).toLowerCase();
  if (protocol === "http:" || protocol === "https:" || protocol === "mailto:") {
    return trimmed;
  }
  return "";
}
