import type { DataChatSupabaseClient } from "./supabase";

export type ToolSuccess<T> = { success: true; data: T };
export type ToolFailure = { success: false; error: string };
export type ToolResult<T> = ToolSuccess<T> | ToolFailure;

export type Customer = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
  address: string | null;
  created_at: string | null;
};

export type CustomerDossier = {
  customer: Customer;
  subscriptions: Record<string, unknown>[];
  invoices: Record<string, unknown>[];
  payment_methods: Record<string, unknown>[];
  equipment: Record<string, unknown>[];
  incidents: Record<string, unknown>[];
  interaction_logs: Record<string, unknown>[];
};

export type TopicSearchResults = {
  incidents: Record<string, unknown>[];
  interaction_logs: Record<string, unknown>[];
  subscriptions: Record<string, unknown>[];
  equipment: Record<string, unknown>[];
  invoices: Record<string, unknown>[];
};

const CUSTOMER_COLUMNS =
  "id, first_name, last_name, email, phone_number, address, created_at";

export type CustomerMatchQuality = "full" | "partial";

export type CustomerSearchHit = {
  customer: Customer;
  match: CustomerMatchQuality;
};

export type CustomerSearchResult = {
  query: string;
  matches: CustomerSearchHit[];
};

function ilikePattern(query: string): string {
  return `%${query}%`;
}

