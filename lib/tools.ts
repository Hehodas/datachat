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

export type Subscription = {
  id: string;
  customer_id: string;
  service_category: string;
  plan_name: string;
  status: string;
  monthly_price: number;
  activation_date: string;
};

export type Invoice = {
  id: string;
  customer_id: string;
  billing_period: string;
  amount_due: number;
  issue_date: string;
  due_date: string;
  status: string;
};

export type PaymentMethod = {
  provider: string;
  payment_type: string;
  last_four_digits: string;
  is_default: boolean;
};

export type Equipment = {
  id: string;
  customer_id: string;
  device_type: string;
  model_name: string;
  serial_number: string;
  warranty_expiration: string | null;
};

export type Incident = {
  id: string;
  customer_id: string;
  issue_type: string;
  description: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
};

export type InteractionLog = {
  id: string;
  customer_id: string;
  channel: string;
  agent_notes: string;
  interaction_date: string;
};

export type CustomerDossier = {
  customer: Customer;
  subscriptions: Subscription[];
  invoices: Invoice[];
  payment_methods: PaymentMethod[];
  equipment: Equipment[];
  incidents: Incident[];
  interaction_logs: InteractionLog[];
  truncated?: boolean;
};

export type TopicSearchResults = {
  incidents: Incident[];
  interaction_logs: InteractionLog[];
  subscriptions: Subscription[];
  equipment: Equipment[];
  invoices: Invoice[];
  truncated?: boolean;
};

const CUSTOMER_COLUMNS =
  "id, first_name, last_name, email, phone_number, address, created_at";

const SUBSCRIPTION_COLUMNS =
  "id, customer_id, service_category, plan_name, status, monthly_price, activation_date";

const INVOICE_COLUMNS =
  "id, customer_id, billing_period, amount_due, issue_date, due_date, status";

const PAYMENT_METHOD_COLUMNS = "provider, payment_type, last_four_digits, is_default";

const EQUIPMENT_COLUMNS =
  "id, customer_id, device_type, model_name, serial_number, warranty_expiration";

const INCIDENT_COLUMNS =
  "id, customer_id, issue_type, description, status, created_at, resolved_at";

const INTERACTION_LOG_COLUMNS = "id, customer_id, channel, agent_notes, interaction_date";

const CUSTOMER_SEARCH_LIMIT = 25;
const CHILD_ROW_LIMIT = 50;
const CUSTOMER_SEARCH_COLUMNS = ["first_name", "last_name", "email"] as const;
const INCIDENT_TOPIC_COLUMNS = ["description", "issue_type"] as const;
const SUBSCRIPTION_TOPIC_COLUMNS = ["plan_name", "service_category"] as const;
const EQUIPMENT_TOPIC_COLUMNS = ["model_name", "device_type"] as const;

const DB_ERROR = "database query failed";

export type CustomerMatchQuality = "full" | "partial";

export type CustomerSearchHit = {
  customer: Customer;
  match: CustomerMatchQuality;
};

export type CustomerSearchResult = {
  query: string;
  matches: CustomerSearchHit[];
  truncated?: boolean;
};

export function escapeIlike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/[%_]/g, "\\$&");
}

function ilikePattern(query: string): string {
  return `%${escapeIlike(query)}%`;
}

