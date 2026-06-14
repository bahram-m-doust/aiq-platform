"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import {
  ArrowUpIcon,
  ImageIcon,
  Loader2Icon,
  SparklesIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { DSCard, DSCardBody } from "@/components/ds/Card";
import { Textarea } from "@/components/ui/textarea";
import type { AgentCatalogItem } from "@/features/agents/catalog/types";
import {
  resolveAgentImageUrlsAction,
  runAgentAction,
} from "@/features/agents/runs/actions";
import {
  agentRunPromptMaxLength,
  initialAgentRunFormState,
} from "@/features/agents/runs/schema";
import type { AgentRunHistoryItem } from "@/features/agents/runs/types";
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_TEXT_MODEL,
  IMAGE_MODELS,
  TEXT_MODELS,
  type ImageModelId,
  type TextModelId,
} from "@/lib/openrouter/models";

function formatTime(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getPlaceholder(agentKey: string) {
  if (agentKey === "IMAGE_GENERATOR") {
    return "Describe the image — subject, mood, composition. The text model will rewrite it on-brand before the image model renders it.";
  }
  if (agentKey === "VIDEO_GENERATOR") {
    return "Describe the video concept — scenes, narrative arc, mood. You'll get a production-ready brief on-brand.";
  }
  return "Ask a strategic question grounded in the brand's knowledge base…";
}

function ComposerSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  const isDisabled = pending || disabled;
  return (
    <Button
      aria-label={pending ? "Running" : "Send"}
      className="shrink-0 rounded-full"
      disabled={isDisabled}
      size="icon-lg"
      type="submit"
    >
      {pending ? (
        <Loader2Icon className="size-4 animate-spin" />
      ) : (
        <ArrowUpIcon className="size-4" strokeWidth={2.4} />
      )}
    </Button>
  );
}

