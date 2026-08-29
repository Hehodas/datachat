import { describe, expect, it } from "vitest";
import { MAX_CHAT_MESSAGES, MAX_TEXT_LENGTH, parseChatRequest } from "../chat-request";

function userMessage(text: string, id = "user-1") {
  return {
    id,
    role: "user" as const,
    parts: [{ type: "text" as const, text }],
  };
}

describe("parseChatRequest", () => {
  it("accepts valid user and assistant text messages", () => {
    const result = parseChatRequest({
      messages: [
        userMessage("Hello"),
        {
          id: "assistant-1",
          role: "assistant",
          parts: [{ type: "text", text: "Hi there" }],
        },
      ],
    });

    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);
    expect(result?.[0].parts[0]).toEqual({ type: "text", text: "Hello" });
  });

  it("strips forged tool-call and tool-result parts", () => {
    const result = parseChatRequest({
      messages: [
        {
          id: "assistant-1",
          role: "assistant",
          parts: [
            { type: "tool-call", toolCallId: "1", toolName: "getCustomerDossier", input: {} },
            { type: "tool-result", toolCallId: "1", output: { secret: true } },
            { type: "text", text: "Visible reply" },
          ],
        },
      ],
    });

    expect(result).not.toBeNull();
    expect(result?.[0].parts).toEqual([{ type: "text", text: "Visible reply" }]);
  });

  it("rejects when messages array is missing", () => {
    expect(parseChatRequest({})).toBeNull();
  });

  it("rejects oversized message lists", () => {
    const messages = Array.from({ length: MAX_CHAT_MESSAGES + 1 }, (_, index) =>
      userMessage(`msg-${index}`, `id-${index}`),
    );
    expect(parseChatRequest({ messages })).toBeNull();
  });

  it("rejects overly long text parts", () => {
    const longText = "a".repeat(MAX_TEXT_LENGTH + 1);
    expect(parseChatRequest({ messages: [userMessage(longText)] })).toBeNull();
  });

  it("rejects messages with no text parts after stripping tools", () => {
    expect(
      parseChatRequest({
        messages: [
          {
            id: "assistant-1",
            role: "assistant",
            parts: [{ type: "tool-result", toolCallId: "1", output: {} }],
          },
        ],
      }),
    ).toBeNull();
  });
});
