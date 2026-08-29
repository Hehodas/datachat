/**
 * @vitest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { UIMessage } from "ai";
import { EMPTY_ASSISTANT_FALLBACK } from "@/lib/messages";
import { MessageList } from "../MessageList";

describe("MessageList", () => {
  it("shows fallback copy for completed assistant messages without text", () => {
    const messages: UIMessage[] = [
      {
        id: "assistant-1",
        role: "assistant",
        parts: [{ type: "tool-result", toolCallId: "1", output: {} } as never],
      },
    ];

    render(<MessageList messages={messages} isStreaming={false} />);

    expect(screen.getByText(EMPTY_ASSISTANT_FALLBACK)).toBeInTheDocument();
  });
});
