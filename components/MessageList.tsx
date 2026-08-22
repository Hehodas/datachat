"use client";

import { useEffect, useRef } from "react";
import type { UIMessage } from "ai";
import ReactMarkdown from "react-markdown";

type MessageListProps = {
  messages: UIMessage[];
  isStreaming?: boolean;
};

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export function MessageList({ messages, isStreaming }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-6">
      {messages.map((message, index) => {
        const text = getMessageText(message);
        const isLast = index === messages.length - 1;

        if (message.role === "user") {
          return (
            <div key={message.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-accent px-4 py-3 text-sm text-white">
                {text}
              </div>
            </div>
          );
        }

        if (message.role !== "assistant") {
          return null;
        }

        return (
          <div key={message.id} className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-border bg-surface px-4 py-3 text-sm text-foreground">
              {text ? (
                <div className="markdown-body">
                  <ReactMarkdown>{text}</ReactMarkdown>
                </div>
              ) : isStreaming && isLast ? (
                <span className="inline-block h-4 w-1 animate-pulse bg-accent-light" />
              ) : null}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
