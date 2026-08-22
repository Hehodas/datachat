import { openai } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase";
import {
  getCustomerDossier,
  searchByTopic,
  searchCustomers,
} from "@/lib/tools";

export const maxDuration = 60;

const SYSTEM_PROMPT = `You are DataChat, an internal CRM assistant for a telecom company.

Rules:
- Answer ONLY using data returned by your tools. Never invent customers, invoices, or incidents.
- When a user asks about a person, call searchCustomers with the full name they used (the tool also searches first/last name parts).
- If searchCustomers returns a single match with match "full", call getCustomerDossier for that customer id.
- If several people match, or any match is "partial" (only part of the name lined up), do NOT load a dossier yet. List the candidate names/emails and ask the user to confirm which person they mean.
- If the user confirms a candidate, then call getCustomerDossier.
- When a user asks about a topic (plans, incidents, equipment, invoices, support notes), use searchByTopic.
- Write a structured summary covering: identity, subscriptions, invoices, equipment, incidents, and support notes when available.
- If tools return no matching records, say clearly that nothing was found. Do not guess or fabricate data.
- Be concise but thorough. Use markdown headings and bullet lists for readability.`;

export async function POST(req: Request) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("messages" in body) ||
    !Array.isArray((body as { messages: unknown }).messages)
  ) {
    return Response.json({ error: "Missing messages" }, { status: 400 });
  }

  const { messages } = body as { messages: UIMessage[] };
  const client = createServerSupabaseClient();

  const result = streamText({
    model: openai("gpt-4o"),
    system: SYSTEM_PROMPT,
    messages: convertToModelMessages(messages),
    stopWhen: stepCountIs(5),
    tools: {
      searchCustomers: tool({
        description:
          "Search customers by name or email. Pass the full name the user said; the search splits tokens and tries first/last name combinations. Results include match 'full' or 'partial'.",
        inputSchema: z.object({
          query: z.string().describe("Full name, name fragment, or email to search for"),
        }),
        execute: async ({ query }) => searchCustomers(client, { query }),
      }),
      getCustomerDossier: tool({
        description:
          "Load a full customer dossier including subscriptions, invoices, payment methods, equipment, incidents, and interaction logs.",
        inputSchema: z.object({
          customerId: z.string().uuid().describe("The customer UUID from searchCustomers"),
        }),
        execute: async ({ customerId }) => getCustomerDossier(client, { customerId }),
      }),
      searchByTopic: tool({
        description:
          "Search across incidents, support notes, subscriptions, equipment, and invoice status by topic keyword.",
        inputSchema: z.object({
          query: z.string().describe("Topic keyword such as unpaid, open, fiber, etc."),
        }),
        execute: async ({ query }) => searchByTopic(client, { query }),
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
