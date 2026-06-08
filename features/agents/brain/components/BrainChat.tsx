"use client";

import { useActionState, useEffect, useRef, useState } from "react";
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
import { askBrandBrainAction } from "@/features/agents/brain/actions";
import {
  brandBrainPromptMaxLength,
  initialBrandBrainChatFormState,
} from "@/features/agents/brain/schema";
import type {
  BrandBrainAccess,
  BrandBrainChatRole,
  BrandBrainDisplaySource,
} from "@/features/agents/brain/types";

type ChatMessage = {
  id: string;
  role: BrandBrainChatRole;
  content: string;
  sources?: BrandBrainDisplaySource[];
};

function ThinkingBubble() {
  return (
    <div className="flex gap-3">
      <BrainAvatar />
      <div className="flex-1 space-y-2 rounded-lg border border-border bg-[var(--bv-card-soft)] p-4">
        <div className="h-3 w-full max-w-sm animate-pulse rounded bg-muted" />
        <div className="h-3 w-5/6 max-w-xs animate-pulse rounded bg-muted" />
        <div className="h-3 w-4/6 max-w-[12rem] animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

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

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

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
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--bv-ink-2)]">
          {message.content}
        </p>
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

export function BrainChat({ access }: { access: BrandBrainAccess }) {
  const [state, dispatch, isPending] = useActionState(
    askBrandBrainAction,
    initialBrandBrainChatFormState,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");

  const idRef = useRef(0);
  const processedRunIdRef = useRef<string | null>(null);
  const lastRequestRef = useRef<{ prompt: string; historyJson: string } | null>(
    null,
  );
  const threadRef = useRef<HTMLDivElement>(null);

  function nextId() {
    idRef.current += 1;
    return `msg-${idRef.current}`;
  }

  // Append the assistant turn once per server run. Keying off runId keeps a
  // re-render from duplicating the answer while a request is still settling.
  useEffect(() => {
    if (
      state.status === "success" &&
      state.answer &&
      state.runId &&
      state.runId !== processedRunIdRef.current
    ) {
      processedRunIdRef.current = state.runId;
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          content: state.answer ?? "",
          sources: state.sources,
        },
      ]);
    }
  }, [state]);

  useEffect(() => {
    const node = threadRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [messages, isPending]);

  function submitPrompt(prompt: string, historyJson: string) {
    lastRequestRef.current = { prompt, historyJson };
    const payload = new FormData();
    payload.set("prompt", prompt);
    payload.set("history", historyJson);
    dispatch(payload);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = input.trim();
    if (!prompt || isPending) return;

    // Snapshot the conversation before the new turn — these prior messages are
    // the memory the model receives; the fresh prompt is sent separately.
    const historyJson = JSON.stringify(
      messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    );

    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: "user", content: prompt },
    ]);
    setInput("");
    submitPrompt(prompt, historyJson);
  }

  function handleRetry() {
    if (!lastRequestRef.current || isPending) return;
    submitPrompt(
      lastRequestRef.current.prompt,
      lastRequestRef.current.historyJson,
    );
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  const showError = state.status === "error" && !isPending;
  const isEmpty = messages.length === 0 && !isPending && !showError;

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
              <MessageBubble key={message.id} message={message} />
            ))}

            {isPending ? <ThinkingBubble /> : null}

            {showError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-destructive">
                      Unable to process question
                    </p>
                    <p className="text-xs text-[var(--bv-ink-3)]">
                      {state.message}
                    </p>
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
              disabled={isPending || input.trim().length === 0}
              type="submit"
            >
              {isPending ? (
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
