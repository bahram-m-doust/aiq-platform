import {
  BookOpenIcon,
  ImageIcon,
  MegaphoneIcon,
  SparklesIcon,
  VideoIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react";

import { DSCard, DSCardBody, DSCardHeader } from "@/components/ds/Card";
import { AgentActivationForm } from "@/features/agents/catalog/components/AgentActivationForm";
import { agentDisplayStateLabels } from "@/features/agents/catalog/schema";
import { AgentChatPanel } from "@/features/agents/runs/components/AgentRunPanel";
import type {
  AgentCatalogAccess,
  AgentCatalogItem,
  CatalogAgentDisplayState,
} from "@/features/agents/catalog/types";
import type { AgentRunHistoryItem } from "@/features/agents/runs/types";
import type { ImageModelId, TextModelId } from "@/lib/openrouter/models";

const agentIcons: Record<string, LucideIcon> = {
  STORY_TELLER: BookOpenIcon,
  IMAGE_GENERATOR: ImageIcon,
  VIDEO_GENERATOR: VideoIcon,
  CAMPAIGN_MAKER: MegaphoneIcon,
  BRAND_DIGITAL_ACTIVATION: ZapIcon,
};

const stateTokenColors: Record<CatalogAgentDisplayState, string> = {
  ACTIVE: "var(--bv-brand-deep)",
  AVAILABLE: "var(--bv-c2-b)",
  LOCKED_BY_BRAIN: "var(--bv-c1-b)",
  LOCKED_BY_PLAN: "var(--bv-ink-3)",
  SUSPENDED: "#c02c2c",
};

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Not recorded";
}

function humanize(name: string) {
  return name
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AgentDetail({
  access,
  agent,
  runHistory = [],
  defaultTextModel,
  defaultImageModel,
}: {
  access: AgentCatalogAccess;
  agent: AgentCatalogItem;
  runHistory?: AgentRunHistoryItem[];
  defaultTextModel?: TextModelId;
  defaultImageModel?: ImageModelId;
}) {
  const Icon = agentIcons[agent.key] ?? SparklesIcon;
  const displayName = humanize(agent.name);
  const stateColor = stateTokenColors[agent.displayState];

  return (
    <div className="space-y-6">
      {/* ── Hero card ── */}
      <DSCard tone="default" className="relative">
        {/* Brand glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full blur-3xl"
          style={{ background: "var(--bv-brand-tint-16)" }}
        />
        <DSCardBody className="relative flex flex-col gap-6 px-6 py-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <span
              aria-hidden
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white"
              style={{
                background: "var(--bv-brand-mid)",
                boxShadow: "0 10px 26px var(--bv-brand-tint-32)",
              }}
            >
              <Icon className="size-7" strokeWidth={1.8} />
            </span>
            <div className="space-y-1.5">
              <h2 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--bv-ink)" }}>
                {displayName}
              </h2>
              <p className="text-sm leading-6" style={{ color: "var(--bv-ink-3)" }}>
                {agent.description}
              </p>
            </div>
          </div>
          <span
            className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em]"
            style={{
              color: stateColor,
              background: `${stateColor}14`,
              border: `1px solid ${stateColor}33`,
            }}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: stateColor }}
            />
            {agentDisplayStateLabels[agent.displayState]}
          </span>
        </DSCardBody>
        <div
          className="grid grid-cols-1 gap-px border-t sm:grid-cols-3"
          style={{ background: "var(--bv-line)", borderColor: "var(--bv-line)" }}
        >
          <MetaCell label="Brand" value={access.brandName} />
          <MetaCell label="Role" value={access.membershipRole} />
          <MetaCell label="Activated" value={formatDate(agent.activatedAt)} mono />
        </div>
        {agent.stateMessage ? (
          <div
            className="border-t px-6 py-3 text-xs"
            style={{
              borderColor: "var(--bv-line)",
              color: "var(--bv-ink-3)",
              background: "var(--bv-card-soft)",
            }}
          >
            {agent.stateMessage}
          </div>
        ) : null}
      </DSCard>

      {/* ── Workspace ── */}
      {agent.displayState === "ACTIVE" ? (
        <AgentChatPanel
          agent={agent}
          defaultImageModel={defaultImageModel}
          defaultTextModel={defaultTextModel}
          runHistory={runHistory}
        />
      ) : (
        <DSCard tone="default">
          <DSCardHeader>
            <span className="ds-eyebrow">Activation</span>
            <h3 className="mt-2 text-lg font-semibold" style={{ color: "var(--bv-ink)" }}>
              Unlock this agent
            </h3>
            <p className="ds-body mt-1">
              Owners and Executive Managers can activate available agents once
              Brand Brain is ready.
            </p>
          </DSCardHeader>
          <DSCardBody>
            <AgentActivationForm agent={agent} />
          </DSCardBody>
        </DSCard>
      )}
    </div>
  );
}

function MetaCell({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div
      className="flex flex-col gap-1 px-6 py-4"
      style={{ background: "var(--bv-card)" }}
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--bv-ink-4)" }}>
        {label}
      </span>
      <span
        className={mono ? "font-mono text-xs" : "text-sm font-medium"}
        style={{ color: "var(--bv-ink)" }}
      >
        {value}
      </span>
    </div>
  );
}
