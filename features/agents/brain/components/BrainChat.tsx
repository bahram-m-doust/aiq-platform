"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircleIcon,
  CheckIcon,
  ClipboardIcon,
  ClockIcon,
  DownloadIcon,
  ImageIcon,
  LoaderIcon,
  MessageSquareIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  PaperclipIcon,
  PlusIcon,
  RefreshCwIcon,
  SendIcon,
  SparklesIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteBrainSessionAction,
  generateBrandBrainImageAction,
  loadBrainSessionAction,
} from "@/features/agents/brain/actions";
import { brandBrainPromptMaxLength } from "@/features/agents/brain/schema";
import {
  DEFAULT_IMAGE_MODEL,
  IMAGE_MODELS,
  type ImageModelId,
} from "@/lib/openrouter/models";
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
  createdAt?: string | null;
};

type HistoryTurn = { role: BrandBrainChatRole; content: string };

type ContentPart =
  | { type: "text"; text: string }
  | { type: "code"; text: string; lang: string };

const STREAM_ENDPOINT = "/api/brain/stream";

// Key for stashing the in-flight chat in sessionStorage. We restore it only on
// a browser refresh/hard reset (navigation type "reload"); leaving the page and
// coming back is a soft navigation and should land on a clean New Chat.
const SESSION_STORAGE_KEY = "brand-brain-active-chat";

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
  // Allow up to 3× more Latin chars before calling it LTR — Persian text often
  // mixes in English brand names, technical terms, and ** bold markers.
  return rtl > 0 && rtl * 3 >= ltr;
}

function parseContent(raw: string): ContentPart[] {
  const parts: ContentPart[] = [];
  const regex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      const text = raw.slice(lastIndex, match.index);
      if (text.trim()) parts.push({ type: "text", text });
    }
    parts.push({ type: "code", text: match[2].trimEnd(), lang: match[1] || "code" });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < raw.length) {
    const text = raw.slice(lastIndex);
    if (text.trim()) parts.push({ type: "text", text });
  }

  return parts;
}

function renderBoldText(text: string): React.ReactNode {
  const segments = text.split(/(\*\*[^*\n]+\*\*)/g);
  if (segments.length === 1) return text;
  return segments.map((seg, i) =>
    seg.startsWith("**") && seg.endsWith("**") ? (
      <strong key={i}>{seg.slice(2, -2)}</strong>
    ) : (
      seg
    ),
  );
}