export function searchTokens(query: string): string[] {
  return query
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/^[.,;:"']+|[.,;:"']+$/g, ""))
    .filter((token) => token.length > 0);
}

function containsInsensitive(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export function classifyCustomerMatch(
  customer: Customer,
  tokens: string[],
): CustomerMatchQuality {
  const firstName = customer.first_name ?? "";
  const lastName = customer.last_name ?? "";
  const email = customer.email ?? "";

  if (tokens.length === 0) {
    return "partial";
  }

  if (tokens.length === 1) {
    const token = tokens[0];
    if (
      containsInsensitive(firstName, token) ||
      containsInsensitive(lastName, token) ||
      containsInsensitive(email, token)
    ) {
      return "full";
    }
    return "partial";
  }

  const firstToken = tokens[0];
  const lastToken = tokens[tokens.length - 1];
  const firstThenLast =
    containsInsensitive(firstName, firstToken) && containsInsensitive(lastName, lastToken);
  const lastThenFirst =
    containsInsensitive(firstName, lastToken) && containsInsensitive(lastName, firstToken);

  return firstThenLast || lastThenFirst ? "full" : "partial";
}

function logDbError(context: string, message: string): void {
  console.error(`[tools] ${context}: ${message}`);
}

function dedupeById<T extends { id: string }>(rows: T[]): T[] {
  const byId = new Map<string, T>();
  for (const row of rows) {
    byId.set(row.id, row);
  }
  return Array.from(byId.values());
}

type MergedSearchRows<T extends { id: string }> = {
  rows: T[];
  truncated: boolean;
};

async function searchTableByColumns<T extends { id: string }>(
  client: DataChatSupabaseClient,
  {
    table,
    columns,
    queryColumns,
    query,
    limit,
    context,
  }: {
    table: string;
    columns: string;
    queryColumns: readonly string[];
    query: string;
    limit: number;
    context: string;
  },
): Promise<ToolResult<MergedSearchRows<T>>> {
  const pattern = ilikePattern(query);
  const results = await Promise.all(
    queryColumns.map((queryColumn) =>
      client.from(table).select(columns).ilike(queryColumn, pattern).limit(limit),
    ),
  );

  for (const result of results) {
    if (result.error) {
      logDbError(context, result.error.message);
      return { success: false, error: DB_ERROR };
    }
  }

  const mergedRows = dedupeById(results.flatMap((result) => (result.data ?? []) as T[]));
  const truncated =
    mergedRows.length > limit || results.some((result) => (result.data?.length ?? 0) >= limit);

  return {
    success: true,
    data: {
      rows: mergedRows.slice(0, limit),
      truncated,
    },
  };
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

  const tokenSearches = await Promise.all(
    tokens.map((token) =>
      searchTableByColumns<Customer>(client, {
        table: "customers",
        columns: CUSTOMER_COLUMNS,
        queryColumns: CUSTOMER_SEARCH_COLUMNS,
        query: token,
        limit: CUSTOMER_SEARCH_LIMIT,
        context: "searchCustomers",
      }),
    ),
  );

  for (const tokenSearch of tokenSearches) {
    if (!tokenSearch.success) {
      return tokenSearch;
    }
  }

  const rows = dedupeById(
    tokenSearches.flatMap((tokenSearch) => (tokenSearch.success ? tokenSearch.data.rows : [])),
  );
  const truncated =
    rows.length > CUSTOMER_SEARCH_LIMIT ||
    tokenSearches.some((tokenSearch) => tokenSearch.success && tokenSearch.data.truncated);

  const matches: CustomerSearchHit[] = rows
    .map((customer) => ({
      customer,
      match: classifyCustomerMatch(customer, tokens),
    }))
    .sort((a, b) => {
      if (a.match !== b.match) {
        return a.match === "full" ? -1 : 1;
      }
      return `${a.customer.last_name ?? ""} ${a.customer.first_name ?? ""}`.localeCompare(
        `${b.customer.last_name ?? ""} ${b.customer.first_name ?? ""}`,
      );
    });
  const cappedMatches = matches.slice(0, CUSTOMER_SEARCH_LIMIT);

  return {
    success: true,
    data: {
      query: trimmed,
      matches: cappedMatches,
      ...(truncated ? { truncated: true } : {}),
    },
  };
}

export async function getCustomerDossier(
  client: DataChatSupabaseClient,
  { customerId }: { customerId: string },
): Promise<ToolResult<CustomerDossier>> {
  const { data: customer, error: customerError } = await client
    .from("customers")
    .select(CUSTOMER_COLUMNS)
    .eq("id", customerId)
    .maybeSingle();

  if (customerError) {
    logDbError("getCustomerDossier/customers", customerError.message);
    return { success: false, error: DB_ERROR };
  }

  if (!customer) {
    return { success: false, error: `No customer found with id ${customerId}` };
  }

  const [
    subscriptionsResult,
    invoicesResult,
    paymentMethodsResult,
    equipmentResult,
    incidentsResult,
    interactionLogsResult,
  ] = await Promise.all([
    client
      .from("subscriptions")
      .select(SUBSCRIPTION_COLUMNS)
      .eq("customer_id", customerId)
      .limit(CHILD_ROW_LIMIT),
    client
      .from("invoices")
      .select(INVOICE_COLUMNS)
      .eq("customer_id", customerId)
      .limit(CHILD_ROW_LIMIT),
    client
      .from("payment_methods")
      .select(PAYMENT_METHOD_COLUMNS)
      .eq("customer_id", customerId)
      .limit(CHILD_ROW_LIMIT),
    client
      .from("equipment")
      .select(EQUIPMENT_COLUMNS)
      .eq("customer_id", customerId)
      .limit(CHILD_ROW_LIMIT),
    client
      .from("incidents")
      .select(INCIDENT_COLUMNS)
      .eq("customer_id", customerId)
      .limit(CHILD_ROW_LIMIT),
    client
      .from("interaction_logs")
      .select(INTERACTION_LOG_COLUMNS)
      .eq("customer_id", customerId)
      .limit(CHILD_ROW_LIMIT),
  ]);

  const results = [
    { label: "subscriptions", result: subscriptionsResult },
    { label: "invoices", result: invoicesResult },
    { label: "payment_methods", result: paymentMethodsResult },
    { label: "equipment", result: equipmentResult },
    { label: "incidents", result: incidentsResult },
    { label: "interaction_logs", result: interactionLogsResult },
  ];

  for (const { label, result } of results) {
    if (result.error) {
      logDbError(`getCustomerDossier/${label}`, result.error.message);
      return { success: false, error: DB_ERROR };
    }
  }

  const subscriptions = (subscriptionsResult.data ?? []) as Subscription[];
  const invoices = (invoicesResult.data ?? []) as Invoice[];
  const payment_methods = (paymentMethodsResult.data ?? []) as PaymentMethod[];
  const equipment = (equipmentResult.data ?? []) as Equipment[];
  const incidents = (incidentsResult.data ?? []) as Incident[];
  const interaction_logs = (interactionLogsResult.data ?? []) as InteractionLog[];

  const truncated = results.some(
    ({ result }) => (result.data?.length ?? 0) >= CHILD_ROW_LIMIT,
  );

  return {
    success: true,
    data: {
      customer: customer as Customer,
      subscriptions,
      invoices,
      payment_methods,
      equipment,
      incidents,
      interaction_logs,
      ...(truncated ? { truncated: true } : {}),
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

  const agentNotesPattern = ilikePattern(trimmed);

  const [
    incidentsSearch,
    interactionLogsResult,
    subscriptionsSearch,
    equipmentSearch,
    invoicesResult,
  ] = await Promise.all([
    searchTableByColumns<Incident>(client, {
      table: "incidents",
      columns: INCIDENT_COLUMNS,
      queryColumns: INCIDENT_TOPIC_COLUMNS,
      query: trimmed,
      limit: CHILD_ROW_LIMIT,
      context: "searchByTopic/incidents",
    }),
    client
      .from("interaction_logs")
      .select(INTERACTION_LOG_COLUMNS)
      .ilike("agent_notes", agentNotesPattern)
      .limit(CHILD_ROW_LIMIT),
    searchTableByColumns<Subscription>(client, {
      table: "subscriptions",
      columns: SUBSCRIPTION_COLUMNS,
      queryColumns: SUBSCRIPTION_TOPIC_COLUMNS,
      query: trimmed,
      limit: CHILD_ROW_LIMIT,
      context: "searchByTopic/subscriptions",
    }),
    searchTableByColumns<Equipment>(client, {
      table: "equipment",
      columns: EQUIPMENT_COLUMNS,
      queryColumns: EQUIPMENT_TOPIC_COLUMNS,
      query: trimmed,
      limit: CHILD_ROW_LIMIT,
      context: "searchByTopic/equipment",
    }),
    client
      .from("invoices")
      .select(INVOICE_COLUMNS)
      .ilike("status", agentNotesPattern)
      .limit(CHILD_ROW_LIMIT),
  ]);

  if (!incidentsSearch.success) {
    return incidentsSearch;
  }
  if (!subscriptionsSearch.success) {
    return subscriptionsSearch;
  }
  if (!equipmentSearch.success) {
    return equipmentSearch;
  }

  if (interactionLogsResult.error) {
    logDbError("searchByTopic/interaction_logs", interactionLogsResult.error.message);
    return { success: false, error: DB_ERROR };
  }
  if (invoicesResult.error) {
    logDbError("searchByTopic/invoices", invoicesResult.error.message);
    return { success: false, error: DB_ERROR };
  }

  const incidents = incidentsSearch.data.rows;
  const interaction_logs = (interactionLogsResult.data ?? []) as InteractionLog[];
  const subscriptions = subscriptionsSearch.data.rows;
  const equipment = equipmentSearch.data.rows;
  const invoices = (invoicesResult.data ?? []) as Invoice[];

  const truncated =
    incidentsSearch.data.truncated ||
    subscriptionsSearch.data.truncated ||
    equipmentSearch.data.truncated ||
    (interactionLogsResult.data?.length ?? 0) >= CHILD_ROW_LIMIT ||
    (invoicesResult.data?.length ?? 0) >= CHILD_ROW_LIMIT;

  return {
    success: true,
    data: {
      incidents,
      interaction_logs,
      subscriptions,
      equipment,
      invoices,
      ...(truncated ? { truncated: true } : {}),
    },
  };
}
