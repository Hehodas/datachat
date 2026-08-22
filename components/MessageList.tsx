"use client";

import type { Message } from "@ai-sdk/react";
import ReactMarkdown from "react-markdown";

type MessageListProps = {
  messages: Message[];
};

function getMessageText(message: Message): string {
  if (typeof message.content === "string") {
    return message.content;
  }

  if (Array.isArray(message.parts)) {
    return message.parts
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join("");
  }

  return "";
}

export function MessageList({ messages }: MessageListProps) {
  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto py-6">
      {messages.map((message) => {
        const text = getMessageText(message);

        if (message.role === "user") {
          return (
            <div key={message.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-accent px-4 py-3 text-sm text-white">
                {text}
              </div>
            </div>
          );
        }

        if (message.role === "assistant" && text) {
          return (
            <div key={message.id} className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-border bg-surface px-4 py-3 text-sm text-foreground">
                <div className="markdown-body">
                  <ReactMarkdown>{text}</ReactMarkdown>
                </div>
              </div>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
