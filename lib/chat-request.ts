import type { UIMessage } from "ai";
import { z } from "zod";

export const MAX_CHAT_MESSAGES = 20;
export const MAX_TEXT_LENGTH = 8_000;
const MAX_PARTS_PER_MESSAGE = 64;
const MAX_MESSAGE_ID_LENGTH = 200;

const textPartSchema = z.object({
  type: z.literal("text"),
  text: z.string().max(MAX_TEXT_LENGTH),
});

const ignoredPartSchema = z
  .object({
    type: z
      .string()
      .min(1)
      .max(200)
      .refine((type) => type !== "text"),
  })
  .passthrough();

const partSchema = z.union([textPartSchema, ignoredPartSchema]);

const messageSchema = z.object({
  id: z.string().min(1).max(MAX_MESSAGE_ID_LENGTH),
  role: z.enum(["user", "assistant"]),
  parts: z.array(partSchema).max(MAX_PARTS_PER_MESSAGE),
});

const chatRequestSchema = z.object({
  messages: z.array(messageSchema).min(1).max(MAX_CHAT_MESSAGES),
});

export function parseChatRequest(body: unknown): UIMessage[] | null {
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return null;
  }

  const messages: UIMessage[] = [];

  for (const message of parsed.data.messages) {
    const textParts = message.parts
      .filter((part): part is z.infer<typeof textPartSchema> => part.type === "text")
      .map((part) => ({ type: "text" as const, text: part.text }));

    if (textParts.length === 0) {
      continue;
    }

    messages.push({
      id: message.id,
      role: message.role,
      parts: textParts,
    });
  }

  if (messages.length === 0) {
    return null;
  }

  return messages;
}
