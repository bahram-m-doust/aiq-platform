"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircleIcon,
  BrainIcon,
  ClockIcon,
  ImageIcon,
  LoaderIcon,
  MessageSquareIcon,
  PaperclipIcon,
  PlusIcon,
  RefreshCwIcon,
  SendIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { generateBrandBrainImageAction } from "@/features/agents/brain/actions";
import { brandBrainPromptMaxLength } from "@/features/agents/brain/schema";
import type {
  BrandBrainAccess,
  BrandBrainChatRole,
  BrandBrainConversationMessage,
  BrandBrainDisplaySource,
  BrandBrainRunSummary,
  BrandBrainStreamEvent,
} from "@/features/agents/brain/types";
import { cn } from "@/lib/utils";

type ChatMode = "text" | "image";

type ChatMessage = {
  id: string;
  role: BrandBrainChatRole;
  content: string;
  sources: BrandBrainDisplaySource[] | null;
  images?: string[] | null;
  imagePrompt?: string | null;
  pending?: boolean;
};

type HistoryTurn = { role: BrandBrainChatRole; content: string };

const STREAM_ENDPOINT = "/api/brain/stream";

const promptChips = [
  "Summarize this brand",
  "Find audience insights",
  "Draft positioning",
  "Compare competitors",
  "Generate campaign ideas",
  "Create an image",
] as const;

