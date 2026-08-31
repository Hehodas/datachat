/**
 * @vitest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseChat = vi.fn();

vi.mock("@ai-sdk/react", () => ({
  useChat: () => mockUseChat(),
}));

import { Chat } from "../Chat";

describe("Chat", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;

    mockUseChat.mockReturnValue({
      messages: [{ id: "user-1", role: "user", parts: [{ type: "text", text: "Hi" }] }],
      sendMessage: vi.fn(),
      status: "streaming",
      error: null,
      stop: vi.fn(),
      clearError: vi.fn(),
      regenerate: vi.fn(),
    });
  });

  it("shows Stop button while busy", () => {
    render(<Chat />);
    expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument();
  });

  it("defaults to dark-blue theme", async () => {
    render(<Chat />);

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("dark-blue");
    });
    expect(screen.getByRole("radio", { name: "Dark Blue" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(window.localStorage.getItem("datachat-theme")).toBeNull();
  });

  it("restores a persisted theme from localStorage", async () => {
    window.localStorage.setItem("datachat-theme", "light");

    render(<Chat />);

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("light");
    });
    expect(screen.getByRole("radio", { name: "Light" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("updates and clears localStorage as theme changes", async () => {
    render(<Chat />);

    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("dark");
    });
    expect(window.localStorage.getItem("datachat-theme")).toBe("dark");

    fireEvent.click(screen.getByRole("radio", { name: "Dark Blue" }));
    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("dark-blue");
    });
    expect(window.localStorage.getItem("datachat-theme")).toBeNull();
  });
});
