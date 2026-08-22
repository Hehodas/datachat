import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSearchCustomers = vi.fn();
const mockGetCustomerDossier = vi.fn();
const mockSearchByTopic = vi.fn();
const mockStreamText = vi.fn();
const mockCreateServerSupabaseClient = vi.fn();

vi.mock("@/lib/supabase", () => ({
  createServerSupabaseClient: () => mockCreateServerSupabaseClient(),
}));

vi.mock("@/lib/tools", () => ({
  searchCustomers: (...args: unknown[]) => mockSearchCustomers(...args),
  getCustomerDossier: (...args: unknown[]) => mockGetCustomerDossier(...args),
  searchByTopic: (...args: unknown[]) => mockSearchByTopic(...args),
}));

vi.mock("@ai-sdk/openai", () => ({
  openai: vi.fn(() => "mock-model"),
}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    streamText: (...args: unknown[]) => mockStreamText(...args),
  };
});

import { POST } from "../route";

function createMockStreamResponse(text: string) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`0:${JSON.stringify(text)}\n`));
      controller.close();
    },
  });

  return {
    toDataStreamResponse: () =>
      new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      }),
  };
}

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateServerSupabaseClient.mockReturnValue({ from: vi.fn() });
  });

  it("returns 400 when messages are missing", async () => {
    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Missing messages");
  });

  it("streams 200 and invokes searchCustomers then getCustomerDossier", async () => {
    mockSearchCustomers.mockResolvedValue({
      success: true,
      data: [{ id: "cust-1", first_name: "Eleanor", last_name: "Shellstrop" }],
    });
    mockGetCustomerDossier.mockResolvedValue({
      success: true,
      data: {
        customer: { id: "cust-1", first_name: "Eleanor", last_name: "Shellstrop" },
        subscriptions: [],
        invoices: [],
        payment_methods: [],
        equipment: [],
        incidents: [],
        interaction_logs: [],
      },
    });

    let capturedTools: Record<string, { execute: (args: unknown) => Promise<unknown> }> = {};

    mockStreamText.mockImplementation(({ tools }) => {
      capturedTools = tools;
      return createMockStreamResponse("Summary for Eleanor Shellstrop.");
    });

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Tell me about Eleanor" }],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mockStreamText).toHaveBeenCalledOnce();

    await capturedTools.searchCustomers.execute({ query: "Eleanor" });
    expect(mockSearchCustomers).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ query: "Eleanor" }),
    );

    await capturedTools.getCustomerDossier.execute({ customerId: "cust-1" });
    expect(mockGetCustomerDossier).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ customerId: "cust-1" }),
    );

    const text = await response.text();
    expect(text).toContain("Eleanor Shellstrop");
  });

  it("handles no-match path with 200 and empty search results", async () => {
    mockSearchCustomers.mockResolvedValue({ success: true, data: [] });

    let capturedTools: Record<string, { execute: (args: unknown) => Promise<unknown> }> = {};

    mockStreamText.mockImplementation(({ tools }) => {
      capturedTools = tools;
      return createMockStreamResponse("No matching records were found.");
    });

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Find Madam Peterson" }],
        }),
      }),
    );

    expect(response.status).toBe(200);

    const searchResult = await capturedTools.searchCustomers.execute({ query: "Peterson" });
    expect(searchResult).toEqual({ success: true, data: [] });

    const text = await response.text();
    expect(text).toContain("No matching records were found");
  });
});