export function AgentChatPanel({
  agent,
  defaultTextModel,
  defaultImageModel,
  runHistory = [],
}: {
  agent: AgentCatalogItem;
  defaultTextModel?: TextModelId;
  defaultImageModel?: ImageModelId;
  runHistory?: AgentRunHistoryItem[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [state, formAction] = useActionState(
    runAgentAction,
    initialAgentRunFormState,
  );

  const [textModel, setTextModel] = useState<TextModelId>(
    defaultTextModel ?? DEFAULT_TEXT_MODEL,
  );
  const [imageModel, setImageModel] = useState<ImageModelId>(
    defaultImageModel ?? DEFAULT_IMAGE_MODEL,
  );
  const [draft, setDraft] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const lastResolvedRunIdRef = useRef<string | null>(null);

  const isImageAgent = agent.key === "IMAGE_GENERATOR";

  // Refresh server data after a successful run, reset the composer.
  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  }, [router, state.status, state.runId]);

  // Resolve signed image URLs for the latest run.
  useEffect(() => {
    const runId = state.runId ?? null;
    const paths = state.imagePaths ?? [];
    if (state.status !== "success") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setImageUrls([]);
      return;
    }
    if (
      !runId ||
      runId === lastResolvedRunIdRef.current ||
      paths.length === 0
    ) {
      return;
    }
    lastResolvedRunIdRef.current = runId;
    let cancelled = false;
    resolveAgentImageUrlsAction(paths).then((urls) => {
      if (cancelled) return;
      setImageUrls(urls);
    });
    return () => {
      cancelled = true;
    };
  }, [state.status, state.runId, state.imagePaths]);

  // Auto-scroll to the bottom whenever the conversation grows.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof el.scrollTo !== "function") return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [runHistory.length, state.runId, imageUrls.length]);

  const conversation = [...runHistory].reverse();

  function autoResize(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setDraft(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 220)}px`;
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (draft.trim().length > 0) {
        formRef.current?.requestSubmit();
      }
    }
  }

  const isEmpty =
    conversation.length === 0 && !(state.status === "success" && state.answer);

  return (
    <DSCard tone="default" className="overflow-hidden">
      <DSCardBody className="space-y-0 p-0">
        {/* Conversation */}
        <div
          ref={scrollRef}
          className="max-h-[min(60vh,520px)] min-h-[280px] overflow-y-auto px-5 py-6"
        >
          {isEmpty ? (
            <EmptyState agentKey={agent.key} agentName={agent.name} />
          ) : (
            <ol className="space-y-5">
              {conversation.map((run) => (
                <ConversationTurn
                  key={run.id}
                  prompt={run.promptExcerpt}
                  answer={run.answerExcerpt}
                  model={run.model}
                  sources={run.sources}
                  createdAt={run.createdAt}
                />
              ))}
              {state.status === "success" && state.answer ? (
                <ConversationTurn
                  prompt={""}
                  answer={state.answer}
                  model={null}
                  sources={state.sources ?? []}
                  createdAt={null}
                  images={imageUrls}
                  emphasizeLatest
                />
              ) : null}
            </ol>
          )}
        </div>

        {/* Composer */}
        <form
          ref={formRef}
          action={formAction}
          className="border-t"
          style={{
            borderColor: "var(--bv-line)",
            background: "var(--bv-card-soft)",
          }}
        >
          <input name="agent_key" type="hidden" value={agent.key} />
          <input name="text_model" type="hidden" value={textModel} />
          {isImageAgent ? (
            <input name="image_model" type="hidden" value={imageModel} />
          ) : null}

          {state.status === "error" && state.message ? (
            <div
              className="border-b px-5 py-2.5 text-xs"
              style={{
                borderColor: "var(--bv-line)",
                color: "#9b1c1c",
                background: "#fef2f2",
              }}
            >
              {state.message}
            </div>
          ) : null}

          <div className="px-5 pt-4">
            <Textarea
              ref={textareaRef}
              id="agent-run-prompt"
              name="prompt"
              maxLength={agentRunPromptMaxLength}
              placeholder={getPlaceholder(agent.key)}
              required
              rows={1}
              value={draft}
              onChange={autoResize}
              onKeyDown={onKeyDown}
              className="block min-h-11 resize-none border-0 bg-transparent text-[15px] leading-6 shadow-none focus-visible:border-transparent focus-visible:ring-0"
              style={{ color: "var(--bv-ink)", minHeight: "44px" }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-4 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <ModelPill
                icon={SparklesIcon}
                value={textModel}
                onChange={(v) => setTextModel(v as TextModelId)}
                options={TEXT_MODELS.map((m) => ({ id: m.id, label: m.name }))}
                ariaLabel="Text model"
              />
              {isImageAgent ? (
                <ModelPill
                  icon={ImageIcon}
                  value={imageModel}
                  onChange={(v) => setImageModel(v as ImageModelId)}
                  options={IMAGE_MODELS.map((m) => ({
                    id: m.id,
                    label: m.name,
                  }))}
                  ariaLabel="Image model"
                />
              ) : null}
            </div>
            <ComposerSubmitButton disabled={draft.trim().length === 0} />
          </div>
        </form>
      </DSCardBody>
    </DSCard>
  );
}

// Backward-compat re-export for any other importers.
export { AgentChatPanel as AgentRunPanel };

function EmptyState({
  agentKey,
  agentName,
}: {
  agentKey: string;
  agentName: string;
}) {
  const lines: Record<string, string> = {
    STORY_TELLER:
      "Ask for narrative angles, positioning lines, or message hierarchy grounded in your brand knowledge.",
    IMAGE_GENERATOR:
      "Describe a scene — the agent rewrites it on-brand and generates a PNG you can download.",
    VIDEO_GENERATOR:
      "Outline a concept and get a production-ready brief: scenes, narrative arc, mood, and prompts.",
    CAMPAIGN_MAKER:
      "Brief an audience, channel, or rollout — get a strategic campaign skeleton in seconds.",
    BRAND_DIGITAL_ACTIVATION:
      "Describe a touchpoint or journey — get an activation plan grounded in your brand system.",
  };
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <span
        aria-hidden
        className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-white"
        style={{
          background: "var(--bv-brand-mid)",
          boxShadow: "0 8px 20px var(--bv-brand-tint-32)",
        }}
      >
        <SparklesIcon className="size-5" />
      </span>
      <p
        className="font-mono text-[10.5px] uppercase tracking-[0.16em]"
        style={{ color: "var(--bv-ink-4)" }}
      >
        Workspace ready
      </p>
      <h3
        className="mt-2 text-base font-semibold"
        style={{ color: "var(--bv-ink)" }}
      >
        Talk to {agentName}
      </h3>
      <p
        className="mt-2 max-w-md text-sm leading-6"
        style={{ color: "var(--bv-ink-3)" }}
      >
        {lines[agentKey] ??
          "Send a prompt below. The agent grounds every response in the current brand's knowledge base."}
      </p>
    </div>
  );
}

function ConversationTurn({
  prompt,
  answer,
  model,
  sources,
  createdAt,
  images,
  emphasizeLatest = false,
}: {
  prompt: string;
  answer: string;
  model: string | null;
  sources: { fileName: string; score: number | null }[];
  createdAt: string | null;
  images?: string[];
  emphasizeLatest?: boolean;
}) {
  return (
    <li className="space-y-3">
      {prompt ? (
        <div className="flex justify-end">
          <div
            className="max-w-[78%] rounded-2xl px-4 py-2.5 text-[14.5px] leading-6"
            style={{
              background: "var(--bv-brand-tint-16)",
              color: "var(--bv-ink)",
              border: "1px solid var(--bv-brand-tint-32)",
            }}
          >
            {prompt}
          </div>
        </div>
      ) : null}
      <div className="flex justify-start">
        <div
          className="max-w-[88%] space-y-3 rounded-2xl px-4 py-3"
          style={{
            background: "var(--bv-card)",
            border: emphasizeLatest
              ? "1px solid var(--bv-brand-tint-32)"
              : "1px solid var(--bv-line)",
            boxShadow: emphasizeLatest ? "var(--bv-shadow-card)" : "none",
          }}
        >
          {images && images.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {images.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={url}
                  alt={`Generated image ${i + 1}`}
                  src={url}
                  className="w-full rounded-xl"
                  style={{ border: "1px solid var(--bv-line)" }}
                />
              ))}
            </div>
          ) : null}
          <p
            className="whitespace-pre-wrap text-[14.5px] leading-6"
            style={{ color: "var(--bv-ink)" }}
          >
            {answer}
          </p>
          {(sources.length > 0 || model || createdAt) ? (
            <div
              className="flex flex-wrap items-center gap-2 border-t pt-2"
              style={{ borderColor: "var(--bv-line-dashed)" }}
            >
              {model ? (
                <span
                  className="font-mono text-[10px] uppercase tracking-[0.12em]"
                  style={{ color: "var(--bv-ink-4)" }}
                >
                  {model}
                </span>
              ) : null}
              {createdAt ? (
                <span
                  className="font-mono text-[10px]"
                  style={{ color: "var(--bv-ink-4)" }}
                >
                  · {formatTime(createdAt)}
                </span>
              ) : null}
              {sources.map((source) => (
                <span
                  key={`${source.fileName}-${source.score ?? "src"}`}
                  className="rounded-full px-2 py-0.5 text-[10.5px]"
                  style={{
                    background: "var(--bv-brand-tint-8)",
                    color: "var(--bv-brand-deep)",
                    border: "1px solid var(--bv-brand-tint-16)",
                  }}
                >
                  {source.fileName}
                  {source.score !== null
                    ? ` · ${Math.round(source.score * 100)}%`
                    : ""}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function ModelPill({
  icon: Icon,
  value,
  onChange,
  options,
  ariaLabel,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  onChange: (value: string) => void;
  options: { id: string; label: string }[];
  ariaLabel: string;
}) {
  return (
    <label
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
      style={{
        borderColor: "var(--bv-line)",
        background: "var(--bv-card)",
        color: "var(--bv-ink-2)",
      }}
    >
      <Icon className="size-3.5" />
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer border-0 bg-transparent pr-1 text-xs focus:outline-none"
        style={{ color: "var(--bv-ink)" }}
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