function isRtlText(text: string): boolean {
  const rtl = (text.match(/[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g) ?? []).length;
  const ltr = (text.match(/[a-zA-Z]/g) ?? []).length;
  return rtl > 0 && rtl > ltr;
}

function TypingDots() {
  return (
    <div className="flex gap-1 py-1">
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/45 [animation-delay:-0.3s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/45 [animation-delay:-0.15s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/45" />
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
  const hasImages = !!message.images && message.images.length > 0;
  const showTyping =
    !isUser &&
    !message.pending &&
    !hasImages &&
    isStreaming &&
    message.content.length === 0;
  const rtl = !isUser && !message.pending && message.content ? isRtlText(message.content) : false;

  return (
    <article
      className={cn(
        "flex w-full",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cn(
          "max-w-[min(42rem,100%)]",
          isUser
            ? "rounded-2xl bg-[#f1eadf] px-4 py-3 text-[15px] leading-relaxed text-foreground shadow-sm"
            : "text-[15px] leading-relaxed text-foreground",
        )}
        dir={rtl ? "rtl" : "ltr"}
      >
        {message.pending ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderIcon className="size-4 animate-spin" />
            Generating image...
          </p>
        ) : showTyping ? (
          <TypingDots />
        ) : message.content ? (
          <p className={cn("whitespace-pre-wrap", rtl && "text-right")}>{message.content}</p>
        ) : null}

        {hasImages ? (
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {message.images!.map((src, index) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={message.imagePrompt ?? "Generated brand image"}
                className="w-full rounded-xl border border-border bg-background"
                key={`${message.id}-img-${index}`}
                src={src}
              />
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function formatRunDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function groupRunsByDate(runs: BrandBrainRunSummary[]): { label: string; runs: BrandBrainRunSummary[] }[] {
  const groups = new Map<string, BrandBrainRunSummary[]>();
  for (const run of runs) {
    const label = formatRunDate(run.createdAt);
    const existing = groups.get(label);
    if (existing) {
      existing.push(run);
    } else {
      groups.set(label, [run]);
    }
  }
  return Array.from(groups.entries()).map(([label, runs]) => ({ label, runs }));
}

export function BrainChat({
  access,
  initialMessages = [],
  runSummaries = [],
}: {
  access: BrandBrainAccess;
  initialMessages?: BrandBrainConversationMessage[];
  runSummaries?: BrandBrainRunSummary[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    initialMessages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      sources: message.sources,
      images: message.images ?? null,
      imagePrompt: message.imagePrompt ?? null,
    })),
  );
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<ChatMode>("text");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isImagePending, setIsImagePending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<{ name: string; content: string } | null>(null);

  const isBusy = isStreaming || isImagePending;
  const isImageMode = mode === "image";

  const idRef = useRef(0);
  const lastRequestRef = useRef<{
    mode: ChatMode;
    prompt: string;
    history: HistoryTurn[];
  } | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function nextId() {
    idRef.current += 1;
    return `live-${idRef.current}`;
  }

  function updateMessage(
    id: string,
    updater: (message: ChatMessage) => ChatMessage,
  ) {
    setMessages((prev) =>
      prev.map((message) => (message.id === id ? updater(message) : message)),
    );
  }

  useEffect(() => {
    const node = threadRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [messages, isBusy]);

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
        // Sources are intentionally not surfaced to the UI.
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

  async function sendText(prompt: string, history: HistoryTurn[]) {
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

  async function sendImage(prompt: string) {
    const assistantId = nextId();
    setError(null);
    setIsImagePending(true);
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: "user", content: prompt, sources: null },
      {
        id: assistantId,
        role: "assistant",
        content: "",
        sources: null,
        images: null,
        pending: true,
      },
    ]);

    try {
      const result = await generateBrandBrainImageAction(prompt);
      if (result.status === "error") {
        throw new Error(result.message);
      }
      updateMessage(assistantId, (message) => ({
        ...message,
        pending: false,
        content: "",
        images: result.images,
        imagePrompt: result.imagePrompt,
        sources: null,
      }));
    } catch (caught) {
      setMessages((prev) => prev.filter((message) => message.id !== assistantId));
      setError(
        caught instanceof Error
          ? caught.message
          : "Brand Brain could not generate an image.",
      );
    } finally {
      setIsImagePending(false);
    }
  }

  function dispatch(
    requestMode: ChatMode,
    prompt: string,
    history: HistoryTurn[],
  ) {
    lastRequestRef.current = { mode: requestMode, prompt, history };
    if (requestMode === "image") {
      void sendImage(prompt);
    } else {
      void sendText(prompt, history);
    }
  }

  function snapshotHistory(): HistoryTurn[] {
    return messages
      .filter((message) => message.content.length > 0)
      .map((message) => ({ role: message.role, content: message.content }));
  }

  function submitPrompt(promptValue = input) {
    let prompt = promptValue.trim();
    if (!prompt && !attachedFile) return;
    if (isBusy) return;

    if (attachedFile) {
      const fileBlock = attachedFile.content
        ? `[Attached file: ${attachedFile.name}]\n${attachedFile.content}\n\n`
        : `[Attached file: ${attachedFile.name}]\n\n`;
      prompt = fileBlock + (prompt || "Please summarize or answer questions about this file.");
      setAttachedFile(null);
    }

    const history = mode === "text" ? snapshotHistory() : [];
    setInput("");
    dispatch(mode, prompt, history);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitPrompt();
  }

  function handleRetry() {
    if (!lastRequestRef.current || isBusy) return;
    const { mode: lastMode, prompt, history } = lastRequestRef.current;
    dispatch(lastMode, prompt, history);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  function handleNewChat() {
    if (isBusy) return;
    setMessages([]);
    setInput("");
    setMode("text");
    setError(null);
    setAttachedFile(null);
    lastRequestRef.current = null;
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setAttachedFile({ name: file.name, content: text.slice(0, 12000) });
    } catch {
      setAttachedFile({ name: file.name, content: "" });
    }
    event.target.value = "";
  }

  const isEmpty = messages.length === 0 && !isBusy && !error;
  const groupedHistory = groupRunsByDate(runSummaries);

  return (
    <div className="flex min-h-[calc(100svh-3.5rem)] bg-[#fbf8f4] text-foreground">
      {/* ── Main chat column ── */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-10 border-b border-black/5 bg-[#fbf8f4]/85 backdrop-blur">
          <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3 sm:px-8">
            <span className="flex size-7 items-center justify-center rounded-lg border border-black/5 bg-white shadow-sm">
              <BrainIcon className="size-4 text-primary" />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-foreground">Brand Brain</p>
              <p className="text-[11px] text-muted-foreground">{access.brandName}</p>
            </div>
          </div>
        </header>

        {/* Thread */}
        <div
          ref={threadRef}
          className="flex-1 overflow-y-auto px-4 pb-8 pt-12 sm:px-8"
        >
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col">
            {isEmpty ? (
              <section className="flex flex-1 flex-col items-center justify-center pb-20 text-center">
                <div className="mb-7 flex size-12 items-center justify-center rounded-2xl border border-black/5 bg-white shadow-sm">
                  <BrainIcon className="size-5 text-primary" />
                </div>
                <h1 className="text-2xl font-semibold tracking-normal text-foreground">
                  What should we dive into for {access.brandName}?
                </h1>
              </section>
            ) : (
              <div className="flex flex-1 flex-col justify-end gap-8">
                {messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    isStreaming={isStreaming}
                    message={message}
                  />
                ))}

                {error ? (
                  <div className="rounded-2xl border border-destructive/25 bg-background/80 p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-destructive">
                          Unable to process request
                        </p>
                        <p className="text-sm text-muted-foreground">{error}</p>
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
            )}
          </div>
        </div>

        {/* Input area */}
        <div className="sticky bottom-0 bg-linear-to-t from-[#fbf8f4] via-[#fbf8f4] to-[#fbf8f4]/0 px-4 pb-4 pt-8 sm:px-8">
          <div className="mx-auto w-full max-w-3xl">
            <form
              className="rounded-3xl border border-black/10 bg-white p-2 shadow-[0_18px_60px_-28px_rgba(15,15,20,0.45)]"
              onSubmit={handleSubmit}
            >
              {attachedFile ? (
                <div className="mb-1 flex items-center gap-1.5 px-3 pt-1">
                  <span className="flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-[12px] text-muted-foreground">
                    <PaperclipIcon className="size-3" />
                    <span className="max-w-[200px] truncate">{attachedFile.name}</span>
                    <button
                      className="ml-0.5 hover:text-foreground"
                      onClick={() => setAttachedFile(null)}
                      type="button"
                    >
                      <XIcon className="size-3" />
                    </button>
                  </span>
                </div>
              ) : null}
              <Textarea
                aria-label="Message Brand Brain"
                className="max-h-40 min-h-11 resize-none border-0 bg-transparent px-3 py-2 shadow-none focus-visible:ring-0"
                id="brand-brain-prompt"
                maxLength={brandBrainPromptMaxLength}
                name="prompt"
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message Brand Brain"
                rows={1}
                value={input}
              />
              <div className="flex items-center justify-between gap-2 px-1 pb-1">
                <div className="flex items-center gap-1">
                  <input
                    accept="text/*,.pdf,.doc,.docx,.csv,.json,.md"
                    className="hidden"
                    onChange={handleFileChange}
                    ref={fileInputRef}
                    type="file"
                  />
                  <Button
                    aria-label="Attach file"
                    onClick={() => fileInputRef.current?.click()}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <PaperclipIcon className="size-4" />
                  </Button>
                  <Button
                    className="gap-1.5 rounded-full"
                    onClick={() => setMode(isImageMode ? "text" : "image")}
                    size="sm"
                    type="button"
                    variant={isImageMode ? "secondary" : "ghost"}
                  >
                    {isImageMode ? (
                      <ImageIcon className="size-3.5" />
                    ) : (
                      <MessageSquareIcon className="size-3.5" />
                    )}
                    {isImageMode ? "Image" : "Smart"}
                  </Button>
                </div>
                <Button
                  aria-label="Send message"
                  className="rounded-full"
                  disabled={isBusy || (input.trim().length === 0 && !attachedFile)}
                  size="icon-sm"
                  type="submit"
                >
                  {isBusy ? (
                    <LoaderIcon className="size-4 animate-spin" />
                  ) : (
                    <SendIcon className="size-4" />
                  )}
                </Button>
              </div>
            </form>

            {isEmpty ? (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {promptChips.map((chip) => (
                  <button
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 text-xs text-muted-foreground shadow-sm transition hover:bg-muted hover:text-foreground"
                    key={chip}
                    onClick={() =>
                      chip === "Create an image"
                        ? setMode("image")
                        : submitPrompt(chip)
                    }
                    type="button"
                  >
                    {chip === "Create an image" ? (
                      <ImageIcon className="size-3.5" />
                    ) : (
                      <SparklesIcon className="size-3.5" />
                    )}
                    {chip}
                  </button>
                ))}
              </div>
            ) : null}

            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              Brand Brain can make mistakes. Review important answers before use.
            </p>
          </div>
        </div>
      </main>

      {/* ── Right history sidebar ── */}
      <aside className="hidden w-64 shrink-0 flex-col border-l border-black/5 bg-white md:flex xl:w-72">
        <div className="border-b border-black/5 p-3">
          <Button
            className="w-full gap-1.5 justify-start"
            disabled={isBusy}
            onClick={handleNewChat}
            size="sm"
            type="button"
            variant="outline"
          >
            <PlusIcon className="size-4" />
            New chat
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {groupedHistory.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <ClockIcon className="size-5 text-muted-foreground/40" />
              <p className="text-[12px] text-muted-foreground">
                Past conversations will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedHistory.map(({ label, runs }) => (
                <div key={label}>
                  <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    {label}
                  </p>
                  <div className="space-y-0.5">
                    {runs.map((run) => (
                      <div
                        className="group flex cursor-default rounded-lg px-2 py-1.5 hover:bg-muted/60"
                        key={run.id}
                        title={run.prompt}
                      >
                        <p className="line-clamp-2 text-[12px] text-muted-foreground group-hover:text-foreground">
                          {run.prompt || "…"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
