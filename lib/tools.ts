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
  created_at: string;
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

function ilikePattern(query: string): string {
  return `%${query}%`;
}

export async function searchCustomers(
  client: DataChatSupabaseClient,
  { query }: { query: string },
): Promise<ToolResult<Customer[]>> {
  const pattern = ilikePattern(query.trim());

  const { data, error } = await client
    .from("customers")
    .select("id, first_name, last_name, email, phone_number, address, created_at")
    .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: (data ?? []) as Customer[] };
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
  const pattern = ilikePattern(query.trim());

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
