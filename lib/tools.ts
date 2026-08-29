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

export function quoteIlikeTerm(term: string): string {
  return `"%${escapeIlike(term)}%"`;
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

  const { data: tokenRows, error: tokenError } = await client
    .from("customers")
    .select(CUSTOMER_COLUMNS)
    .or(orFilterForTerms(tokens))
    .limit(CUSTOMER_SEARCH_LIMIT);

  if (tokenError) {
    logDbError("searchCustomers", tokenError.message);
    return { success: false, error: DB_ERROR };
  }

  const rows = (tokenRows ?? []) as Customer[];
  const truncated = rows.length >= CUSTOMER_SEARCH_LIMIT;

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

  return {
    success: true,
    data: {
      query: trimmed,
      matches,
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

  const pattern = quoteIlikeTerm(trimmed);
  const agentNotesPattern = ilikePattern(trimmed);

  const [
    incidentsResult,
    interactionLogsResult,
    subscriptionsResult,
    equipmentResult,
    invoicesResult,
  ] = await Promise.all([
    client
      .from("incidents")
      .select(INCIDENT_COLUMNS)
      .or(`description.ilike.${pattern},issue_type.ilike.${pattern}`)
      .limit(CHILD_ROW_LIMIT),
    client
      .from("interaction_logs")
      .select(INTERACTION_LOG_COLUMNS)
      .ilike("agent_notes", agentNotesPattern)
      .limit(CHILD_ROW_LIMIT),
    client
      .from("subscriptions")
      .select(SUBSCRIPTION_COLUMNS)
      .or(`plan_name.ilike.${pattern},service_category.ilike.${pattern}`)
      .limit(CHILD_ROW_LIMIT),
    client
      .from("equipment")
      .select(EQUIPMENT_COLUMNS)
      .or(`model_name.ilike.${pattern},device_type.ilike.${pattern}`)
      .limit(CHILD_ROW_LIMIT),
    client
      .from("invoices")
      .select(INVOICE_COLUMNS)
      .ilike("status", agentNotesPattern)
      .limit(CHILD_ROW_LIMIT),
  ]);

  const settled = [
    { key: "incidents" as const, result: incidentsResult },
    { key: "interaction_logs" as const, result: interactionLogsResult },
    { key: "subscriptions" as const, result: subscriptionsResult },
    { key: "equipment" as const, result: equipmentResult },
    { key: "invoices" as const, result: invoicesResult },
  ];

  for (const { key, result } of settled) {
    if (result.error) {
      logDbError(`searchByTopic/${key}`, result.error.message);
      return { success: false, error: DB_ERROR };
    }
  }

  const incidents = (incidentsResult.data ?? []) as Incident[];
  const interaction_logs = (interactionLogsResult.data ?? []) as InteractionLog[];
  const subscriptions = (subscriptionsResult.data ?? []) as Subscription[];
  const equipment = (equipmentResult.data ?? []) as Equipment[];
  const invoices = (invoicesResult.data ?? []) as Invoice[];

  const truncated = settled.some(
    ({ result }) => (result.data?.length ?? 0) >= CHILD_ROW_LIMIT,
  );

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
