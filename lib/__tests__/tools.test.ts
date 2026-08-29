import { describe, expect, it, vi } from "vitest";
import {
  classifyCustomerMatch,
  escapeIlike,
  getCustomerDossier,
  quoteIlikeTerm,
  searchByTopic,
  searchCustomers,
  searchTokens,
  type Customer,
} from "../tools";
import type { DataChatSupabaseClient } from "../supabase";

type QueryResult = { data: unknown; error: { message: string } | null };

function createChain(result: QueryResult) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
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

const eleanor: Customer = {
  id: "cust-1",
  first_name: "Eleanor",
  last_name: "Shellstrop",
  email: "eleanor@example.com",
  phone_number: "555-0100",
  address: "123 Main St",
  created_at: "2024-01-01T00:00:00Z",
};

describe("escapeIlike and quoteIlikeTerm", () => {
  it("escapes % and _ wildcards", () => {
    expect(escapeIlike("100%")).toBe("100\\%");
    expect(escapeIlike("a_b")).toBe("a\\_b");
    expect(quoteIlikeTerm("100%")).toBe('"%100\\%%"');
  });

  it("keeps apostrophes in quoted terms", () => {
    expect(quoteIlikeTerm("O'Brien")).toBe("\"%O'Brien%\"");
  });
});

describe("searchTokens", () => {
  it("keeps apostrophes and hyphens inside tokens", () => {
    expect(searchTokens("O'Brien-Smith")).toEqual(["O'Brien-Smith"]);
  });
});

describe("classifyCustomerMatch", () => {
  it("does not throw when customer names are null", () => {
    const customer = {
      ...eleanor,
      first_name: null as unknown as string,
      last_name: null as unknown as string,
      email: null as unknown as string,
    };
    expect(classifyCustomerMatch(customer, ["Eleanor"])).toBe("partial");
  });
});

describe("searchCustomers", () => {
  it("returns matching rows for a name", async () => {
    const chain = createChain({ data: [eleanor], error: null });
    const client = createMockClient({ customers: () => chain });

    const result = await searchCustomers(client, { query: "Shellstrop" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.matches).toHaveLength(1);
      expect(result.data.matches[0].match).toBe("full");
    }
    expect(chain.select).toHaveBeenCalledWith(
      "id, first_name, last_name, email, phone_number, address, created_at",
    );
    expect(chain.limit).toHaveBeenCalledWith(25);
    expect(client.from).toHaveBeenCalledTimes(1);
  });

  it("uses quoted .or() filters for injection-like tokens", async () => {
    const chain = createChain({ data: [], error: null });
    const client = createMockClient({ customers: () => chain });

    await searchCustomers(client, { query: "unpaid,customer_id.not.is.null" });

    const orArg = chain.or.mock.calls[0]?.[0] as string;
    expect(orArg).toContain('"%unpaid,customer\\_id.not.is.null%"');
    expect(orArg.split("first_name.ilike.").length - 1).toBe(1);
  });

  it("returns generic database error string", async () => {
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
      expect(result.error).toBe("database query failed");
    }
  });

  it("sets truncated when result size equals limit", async () => {
    const rows = Array.from({ length: 25 }, (_, index) => ({
      ...eleanor,
      id: `cust-${index}`,
    }));
    const client = createMockClient({
      customers: () => createChain({ data: rows, error: null }),
    });

    const result = await searchCustomers(client, { query: "Shell" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.truncated).toBe(true);
    }
  });

  it("returns an empty list without querying when the search string is blank", async () => {
    const client = createMockClient({});
    const result = await searchCustomers(client, { query: "   " });

    expect(result.success).toBe(true);
    expect(client.from).not.toHaveBeenCalled();
  });
});

describe("getCustomerDossier", () => {
  it("assembles customer and child tables with allow-listed columns", async () => {
    const selectCalls: Array<{ table: string; columns: string }> = [];

    function trackSelect(table: string) {
      const chain = createChain({
        data: table === "subscriptions"
          ? [{ id: "sub-1", plan_name: "Premium" }]
          : table === "invoices"
            ? [{ id: "inv-1", status: "paid" }]
            : [],
        error: null,
      });
      chain.select = vi.fn((cols: string) => {
        selectCalls.push({ table, columns: cols });
        return chain;
      });
      return chain;
    }

    const client = createMockClient({
      customers: () => ({
        select: vi.fn((cols: string) => {
          selectCalls.push({ table: "customers", columns: cols });
          return {
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: eleanor, error: null }),
          };
        }),
      }),
      subscriptions: () => trackSelect("subscriptions"),
      invoices: () => trackSelect("invoices"),
      payment_methods: () => trackSelect("payment_methods"),
      equipment: () => trackSelect("equipment"),
      incidents: () => trackSelect("incidents"),
      interaction_logs: () => trackSelect("interaction_logs"),
    });

    const result = await getCustomerDossier(client, { customerId: "cust-1" });

    expect(result.success).toBe(true);
    expect(selectCalls.some((call) => call.table === "payment_methods" && call.columns === "provider, payment_type, last_four_digits, is_default")).toBe(true);
    expect(selectCalls.every((call) => call.columns !== "*")).toBe(true);
  });

  it("returns generic database error for child table failures", async () => {
    const client = createMockClient({
      customers: () => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: eleanor, error: null }),
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
      expect(result.error).toBe("database query failed");
    }
  });
});

describe("searchByTopic", () => {
  it("queries expected tables with quoted filters and limits", async () => {
    const incidentsChain = createChain({
      data: [{ id: "inc-1", issue_type: "outage" }],
      error: null,
    });
    const client = createMockClient({
      incidents: () => incidentsChain,
      interaction_logs: () => createChain({ data: [], error: null }),
      subscriptions: () => createChain({ data: [{ id: "sub-1", plan_name: "Fiber 100" }], error: null }),
      equipment: () => createChain({ data: [], error: null }),
      invoices: () => createChain({ data: [{ id: "inv-1", status: "unpaid" }], error: null }),
    });

    const result = await searchByTopic(client, { query: "unpaid" });

    expect(result.success).toBe(true);
    const orArg = incidentsChain.or.mock.calls[0]?.[0] as string;
    expect(orArg).toContain('"%unpaid%"');
    expect(incidentsChain.select).toHaveBeenCalledWith(
      "id, customer_id, issue_type, description, status, created_at, resolved_at",
    );
    expect(incidentsChain.limit).toHaveBeenCalledWith(50);
    expect(incidentsChain.select).not.toHaveBeenCalledWith("*");
  });

  it("quotes comma/parenthesis injection topics", async () => {
    const incidentsChain = createChain({ data: [], error: null });
    const client = createMockClient({
      incidents: () => incidentsChain,
      interaction_logs: () => createChain({ data: [], error: null }),
      subscriptions: () => createChain({ data: [], error: null }),
      equipment: () => createChain({ data: [], error: null }),
      invoices: () => createChain({ data: [], error: null }),
    });

    await searchByTopic(client, { query: "unpaid,customer_id.not.is.null" });

    const orArg = incidentsChain.or.mock.calls[0]?.[0] as string;
    expect(orArg).toContain('"%unpaid,customer\\_id.not.is.null%"');
  });

  it("returns generic database error string", async () => {
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
      expect(result.error).toBe("database query failed");
    }
  });
});
