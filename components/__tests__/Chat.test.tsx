/**
 * @vitest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseChat = vi.fn();

vi.mock("@ai-sdk/react", () => ({
  useChat: () => mockUseChat(),
}));

import { Chat } from "../Chat";

describe("Chat", () => {
  beforeEach(() => {
    mockUseChat.mockReturnValue({
      messages: [{ id: "user-1", role: "user", parts: [{ type: "text", text: "Hi" }] }],
      sendMessage: vi.fn(),
      status: "streaming",
      error: null,
      stop: vi.fn(),
    });
  });

  it("shows Stop button while busy", () => {
    render(<Chat />);
    expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument();
  });
});
