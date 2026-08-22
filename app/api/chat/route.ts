import { openai } from "@ai-sdk/openai";
import { streamText, tool } from "ai";
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
- When a user asks about a person, use searchCustomers first, then getCustomerDossier for the matching customer id.
- When a user asks about a topic (plans, incidents, equipment, invoices, support notes), use searchByTopic.
- Write a structured summary covering: identity, subscriptions, invoices, equipment, incidents, and support notes when available.
- If tools return no matching records, say clearly that nothing was found. Do not guess or fabricate data.
- Be concise but thorough. Use markdown headings and bullet lists for readability.`;

export async function POST(req: Request) {
  let body: { messages?: unknown };

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.messages || !Array.isArray(body.messages)) {
    return Response.json({ error: "Missing messages" }, { status: 400 });
  }

  const client = createServerSupabaseClient();

  const result = streamText({
    model: openai("gpt-4o"),
    system: SYSTEM_PROMPT,
    messages: body.messages,
    tools: {
      searchCustomers: tool({
        description:
          "Search customers by name or email. Use when the user asks about a specific person.",
        parameters: z.object({
          query: z.string().describe("Name or email fragment to search for"),
        }),
        execute: async ({ query }) => searchCustomers(client, { query }),
      }),
      getCustomerDossier: tool({
        description:
          "Load a full customer dossier including subscriptions, invoices, payment methods, equipment, incidents, and interaction logs.",
        parameters: z.object({
          customerId: z.string().uuid().describe("The customer UUID from searchCustomers"),
        }),
        execute: async ({ customerId }) => getCustomerDossier(client, { customerId }),
      }),
      searchByTopic: tool({
        description:
          "Search across incidents, support notes, subscriptions, equipment, and invoice status by topic keyword.",
        parameters: z.object({
          query: z.string().describe("Topic keyword such as unpaid, open, fiber, etc."),
        }),
        execute: async ({ query }) => searchByTopic(client, { query }),
      }),
    },
    maxSteps: 5,
  });

  return result.toDataStreamResponse();
}