function searchTokens(query: string): string[] {
  return query
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/[.,;:'"]/g, ""))
    .filter((token) => token.length > 0);
}

function quoteIlikeTerm(term: string): string {
  const escaped = term.replace(/\\/g, "\\\\").replace(/[%_]/g, "\\$&").replace(/"/g, "");
  return `"%${escaped}%"`;
}

function orFilterForTerms(terms: string[]): string {
  return terms
    .flatMap((term) => {
      const pattern = quoteIlikeTerm(term);
      return [
        `first_name.ilike.${pattern}`,
        `last_name.ilike.${pattern}`,
        `email.ilike.${pattern}`,
      ];
    })
    .join(",");
}

function containsInsensitive(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export function classifyCustomerMatch(
  customer: Customer,
  tokens: string[],
): CustomerMatchQuality {
  if (tokens.length === 0) {
    return "partial";
  }

  if (tokens.length === 1) {
    const token = tokens[0];
    const email = customer.email ?? "";
    if (
      containsInsensitive(customer.first_name, token) ||
      containsInsensitive(customer.last_name, token) ||
      containsInsensitive(email, token)
    ) {
      return "full";
    }
    return "partial";
  }

  const firstToken = tokens[0];
  const lastToken = tokens[tokens.length - 1];
  const firstThenLast =
    containsInsensitive(customer.first_name, firstToken) &&
    containsInsensitive(customer.last_name, lastToken);
  const lastThenFirst =
    containsInsensitive(customer.first_name, lastToken) &&
    containsInsensitive(customer.last_name, firstToken);

  return firstThenLast || lastThenFirst ? "full" : "partial";
}

function firstLastPairs(tokens: string[]): Array<[string, string]> {
  if (tokens.length < 2) {
    return [];
  }

  const pairs = new Map<string, [string, string]>();
  const add = (first: string, last: string) => {
    pairs.set(`${first.toLowerCase()}|${last.toLowerCase()}`, [first, last]);
  };

  add(tokens[0], tokens[tokens.length - 1]);
  add(tokens[tokens.length - 1], tokens[0]);
  add(tokens[0], tokens.slice(1).join(" "));
  add(tokens.slice(0, -1).join(" "), tokens[tokens.length - 1]);

  return [...pairs.values()];
}

export async function searchCustomers(
  client: DataChatSupabaseClient,
  { query }: { query: string },
): Promise<ToolResult<CustomerSearchResult>> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { success: true, data: { query: trimmed, matches: [] } };
  }

  const tokens = searchTokens(trimmed);
  if (tokens.length === 0) {
    return { success: true, data: { query: trimmed, matches: [] } };
  }

  const byId = new Map<string, Customer>();

  const mergeRows = (rows: Customer[] | null | undefined) => {
    for (const row of rows ?? []) {
      byId.set(row.id, row);
    }
  };

  const { data: tokenRows, error: tokenError } = await client
    .from("customers")
    .select(CUSTOMER_COLUMNS)
    .or(orFilterForTerms(tokens));

  if (tokenError) {
    return { success: false, error: tokenError.message };
  }
  mergeRows(tokenRows as Customer[] | null);

  for (const [firstName, lastName] of firstLastPairs(tokens)) {
    const { data, error } = await client
      .from("customers")
      .select(CUSTOMER_COLUMNS)
      .ilike("first_name", ilikePattern(firstName))
      .ilike("last_name", ilikePattern(lastName));

    if (error) {
      return { success: false, error: error.message };
    }
    mergeRows(data as Customer[] | null);
  }

  const matches: CustomerSearchHit[] = [...byId.values()]
    .map((customer) => ({
      customer,
      match: classifyCustomerMatch(customer, tokens),
    }))
    .sort((a, b) => {
      if (a.match !== b.match) {
        return a.match === "full" ? -1 : 1;
      }
      return `${a.customer.last_name} ${a.customer.first_name}`.localeCompare(
        `${b.customer.last_name} ${b.customer.first_name}`,
      );
    });

  return { success: true, data: { query: trimmed, matches } };
}

export async function getCustomerDossier(
  client: DataChatSupabaseClient,
  { customerId }: { customerId: string },
): Promise<ToolResult<CustomerDossier>> {
  const { data: customer, error: customerError } = await client
    .from("customers")
    .select("id, first_name, last_name, email, phone_number, address, created_at")
    .eq("id", customerId)
    .maybeSingle();

  if (customerError) {
    return { success: false, error: customerError.message };
  }

  if (!customer) {
    return { success: false, error: `No customer found with id ${customerId}` };
  }

  const childTables = [
    "subscriptions",
    "invoices",
    "payment_methods",
    "equipment",
    "incidents",
    "interaction_logs",
  ] as const;

  const results = await Promise.all(
    childTables.map(async (table) => {
      const { data, error } = await client.from(table).select("*").eq("customer_id", customerId);
      return { table, data, error };
    }),
  );

  for (const { table, error } of results) {
    if (error) {
      return { success: false, error: `${table}: ${error.message}` };
    }
  }

  const byTable = Object.fromEntries(results.map(({ table, data }) => [table, data ?? []]));

  return {
    success: true,
    data: {
      customer: customer as Customer,
      subscriptions: byTable.subscriptions,
      invoices: byTable.invoices,
      payment_methods: byTable.payment_methods,
      equipment: byTable.equipment,
      incidents: byTable.incidents,
      interaction_logs: byTable.interaction_logs,
    },
  };
}

export async function searchByTopic(
  client: DataChatSupabaseClient,
  { query }: { query: string },
): Promise<ToolResult<TopicSearchResults>> {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      success: true,
      data: {
        incidents: [],
        interaction_logs: [],
        subscriptions: [],
        equipment: [],
        invoices: [],
      },
    };
  }

  const pattern = ilikePattern(trimmed);

  const searches = [
    {
      key: "incidents" as const,
      promise: client
        .from("incidents")
        .select("*")
        .or(`description.ilike.${pattern},issue_type.ilike.${pattern}`),
    },
    {
      key: "interaction_logs" as const,
      promise: client.from("interaction_logs").select("*").ilike("agent_notes", pattern),
    },
    {
      key: "subscriptions" as const,
      promise: client
        .from("subscriptions")
        .select("*")
        .or(`plan_name.ilike.${pattern},service_category.ilike.${pattern}`),
    },
    {
      key: "equipment" as const,
      promise: client
        .from("equipment")
        .select("*")
        .or(`model_name.ilike.${pattern},device_type.ilike.${pattern}`),
    },
    {
      key: "invoices" as const,
      promise: client.from("invoices").select("*").ilike("status", pattern),
    },
  ];

  const settled = await Promise.all(
    searches.map(async ({ key, promise }) => {
      const { data, error } = await promise;
      return { key, data, error };
    }),
  );

  for (const { key, error } of settled) {
    if (error) {
      return { success: false, error: `${key}: ${error.message}` };
    }
  }

  const results: TopicSearchResults = {
    incidents: [],
    interaction_logs: [],
    subscriptions: [],
    equipment: [],
    invoices: [],
  };

  for (const { key, data } of settled) {
    results[key] = data ?? [];
  }

  return { success: true, data: results };
}
