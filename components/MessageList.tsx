"use client";

import { useCallback, useEffect, useRef } from "react";
import type { UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import {
  EMPTY_ASSISTANT_FALLBACK,
  getMessageText,
  safeMarkdownUrlTransform,
} from "@/lib/messages";

type MessageListProps = {
  messages: UIMessage[];
  isStreaming?: boolean;
};

const NEAR_BOTTOM_THRESHOLD_PX = 120;

export function MessageList({ messages, isStreaming }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const userNearBottomRef = useRef(true);

  const updateNearBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    userNearBottomRef.current = distanceFromBottom <= NEAR_BOTTOM_THRESHOLD_PX;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    container.addEventListener("scroll", updateNearBottom, { passive: true });
    return () => container.removeEventListener("scroll", updateNearBottom);
  }, [updateNearBottom]);

  useEffect(() => {
    if (!userNearBottomRef.current) {
      return;
    }

    bottomRef.current?.scrollIntoView({
      behavior: isStreaming ? "auto" : "smooth",
    });
  }, [messages, isStreaming]);

  return (
    <div
      ref={containerRef}
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-6"
    >
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

        const isEmpty = !text.trim();
        const showStreamingPlaceholder = Boolean(isStreaming && isLast && isEmpty);

        return (
          <div key={message.id} className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-border bg-surface px-4 py-3 text-sm text-foreground">
              {showStreamingPlaceholder ? (
                <span className="inline-block h-4 w-1 animate-pulse bg-accent-light" />
              ) : isEmpty ? (
                <span className="text-muted">{EMPTY_ASSISTANT_FALLBACK}</span>
              ) : (
                <div className="markdown-body">
                  {/* Do not enable rehype-raw; raw HTML in markdown must stay disabled. */}
                  <ReactMarkdown urlTransform={safeMarkdownUrlTransform}>
                    {text}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
