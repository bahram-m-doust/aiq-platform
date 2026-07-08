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
  RefreshCwIcon,
  SparklesIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MarkdownContent } from "@/components/markdown/MarkdownContent";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteBrainSessionAction,
  generateBrandBrainImageAction,
  loadBrainSessionAction,
} from "@/features/agents/brain/actions";
import { brandBrainPromptMaxLength } from "@/features/agents/brain/schema";
import {
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

function PanelBottomCloseIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      fill="none"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M2 10H14M10 5.33333L8 7.33333L6 5.33333M3.33333 2H12.6667C13.403 2 14 2.59695 14 3.33333V12.6667C14 13.403 13.403 14 12.6667 14H3.33333C2.59695 14 2 13.403 2 12.6667V3.33333C2 2.59695 2.59695 2 3.33333 2Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.33"
      />
    </svg>
  );
}

function FigmaPlusIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      fill="none"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M3.33333 8H12.6667M8 3.33333V12.6667"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.33"
      />
    </svg>
  );
}

function ChatArrowUpIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      fill="none"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M12.6667 8L8 3.33333L3.33333 8M8 3.33333V12.6667"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.33"
      />
    </svg>
  );
}

function ChatChevronDownIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      fill="none"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M4 6L8 10L12 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.33"
      />
    </svg>
  );
}

function ChatPaperclipIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      fill="none"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M14.2933 7.36667L8.16667 13.4933C7.4161 14.2439 6.39812 14.6656 5.33667 14.6656C4.27521 14.6656 3.25723 14.2439 2.50667 13.4933C1.7561 12.7428 1.33444 11.7248 1.33444 10.6633C1.33444 9.60188 1.7561 8.5839 2.50667 7.83333L8.22 2.12C8.72038 1.61874 9.39938 1.33679 10.1076 1.33616C10.8159 1.33553 11.4954 1.61629 11.9967 2.11667C12.4979 2.61704 12.7799 3.29605 12.7805 4.00431C12.7811 4.71257 12.5004 5.39207 12 5.89333L6.27333 11.6067C6.02315 11.8569 5.68382 11.9974 5.33 11.9974C4.97618 11.9974 4.63685 11.8569 4.38667 11.6067C4.13648 11.3565 3.99593 11.0172 3.99593 10.6633C3.99593 10.3095 4.13648 9.97019 4.38667 9.72L10.0467 4.06667"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.33"
      />
    </svg>
  );
}

