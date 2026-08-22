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

type ExecutableTool = {
  execute: (input: Record<string, unknown>) => Promise<unknown>;
};

function userMessage(text: string) {
  return {
    id: "user-1",
    role: "user" as const,
    parts: [{ type: "text" as const, text }],
  };
}

function createMockStreamResponse(text: string, beforeStream?: () => Promise<void>) {
  const encoder = new TextEncoder();

  return {
    toUIMessageStreamResponse: () =>
      new Response(
        new ReadableStream({
          async start(controller) {
            if (beforeStream) {
              await beforeStream();
            }
            controller.enqueue(encoder.encode(text));
            controller.close();
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        },
      ),
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

    mockStreamText.mockImplementation(({ tools }: { tools: Record<string, ExecutableTool> }) =>
      createMockStreamResponse("Summary for Eleanor Shellstrop.", async () => {
        await tools.searchCustomers.execute({ query: "Eleanor" });
        await tools.getCustomerDossier.execute({ customerId: "cust-1" });
      }),
    );

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [userMessage("Tell me about Eleanor")],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mockStreamText).toHaveBeenCalledOnce();

    const text = await response.text();
    expect(text).toContain("Eleanor Shellstrop");
    expect(mockSearchCustomers).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ query: "Eleanor" }),
    );
    expect(mockGetCustomerDossier).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ customerId: "cust-1" }),
    );
  });

  it("handles no-match path with 200 and empty search results", async () => {
    mockSearchCustomers.mockResolvedValue({ success: true, data: [] });

    mockStreamText.mockImplementation(({ tools }: { tools: Record<string, ExecutableTool> }) =>
      createMockStreamResponse("No matching records were found.", async () => {
        const searchResult = await tools.searchCustomers.execute({ query: "Peterson" });
        expect(searchResult).toEqual({ success: true, data: [] });
      }),
    );

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [userMessage("Find Madam Peterson")],
        }),
      }),
    );

    expect(response.status).toBe(200);

    const text = await response.text();
    expect(text).toContain("No matching records were found");
    expect(mockSearchCustomers).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ query: "Peterson" }),
    );
  });
});