function CopyIconButton({ text, compact = false }: { text: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard denied */
    }
  }

  if (compact) {
    return (
      <button
        aria-label="Copy code"
        className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-muted-foreground transition hover:bg-background/60 hover:text-foreground"
        onClick={handleCopy}
        type="button"
      >
        {copied ? (
          <CheckIcon className="size-3 text-green-500" />
        ) : (
          <ClipboardIcon className="size-3" />
        )}
        {copied ? "Copied" : "Copy"}
      </button>
    );
  }

  return (
    <button
      aria-label="Copy message"
      className="mt-1 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground/50 opacity-0 transition hover:bg-muted hover:text-muted-foreground group-hover/msg:opacity-100"
      onClick={handleCopy}
      type="button"
    >
      {copied ? (
        <CheckIcon className="size-3 text-green-500" />
      ) : (
        <ClipboardIcon className="size-3" />
      )}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

async function downloadImage(src: string, index: number) {
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = `brand-image-${index + 1}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
  } catch {
    /* download failed */
  }
}

function ImageActionBar({
  src,
  index,
  prompt,
}: {
  src: string;
  index: number;
  prompt: string | null | undefined;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopyPrompt() {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard denied */
    }
  }

  return (
    <div className="mt-2 flex gap-2">
      <button
        className="flex items-center gap-1 rounded-full border border-black/10 bg-white/90 px-2.5 py-1 text-[11px] text-muted-foreground shadow-sm transition hover:bg-white hover:text-foreground"
        onClick={() => void downloadImage(src, index)}
        title="Download image"
        type="button"
      >
        <DownloadIcon className="size-3" />
        Download
      </button>
      {prompt ? (
        <button
          className="flex items-center gap-1 rounded-full border border-black/10 bg-white/90 px-2.5 py-1 text-[11px] text-muted-foreground shadow-sm transition hover:bg-white hover:text-foreground"
          onClick={() => void handleCopyPrompt()}
          title="Copy image prompt"
          type="button"
        >
          {copied ? (
            <CheckIcon className="size-3 text-green-500" />
          ) : (
            <ClipboardIcon className="size-3" />
          )}
          {copied ? "Copied!" : "Copy Prompt"}
        </button>
      ) : null}
    </div>
  );
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  return (
    <div className="my-3 overflow-hidden rounded-lg border border-border bg-muted/60" dir="ltr">
      <div className="flex items-center justify-between border-b border-border/60 bg-muted px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
          {lang === "code" ? "Prompt" : lang}
        </span>
        <CopyIconButton compact text={code} />
      </div>
      <pre className="overflow-x-auto p-3 text-[13px] leading-relaxed">
        <code className="font-mono text-foreground">{code}</code>
      </pre>
    </div>
  );
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
  const rtl =
    !message.pending && message.content ? isRtlText(message.content) : false;
  const parts = message.content ? parseContent(message.content) : [];

  return (
    <article
      className={cn(
        "group/msg flex w-full flex-col",
        isUser ? "items-end" : "items-start",
      )}
    >
      <div
        className={cn(
          "max-w-[min(42rem,100%)] text-[15px] leading-relaxed text-foreground",
          // AI messages are full-width so a short RTL line (e.g. "سلام. …") has
          // room to be pushed right by dir="rtl". User bubbles stay auto-width
          // because they have a visible bordered background.
          !isUser && "w-full",
          isUser
            ? "rounded-2xl border border-black/10 bg-white px-4 py-3 shadow-sm"
            : "",
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
        ) : !hasImages && parts.length > 0 ? (
          <>
            {parts.map((part, i) =>
              part.type === "code" ? (
                <CodeBlock key={i} code={part.text} lang={part.lang} />
              ) : (
                // text-align: justify works for both LTR and RTL when the
                // element's `dir` is set; we must NOT add text-right, which
                // would override the justification for Persian.
                <p key={i} className="whitespace-pre-wrap text-justify">
                  {renderBoldText(part.text)}
                </p>
              ),
            )}
          </>
        ) : null}

        {hasImages ? (
          <div className="mt-1 flex flex-col gap-4">
            {message.images!.map((src, index) => (
              <div key={`${message.id}-img-${index}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt="Generated brand image"
                  className="w-full rounded-xl border border-border bg-muted"
                  src={src}
                />
                <ImageActionBar
                  index={index}
                  prompt={message.imagePrompt}
                  src={src}
                />
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {!message.pending && !showTyping && message.content && !hasImages ? (
        // User messages are on the right → [copy][time] right-aligned.
        // AI messages are on the left  → [time][copy] left-aligned.
        // Layout is role-based, not content-direction-based.
        <div
          className={cn(
            "mt-0.5 flex w-full items-center gap-1",
            isUser ? "justify-end" : "justify-start",
          )}
        >
          {isUser ? (
            <>
              <CopyIconButton text={message.content} />
              <span className="text-[10px] text-muted-foreground/50">
                {formatTime(message.createdAt)}
              </span>
            </>
          ) : (
            <>
              <span className="text-[10px] text-muted-foreground/50">
                {formatTime(message.createdAt)}
              </span>
              <CopyIconButton text={message.content} />
            </>
          )}
        </div>
      ) : null}
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

function groupSessionsByDate(
  sessions: BrandBrainRunSummary[],
): { label: string; sessions: BrandBrainRunSummary[] }[] {
  const groups = new Map<string, BrandBrainRunSummary[]>();
  for (const session of sessions) {
    const label = formatRunDate(session.createdAt);
    const existing = groups.get(label);
    if (existing) {
      existing.push(session);
    } else {
      groups.set(label, [session]);
    }
  }
  return Array.from(groups.entries()).map(([label, sessions]) => ({
    label,
    sessions,
  }));
}

function modelDisplayName(model: string): string {
  return model.split("/").pop() ?? model;
}

function formatTime(iso?: string | null): string {
  const date = iso ? new Date(iso) : new Date();
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function BrainChat({
  access,
  initialMessages = [],
  runSummaries = [],
  model = "openai/gpt-4o-mini",
}: {
  access: BrandBrainAccess;
  initialMessages?: BrandBrainConversationMessage[];
  runSummaries?: BrandBrainRunSummary[];
  model?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    initialMessages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      sources: message.sources,
      images: message.images ?? null,
      imagePrompt: message.imagePrompt ?? null,
      createdAt: message.createdAt ?? null,
    })),
  );
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<ChatMode>("text");
  const [imageModel, setImageModel] = useState<ImageModelId>(
    DEFAULT_IMAGE_MODEL,
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const [isImagePending, setIsImagePending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    content: string;
  } | null>(null);
  const [sessions, setSessions] = useState<BrandBrainRunSummary[]>(runSummaries);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loadingSession, setLoadingSession] = useState(false);
  const sessionIdRef = useRef<string>(crypto.randomUUID());

  const isBusy = isStreaming || isImagePending || loadingSession;
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

  // Restore the active chat only when the page was reloaded (refresh / hard
  // reset). On a soft navigation back into Brand Brain, drop any stash so we
  // open a fresh New Chat. hydratedRef gates the save effect so it never writes
  // the initial empty state over a stash before we've had a chance to restore.
  const hydratedRef = useRef(false);
  useEffect(() => {
    try {
      const nav = performance.getEntriesByType(
        "navigation",
      )[0] as PerformanceNavigationTiming | undefined;
      const isReload = nav?.type === "reload";
      const stash = sessionStorage.getItem(SESSION_STORAGE_KEY);

      if (isReload && stash) {
        const parsed = JSON.parse(stash) as {
          sessionId?: string;
          messages?: ChatMessage[];
        };
        if (parsed.messages && parsed.messages.length > 0) {
          setMessages(parsed.messages);
          if (parsed.sessionId) sessionIdRef.current = parsed.sessionId;
        }
      } else {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch {
      /* sessionStorage unavailable or corrupt stash */
    }
    hydratedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist the current chat so a refresh can restore it. Skip while a turn is
  // streaming (partial assistant content) to avoid stashing half-written state.
  useEffect(() => {
    if (!hydratedRef.current || isStreaming || isImagePending) return;
    try {
      if (messages.length === 0) {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      } else {
        sessionStorage.setItem(
          SESSION_STORAGE_KEY,
          JSON.stringify({ sessionId: sessionIdRef.current, messages }),
        );
      }
    } catch {
      /* sessionStorage write failed (quota / disabled) */
    }
  }, [messages, isStreaming, isImagePending]);

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
      body: JSON.stringify({
        prompt,
        history,
        sessionId: sessionIdRef.current,
      }),
    });

    if (!response.ok || !response.body) {
      let message = "Brand Brain could not complete this request.";
      try {
        const payload = await response.json();
        if (payload && typeof payload.message === "string") {
          message = payload.message;
        }
      } catch {
        /* non-JSON body */
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
        if (trimmed) handleEvent(JSON.parse(trimmed) as BrandBrainStreamEvent);
      }
    };

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      drain(decoder.decode(value, { stream: true }));
    }
    const tail = buffer.trim();
    if (tail) handleEvent(JSON.parse(tail) as BrandBrainStreamEvent);
  }

  async function sendText(
    prompt: string,
    history: HistoryTurn[],
    isFirstInSession: boolean,
    shortPrompt: string,
  ) {
    const userId = nextId();
    const assistantId = nextId();
    setError(null);
    setIsStreaming(true);
    const now = new Date().toISOString();
    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", content: prompt, sources: null, createdAt: now },
      { id: assistantId, role: "assistant", content: "", sources: null, createdAt: now },
    ]);

    if (isFirstInSession) {
      const newSession: BrandBrainRunSummary = {
        id: sessionIdRef.current,
        prompt: shortPrompt.slice(0, 120),
        createdAt: new Date().toISOString(),
        isSession: true,
      };
      setSessions((prev) => [newSession, ...prev]);
    }

    try {
      await runStream(prompt, history, assistantId);
    } catch (caught) {
      setMessages((prev) =>
        prev.filter(
          (message) =>
            message.id !== assistantId || message.content.length > 0,
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
    const userId = nextId();
    const assistantId = nextId();
    setError(null);
    setIsImagePending(true);
    const now = new Date().toISOString();
    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", content: prompt, sources: null, createdAt: now },
      {
        id: assistantId,
        role: "assistant",
        content: "",
        sources: null,
        images: null,
        pending: true,
        createdAt: now,
      },
    ]);

    try {
      const result = await generateBrandBrainImageAction(prompt, imageModel);
      if (result.status === "error") throw new Error(result.message);
      updateMessage(assistantId, (message) => ({
        ...message,
        pending: false,
        content: "",
        images: result.images,
        imagePrompt: result.imagePrompt,
        sources: null,
      }));
    } catch (caught) {
      setMessages((prev) =>
        prev.filter((message) => message.id !== assistantId),
      );
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
    isFirstInSession: boolean,
    shortPrompt: string,
  ) {
    lastRequestRef.current = { mode: requestMode, prompt, history };
    if (requestMode === "image") {
      void sendImage(prompt);
    } else {
      void sendText(prompt, history, isFirstInSession, shortPrompt);
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

    const isFirstInSession = messages.length === 0;
    const shortPrompt = prompt || attachedFile?.name || "";

    if (attachedFile) {
      const fileBlock = attachedFile.content
        ? `[Attached file: ${attachedFile.name}]\n${attachedFile.content}\n\n`
        : `[Attached file: ${attachedFile.name}]\n\n`;
      prompt =
        fileBlock +
        (prompt || "Please summarize or answer questions about this file.");
      setAttachedFile(null);
    }

    const history = mode === "text" ? snapshotHistory() : [];
    setInput("");
    dispatch(mode, prompt, history, isFirstInSession, shortPrompt);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitPrompt();
  }

  function handleRetry() {
    if (!lastRequestRef.current || isBusy) return;
    const { mode: lastMode, prompt, history } = lastRequestRef.current;
    dispatch(lastMode, prompt, history, false, "");
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
    sessionIdRef.current = crypto.randomUUID();
  }

  async function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
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

  async function handleDeleteSession(session: BrandBrainRunSummary) {
    setSessions((prev) => prev.filter((s) => s.id !== session.id));
    await deleteBrainSessionAction(session.id, session.isSession);
  }

  async function handleLoadSession(session: BrandBrainRunSummary) {
    if (isBusy) return;
    setLoadingSession(true);
    setError(null);
    try {
      const result = await loadBrainSessionAction(session.id, session.isSession);
      if (result.messages) {
        setMessages(
          result.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            sources: m.sources,
            images: m.images ?? null,
            imagePrompt: m.imagePrompt ?? null,
            createdAt: m.createdAt ?? null,
          })),
        );
        sessionIdRef.current = session.isSession
          ? session.id
          : crypto.randomUUID();
        setInput("");
        setAttachedFile(null);
        lastRequestRef.current = null;
      }
    } finally {
      setLoadingSession(false);
    }
  }

  const isEmpty = messages.length === 0 && !isBusy && !error;
  const groupedSessions = groupSessionsByDate(sessions);

  return (
    // -m-4 cancels the app layout's p-4 wrapper so BrainChat fills edge-to-edge.
    // Fixed height + overflow-hidden makes the thread and the sidebar each own
    // their own scroll, independent of the document/page scroll.
    <div className="-m-4 flex h-[calc(100svh-68px)] overflow-hidden bg-[#fbf8f4] text-foreground">
      {/* ── Main chat column ── */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Thread */}
        <div
          ref={threadRef}
          className="flex-1 overflow-y-auto px-4 pb-8 pt-8 sm:px-8"
        >
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col">
            {loadingSession ? (
              <div className="flex flex-1 items-center justify-center">
                <LoaderIcon className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : isEmpty ? (
              <section className="flex flex-1 flex-col items-center justify-center pb-20 text-center">
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
                    <span className="max-w-[200px] truncate">
                      {attachedFile.name}
                    </span>
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
                    {!isImageMode ? (
                      <span className="text-[10px] text-muted-foreground">
                        · {modelDisplayName(model)}
                      </span>
                    ) : null}
                  </Button>
                  {isImageMode ? (
                    <label className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] text-muted-foreground">
                      <span className="sr-only">Image model</span>
                      <select
                        aria-label="Image model"
                        className="cursor-pointer border-0 bg-transparent pr-1 text-[11px] text-foreground focus:outline-none"
                        onChange={(event) =>
                          setImageModel(event.target.value as ImageModelId)
                        }
                        value={imageModel}
                      >
                        {IMAGE_MODELS.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </div>
                <Button
                  aria-label="Send message"
                  className="rounded-full"
                  disabled={
                    isBusy || (input.trim().length === 0 && !attachedFile)
                  }
                  size="icon-sm"
                  type="submit"
                >
                  {isStreaming || isImagePending ? (
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
              Brand Brain can make mistakes. Review important answers before
              use.
            </p>
          </div>
        </div>
      </main>

      {/* ── Right history sidebar ──
          Collapsed state is a slim rail with just the expand button, so
          toggling only changes the sidebar's own width (the chat reflows
          minimally). The page itself never scrolls — each pane scrolls on
          its own. */}
      {!sidebarOpen ? (
        <aside className="hidden w-12 shrink-0 flex-col items-center border-l border-black/5 bg-white py-3 md:flex">
          <Button
            aria-label="Show history"
            className="text-muted-foreground"
            onClick={() => setSidebarOpen(true)}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <PanelRightOpenIcon className="size-4" />
          </Button>
        </aside>
      ) : (
        <aside className="hidden w-64 shrink-0 flex-col overflow-hidden border-l border-black/5 bg-white md:flex xl:w-72">
          <div className="flex items-center gap-2 border-b border-black/5 p-3">
            <Button
              className="flex-1 justify-start gap-1.5"
              disabled={isBusy}
              onClick={handleNewChat}
              size="sm"
              type="button"
              variant="outline"
            >
              <PlusIcon className="size-4" />
              New chat
            </Button>
            <Button
              aria-label="Hide history"
              className="text-muted-foreground"
              onClick={() => setSidebarOpen(false)}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <PanelRightCloseIcon className="size-4" />
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {groupedSessions.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <ClockIcon className="size-5 text-muted-foreground/40" />
                <p className="text-[12px] text-muted-foreground">
                  Past conversations will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {groupedSessions.map(({ label, sessions: group }) => (
                  <div key={label}>
                    <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                      {label}
                    </p>
                    <div className="space-y-0.5">
                      {group.map((session) => {
                        const rtl = isRtlText(session.prompt);
                        return (
                          <div
                            className="group flex cursor-pointer items-start gap-1 rounded-lg px-2 py-1.5 hover:bg-muted/60"
                            dir={rtl ? "rtl" : "ltr"}
                            key={session.id}
                            onClick={() => void handleLoadSession(session)}
                            title={session.prompt}
                          >
                            <p
                              className={cn(
                                "flex-1 line-clamp-2 text-[12px] text-muted-foreground group-hover:text-foreground",
                                rtl ? "text-right" : "text-left",
                              )}
                            >
                              {session.prompt || "…"}
                            </p>
                            <button
                              aria-label="Delete session"
                              className="mt-0.5 shrink-0 rounded p-0.5 text-transparent transition hover:text-destructive group-hover:text-muted-foreground/40"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleDeleteSession(session);
                              }}
                              type="button"
                            >
                              <Trash2Icon className="size-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
