"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircleIcon,
  BrainIcon,
  LoaderIcon,
  RefreshCwIcon,
  SendIcon,
  UserIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { brandBrainPromptMaxLength } from "@/features/agents/brain/schema";
import type {
  BrandBrainAccess,
  BrandBrainChatRole,
  BrandBrainConversationMessage,
  BrandBrainDisplaySource,
  BrandBrainStreamEvent,
} from "@/features/agents/brain/types";

type ChatMessage = {
  id: string;
  role: BrandBrainChatRole;
  content: string;
  sources: BrandBrainDisplaySource[] | null;
};

type HistoryTurn = { role: BrandBrainChatRole; content: string };

const STREAM_ENDPOINT = "/api/brain/stream";

function BrainAvatar() {
  return (
    <div
      className="flex size-8 shrink-0 items-center justify-center rounded-lg"
      style={{
        background:
          "linear-gradient(135deg, var(--bv-brand-tint-16), var(--bv-brand-tint-8))",
        color: "var(--bv-brand-deep)",
        boxShadow: "0 0 0 1px var(--bv-brand-tint-16)",
      }}
    >
      <BrainIcon className="size-4" />
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex gap-1 py-1">
      <span className="size-1.5 animate-bounce rounded-full bg-[var(--bv-ink-4)] [animation-delay:-0.3s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-[var(--bv-ink-4)] [animation-delay:-0.15s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-[var(--bv-ink-4)]" />
    </div>
  );
}

