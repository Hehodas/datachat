import { describe, expect, it, vi } from "vitest";
import {
  getCustomerDossier,
  searchByTopic,
  searchCustomers,
} from "../tools";
import type { DataChatSupabaseClient } from "../supabase";

type QueryResult = { data: unknown; error: { message: string } | null };

function createChain(result: QueryResult) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    single: vi.fn().mockResolvedValue(result),
    then: (resolve: (value: QueryResult) => void) => Promise.resolve(result).then(resolve),
  };
  return chain;
}

function createMockClient(handlers: Record<string, () => object>) {
  return {
    from: vi.fn((table: string) => {
      const handler = handlers[table];
      if (!handler) {
        throw new Error(`Unexpected table: ${table}`);
      }
      return handler();
    }),
  } as unknown as DataChatSupabaseClient;
}

describe("searchCustomers", () => {
  it("returns matching rows for a name", async () => {
    const eleanor = {
      id: "cust-1",
      first_name: "Eleanor",
      last_name: "Shellstrop",
      email: "eleanor@example.com",
      phone_number: "555-0100",
      address: "123 Main St",
      created_at: "2024-01-01T00:00:00Z",
    };

    const client = createMockClient({
      customers: () =>
        createChain({
          data: [eleanor],
          error: null,
        }),
    });

    const result = await searchCustomers(client, { query: "Shellstrop" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.matches).toHaveLength(1);
      expect(result.data.matches[0].customer.last_name).toBe("Shellstrop");
      expect(result.data.matches[0].match).toBe("full");
    }
  });

  it("returns an empty list when nothing matches (Madam Peterson)", async () => {
    const client = createMockClient({
      customers: () =>
        createChain({
          data: [],
          error: null,
        }),
    });

    const result = await searchCustomers(client, { query: "Peterson" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.matches).toEqual([]);
    }
  });

  it("finds a customer when the query is a full first and last name", async () => {
    const eleanor = {
      id: "cust-1",
      first_name: "Eleanor",
      last_name: "Shellstrop",
      email: "eleanor@example.com",
      phone_number: "555-0100",
      address: "123 Main St",
      created_at: "2024-01-01T00:00:00Z",
    };

    const client = createMockClient({
      customers: () =>
        createChain({
          data: [eleanor],
          error: null,
        }),
    });

    const result = await searchCustomers(client, { query: "Eleanor Shellstrop" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.matches).toHaveLength(1);
      expect(result.data.matches[0].customer.first_name).toBe("Eleanor");
      expect(result.data.matches[0].match).toBe("full");
    }
    expect(client.from).toHaveBeenCalled();
  });

  it("marks a last-name-only hit as partial when the query includes a different first name", async () => {
    const eleanor = {
      id: "cust-1",
      first_name: "Eleanor",
      last_name: "Shellstrop",
      email: "eleanor@example.com",
      phone_number: "555-0100",
      address: "123 Main St",
      created_at: "2024-01-01T00:00:00Z",
    };

    const client = createMockClient({
      customers: () =>
        createChain({
          data: [eleanor],
          error: null,
        }),
    });

    const result = await searchCustomers(client, { query: "Tahani Shellstrop" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.matches[0].match).toBe("partial");
    }
  });

  it("returns structured failure on database error", async () => {
    const client = createMockClient({
      customers: () =>
        createChain({
          data: null,
          error: { message: "connection failed" },
        }),
    });

    const result = await searchCustomers(client, { query: "Eleanor" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("connection failed");
    }
  });

  it("returns an empty list without querying when the search string is blank", async () => {
    const client = createMockClient({});
    const result = await searchCustomers(client, { query: "   " });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.matches).toEqual([]);
    }
    expect(client.from).not.toHaveBeenCalled();
  });
});

describe("getCustomerDossier", () => {
  const customer = {
    id: "cust-1",
    first_name: "Eleanor",
    last_name: "Shellstrop",
    email: "eleanor@example.com",
    phone_number: "555-0100",
    address: "123 Main St",
    created_at: "2024-01-01T00:00:00Z",
  };

  it("assembles customer and child tables", async () => {
    const client = createMockClient({
      customers: () => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: customer, error: null }),
      }),
      subscriptions: () =>
        createChain({ data: [{ id: "sub-1", plan_name: "Premium" }], error: null }),
      invoices: () =>
        createChain({ data: [{ id: "inv-1", status: "paid" }], error: null }),
      payment_methods: () => createChain({ data: [], error: null }),
      equipment: () => createChain({ data: [], error: null }),
      incidents: () => createChain({ data: [], error: null }),
      interaction_logs: () => createChain({ data: [], error: null }),
    });

    const result = await getCustomerDossier(client, { customerId: "cust-1" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customer.last_name).toBe("Shellstrop");
      expect(result.data.subscriptions).toHaveLength(1);
      expect(result.data.invoices).toHaveLength(1);
    }
  });

  it("reports not-found for an unknown id", async () => {
    const client = createMockClient({
      customers: () => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });

    const result = await getCustomerDossier(client, { customerId: "missing-id" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("No customer found");
    }
  });

  it("returns structured failure on child table error", async () => {
    const client = createMockClient({
      customers: () => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: customer, error: null }),
      }),
      subscriptions: () =>
        createChain({ data: null, error: { message: "timeout" } }),
      invoices: () => createChain({ data: [], error: null }),
      payment_methods: () => createChain({ data: [], error: null }),
      equipment: () => createChain({ data: [], error: null }),
      incidents: () => createChain({ data: [], error: null }),
      interaction_logs: () => createChain({ data: [], error: null }),
    });

    const result = await getCustomerDossier(client, { customerId: "cust-1" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("subscriptions");
    }
  });
});

describe("searchByTopic", () => {
  it("queries expected tables and merges results", async () => {
    const client = createMockClient({
      incidents: () =>
        createChain({ data: [{ id: "inc-1", issue_type: "outage" }], error: null }),
      interaction_logs: () => createChain({ data: [], error: null }),
      subscriptions: () =>
        createChain({ data: [{ id: "sub-1", plan_name: "Fiber 100" }], error: null }),
      equipment: () => createChain({ data: [], error: null }),
      invoices: () =>
        createChain({ data: [{ id: "inv-1", status: "unpaid" }], error: null }),
    });

    const result = await searchByTopic(client, { query: "unpaid" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.incidents).toHaveLength(1);
      expect(result.data.subscriptions).toHaveLength(1);
      expect(result.data.invoices).toHaveLength(1);
    }

    expect(client.from).toHaveBeenCalledWith("incidents");
    expect(client.from).toHaveBeenCalledWith("interaction_logs");
    expect(client.from).toHaveBeenCalledWith("subscriptions");
    expect(client.from).toHaveBeenCalledWith("equipment");
    expect(client.from).toHaveBeenCalledWith("invoices");
  });

  it("returns structured failure on database error", async () => {
    const client = createMockClient({
      incidents: () =>
        createChain({ data: null, error: { message: "permission denied" } }),
      interaction_logs: () => createChain({ data: [], error: null }),
      subscriptions: () => createChain({ data: [], error: null }),
      equipment: () => createChain({ data: [], error: null }),
      invoices: () => createChain({ data: [], error: null }),
    });

    const result = await searchByTopic(client, { query: "fiber" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("incidents");
    }
  });
});