function isRtlText(text: string): boolean {
  const rtl = (text.match(/[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g) ?? []).length;
  const ltr = (text.match(/[a-zA-Z]/g) ?? []).length;
  // Allow up to 3× more Latin chars before calling it LTR — Persian text often
  // mixes in English brand names, technical terms, and ** bold markers.
  return rtl > 0 && rtl * 3 >= ltr;
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
          isUser ? "rounded-2xl bg-[#F0F0F0] px-4 py-3" : "",
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
        ) : !hasImages && message.content ? (
          isUser ? (
            <p className="whitespace-pre-wrap text-justify">
              {message.content}
            </p>
          ) : (
            <MarkdownContent
              className="max-w-none text-[15px] [&_li]:text-justify [&_p]:text-justify"
              markdown={message.content}
            />
          )
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
  const [imageModel, setImageModel] = useState<ImageModelId | "">("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isImagePending, setIsImagePending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    content: string;
  } | null>(null);
  const [sessions, setSessions] = useState<BrandBrainRunSummary[]>(runSummaries);
  const [historyOpen, setHistoryOpen] = useState(false);
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
          // Deduplicate: old buggy code could write duplicate live-N IDs.
          const seen = new Set<string>();
          const unique = parsed.messages.filter((m) => {
            if (seen.has(m.id)) return false;
            seen.add(m.id);
            return true;
          });
          // Bump idRef past the highest live-N so new sends don't collide.
          let maxN = 0;
          for (const m of unique) {
            const match = /^live-(\d+)$/.exec(m.id);
            if (match) maxN = Math.max(maxN, parseInt(match[1], 10));
          }
          if (maxN > 0) idRef.current = maxN;

          queueMicrotask(() => {
            setMessages(unique);
            if (parsed.sessionId) sessionIdRef.current = parsed.sessionId;
            hydratedRef.current = true;
          });
          return;
        }
      } else {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch {
      /* sessionStorage unavailable or corrupt stash */
    }
    hydratedRef.current = true;
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
      const result = await generateBrandBrainImageAction(
        prompt,
        imageModel || undefined,
      );
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
    setHistoryOpen(false);
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
        setHistoryOpen(false);
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
    // Fixed height + overflow-hidden keeps the chat thread as the only
    // scrolling area inside this view.
    <div className="-m-4 flex h-[calc(100svh-68px)] overflow-hidden bg-white text-foreground">
      {/* ── Main chat column ── */}
      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="pointer-events-none absolute right-4 top-4 z-30 flex flex-col items-end gap-2 sm:right-8">
          <div className="pointer-events-auto flex items-center gap-2">
            <Button
              className="h-9 gap-0 rounded-md bg-transparent p-0 text-sm font-medium leading-5 tracking-normal text-[#0A0A0A] shadow-none hover:bg-transparent hover:text-[#0A0A0A]"
              disabled={isBusy}
              onClick={handleNewChat}
              type="button"
              variant="ghost"
            >
              <span className="flex size-9 items-center justify-center rounded-[39px] bg-[#F5F5F5] shadow-xs">
                <FigmaPlusIcon className="size-4" />
              </span>
              <span className="flex h-9 items-center rounded-md bg-transparent pl-[5px] pr-4">
                New Chat
              </span>
            </Button>

            <div className="relative">
              <Button
                aria-expanded={historyOpen}
                className="rounded-md bg-[#F5F5F5] text-sm font-medium leading-5 tracking-normal text-[#171717] shadow-xs hover:bg-[#EEEEEE] aria-expanded:bg-[#F5F5F5] aria-expanded:text-[#171717]"
                onClick={() => setHistoryOpen((open) => !open)}
                type="button"
                variant="secondary"
              >
                History
                <PanelBottomCloseIcon className="size-4" />
              </Button>

              {historyOpen ? (
                <div className="absolute right-0 top-[calc(100%+8px)] max-h-[min(420px,calc(100svh-144px))] w-[min(20rem,calc(100vw-2rem))] animate-in overflow-hidden rounded-xl border border-black/10 bg-white shadow-[0_18px_45px_rgba(9,9,43,0.12)] fade-in-0 slide-in-from-top-2">
                  <div className="border-b border-black/5 px-3 py-2">
                    <p className="text-sm font-medium text-foreground">
                      History
                    </p>
                  </div>
                  <div className="scrollbar-hide max-h-[min(360px,calc(100svh-228px))] overflow-y-auto p-2">
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
                                    onClick={() =>
                                      void handleLoadSession(session)
                                    }
                                    title={session.prompt}
                                  >
                                    <p
                                      className={cn(
                                        "flex-1 line-clamp-2 text-[12px] text-muted-foreground group-hover:text-foreground",
                                        rtl ? "text-right" : "text-left",
                                      )}
                                    >
                                      {session.prompt || "..."}
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
                </div>
              ) : null}
            </div>
          </div>
        </div>
        {/* Thread */}
        <div
          ref={threadRef}
          className="scrollbar-hide flex-1 overflow-y-auto px-4 pb-8 pt-20 sm:px-8"
        >
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col">
            {loadingSession ? (
              <div className="flex flex-1 items-center justify-center">
                <LoaderIcon className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : isEmpty ? null : (
              <div className="flex w-full max-w-[652px] flex-1 flex-col justify-end gap-8">
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
        <div
          className={cn(
            "px-4 sm:px-8",
            isEmpty
              ? "absolute inset-x-0 top-1/2 -translate-y-1/2"
              : "sticky bottom-0 bg-linear-to-t from-white via-white to-white/0 pb-4 pt-8",
          )}
        >
          <div
            className={cn(
              "mx-auto flex w-full flex-col",
              isEmpty ? "max-w-[652px]" : "max-w-3xl",
            )}
          >
            {isEmpty ? (
              <h1 className="mb-12 text-center text-2xl font-semibold tracking-normal text-foreground">
                What should we dive into for {access.brandName}?
              </h1>
            ) : null}

            <div className="w-full max-w-[652px] rounded-[24px] bg-[rgba(0,31,189,0.03)] p-[4px] shadow-[0_0_20px_rgba(16,16,89,0.04),0_16px_50px_rgba(16,16,89,0.17)] outline outline-1 outline-white/90 backdrop-blur-[24px]">
              <form
                className="flex min-h-[88px] flex-col justify-between rounded-[20px] bg-white px-2 py-2"
                onSubmit={handleSubmit}
              >
              {attachedFile ? (
                <div className="mb-1 flex items-center gap-1.5 px-3 pt-1">
                  <span className="flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-[12px] text-muted-foreground">
                    <ChatPaperclipIcon className="size-3" />
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
                className="max-h-40 min-h-8 resize-none border-0 bg-transparent px-3 py-1.5 text-[13px] shadow-none focus-visible:ring-0"
                id="brand-brain-prompt"
                maxLength={brandBrainPromptMaxLength}
                name="prompt"
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message Brand Brain"
                rows={1}
                value={input}
              />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <input
                    accept="text/*,.pdf,.doc,.docx,.csv,.json,.md"
                    className="hidden"
                    onChange={handleFileChange}
                    ref={fileInputRef}
                    type="file"
                  />
                  <Button
                    aria-label="Attach file"
                    className="size-[30px] rounded-full bg-transparent p-0 text-[#0A0A0A] opacity-50 shadow-none hover:bg-muted hover:opacity-100"
                    onClick={() => fileInputRef.current?.click()}
                    type="button"
                    variant="ghost"
                  >
                    <ChatPaperclipIcon className="size-4" />
                  </Button>
                  <div className="flex h-[30px] cursor-pointer items-center rounded-[60px] bg-[#F5F5F5]">
                    <button
                      className={cn(
                        "flex h-full items-center justify-center rounded-md px-2 py-1 text-center text-xs font-medium leading-none text-[#0A0A0A] transition",
                        isImageMode
                          ? "rounded-[32px] border border-[rgba(163,163,163,0.1)] bg-white"
                          : "bg-transparent hover:bg-white/60",
                      )}
                      onClick={() => setMode("image")}
                      type="button"
                    >
                      Image
                    </button>
                    <button
                      className={cn(
                        "flex h-full items-center justify-center rounded-md px-2 py-1 text-center text-xs font-medium leading-none text-[#0A0A0A] transition",
                        !isImageMode
                          ? "rounded-[32px] border border-[rgba(163,163,163,0.1)] bg-white"
                          : "bg-transparent hover:bg-white/60",
                      )}
                      onClick={() => setMode("text")}
                      type="button"
                    >
                      Smart
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {isImageMode ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          aria-label="Choose image model"
                          className="h-[30px] gap-1 rounded-full bg-transparent px-4 py-2 text-sm font-medium text-[#0A0A0A] opacity-50 shadow-none hover:bg-muted hover:opacity-100"
                          type="button"
                          variant="ghost"
                        >
                          Model
                          <ChatChevronDownIcon className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-72">
                        <DropdownMenuRadioGroup
                          onValueChange={(value) =>
                            setImageModel(value as ImageModelId)
                          }
                          value={imageModel}
                        >
                          {IMAGE_MODELS.map((model) => (
                            <DropdownMenuRadioItem
                              className="text-xs"
                              key={model.id}
                              value={model.id}
                            >
                              {model.name}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                  <Button
                    aria-label="Send message"
                    className="size-[30px] rounded-full bg-[#0A0A2E] p-0 text-[#FAFAFA] opacity-100 shadow-xs hover:bg-[#0A0A2E]/90 disabled:opacity-50"
                    disabled={
                      isBusy || (input.trim().length === 0 && !attachedFile)
                    }
                    type="submit"
                  >
                    {isStreaming || isImagePending ? (
                      <LoaderIcon className="size-4 animate-spin" />
                    ) : (
                      <ChatArrowUpIcon className="size-4" />
                    )}
                  </Button>
                </div>
              </div>
              </form>
            </div>

            {isEmpty ? (
              <div className="mt-12 flex flex-wrap justify-center gap-2">
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

            <p className="mt-3 w-full max-w-[652px] text-center text-[11px] text-muted-foreground">
              Brand Brain can make mistakes. Review important answers before
              use.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