function MessageBubble({
  message,
  isStreaming,
}: {
  message: ChatMessage;
  isStreaming: boolean;
}) {
  const isUser = message.role === "user";
  const showTyping = !isUser && isStreaming && message.content.length === 0;

  return (
    <div className="flex gap-3">
      {isUser ? (
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-[var(--bv-ink-2)]">
          <UserIcon className="size-4" />
        </div>
      ) : (
        <BrainAvatar />
      )}
      <div
        className={
          isUser
            ? "flex-1 rounded-lg border border-border bg-muted/40 p-4"
            : "flex-1 space-y-4 rounded-lg border border-border bg-[var(--bv-card-soft)] p-4"
        }
      >
        {showTyping ? (
          <TypingDots />
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--bv-ink-2)]">
            {message.content}
          </p>
        )}
        {!isUser && message.sources && message.sources.length > 0 ? (
          <div
            className="space-y-1.5 border-t border-dashed pt-3"
            style={{ borderColor: "var(--bv-line-dashed)" }}
          >
            <h3 className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--bv-ink-4)]">
              Sources
            </h3>
            <ul className="space-y-1 text-xs text-[var(--bv-ink-3)]">
              {message.sources.map((source, index) => (
                <li key={`${source.fileName}-${index}`}>
                  {source.fileName}
                  {source.score !== null
                    ? ` · ${Math.round(source.score * 100)}%`
                    : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function BrainChat({
  access,
  initialMessages = [],
}: {
  access: BrandBrainAccess;
  initialMessages?: BrandBrainConversationMessage[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    initialMessages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      sources: message.sources,
    })),
  );
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const idRef = useRef(0);
  const lastRequestRef = useRef<{ prompt: string; history: HistoryTurn[] } | null>(
    null,
  );
  const threadRef = useRef<HTMLDivElement>(null);

  function nextId() {
    idRef.current += 1;
    return `live-${idRef.current}`;
  }

  function updateMessage(id: string, updater: (message: ChatMessage) => ChatMessage) {
    setMessages((prev) =>
      prev.map((message) => (message.id === id ? updater(message) : message)),
    );
  }

  useEffect(() => {
    const node = threadRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [messages, isStreaming]);

  async function runStream(
    prompt: string,
    history: HistoryTurn[],
    assistantId: string,
  ) {
    const response = await fetch(STREAM_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, history }),
    });

    if (!response.ok || !response.body) {
      let message = "Brand Brain could not complete this request.";
      try {
        const payload = await response.json();
        if (payload && typeof payload.message === "string") {
          message = payload.message;
        }
      } catch {
        // Non-JSON error body; keep the generic message.
      }
      throw new Error(message);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const handleEvent = (event: BrandBrainStreamEvent) => {
      if (event.type === "delta") {
        updateMessage(assistantId, (message) => ({
          ...message,
          content: message.content + event.text,
        }));
      } else if (event.type === "done") {
        updateMessage(assistantId, (message) => ({
          ...message,
          sources: event.sources.length > 0 ? event.sources : message.sources,
        }));
      } else if (event.type === "error") {
        throw new Error(event.message);
      }
    };

    const drain = (chunk: string) => {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          handleEvent(JSON.parse(trimmed) as BrandBrainStreamEvent);
        }
      }
    };

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      drain(decoder.decode(value, { stream: true }));
    }

    const tail = buffer.trim();
    if (tail) {
      handleEvent(JSON.parse(tail) as BrandBrainStreamEvent);
    }
  }

  async function send(prompt: string, history: HistoryTurn[]) {
    lastRequestRef.current = { prompt, history };
    const assistantId = nextId();

    setError(null);
    setIsStreaming(true);
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: "user", content: prompt, sources: null },
      { id: assistantId, role: "assistant", content: "", sources: null },
    ]);

    try {
      await runStream(prompt, history, assistantId);
    } catch (caught) {
      // Drop an answer-less placeholder so it neither lingers nor pollutes the
      // memory of the next request; keep partial answers that did arrive.
      setMessages((prev) =>
        prev.filter(
          (message) => message.id !== assistantId || message.content.length > 0,
        ),
      );
      setError(
        caught instanceof Error
          ? caught.message
          : "Brand Brain could not complete this request.",
      );
    } finally {
      setIsStreaming(false);
    }
  }

  function snapshotHistory(): HistoryTurn[] {
    return messages
      .filter((message) => message.content.length > 0)
      .map((message) => ({ role: message.role, content: message.content }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = input.trim();
    if (!prompt || isStreaming) return;

    const history = snapshotHistory();
    setInput("");
    void send(prompt, history);
  }

  function handleRetry() {
    if (!lastRequestRef.current || isStreaming) return;
    const { prompt, history } = lastRequestRef.current;
    void send(prompt, history);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  const isEmpty = messages.length === 0 && !isStreaming && !error;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BrainIcon className="size-5" />
            Brand Brain
          </CardTitle>
          <CardDescription>
            Ask strategic questions against the approved knowledge base for{" "}
            {access.brandName}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            ref={threadRef}
            className="max-h-[28rem] space-y-4 overflow-y-auto"
          >
            {isEmpty ? (
              <div className="flex flex-col items-center gap-4 py-10 text-center">
                <div
                  className="flex size-14 items-center justify-center rounded-2xl"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--bv-brand-tint-16), var(--bv-brand-tint-8))",
                    color: "var(--bv-brand-deep)",
                    boxShadow: "0 0 0 1px var(--bv-brand-tint-16)",
                  }}
                >
                  <BrainIcon className="size-6" />
                </div>
                <div className="space-y-1.5">
                  <p className="ds-h3">Ask anything about {access.brandName}</p>
                  <p className="ds-caption max-w-md">
                    Brand Brain remembers the conversation, searches your
                    knowledge base, and responds with sources.
                  </p>
                </div>
              </div>
            ) : null}

            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                isStreaming={isStreaming}
                message={message}
              />
            ))}

            {error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-destructive">
                      Unable to process question
                    </p>
                    <p className="text-xs text-[var(--bv-ink-3)]">{error}</p>
                    <Button
                      className="gap-1.5"
                      onClick={handleRetry}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <RefreshCwIcon className="size-3" />
                      Try again
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <form className="space-y-3" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label className="sr-only" htmlFor="brand-brain-prompt">
                Question
              </Label>
              <Textarea
                id="brand-brain-prompt"
                maxLength={brandBrainPromptMaxLength}
                name="prompt"
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Brand Brain for a strategic summary, implication, or recommendation."
                rows={3}
                value={input}
              />
            </div>
            <Button
              className="gap-2"
              disabled={isStreaming || input.trim().length === 0}
              type="submit"
            >
              {isStreaming ? (
                <>
                  <LoaderIcon className="size-4 animate-spin" />
                  Thinking...
                </>
              ) : (
                <>
                  <SendIcon className="size-4" />
                  Ask Brand Brain
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Scope</CardTitle>
          <CardDescription>
            Restricted to {access.brandName} knowledge.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Brand</dt>
              <dd className="font-medium">{access.brandName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Role</dt>
              <dd className="font-medium">{access.membershipRole}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Plan</dt>
              <dd className="font-medium">{access.planName ?? "Active"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
