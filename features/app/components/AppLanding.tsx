import Link from "next/link";
import {
  ArrowRightIcon,
  BookOpenIcon,
  BoxIcon,
  BrainCircuitIcon,
  ImageIcon,
  MegaphoneIcon,
  MessageSquareIcon,
  SparklesIcon,
  SquareUserIcon,
  VideoIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react";

import { Eyebrow } from "@/components/ds/Eyebrow";
import { Button } from "@/components/ui/button";
import type {
  AgentCatalogItem,
  AgentCatalogWorkspace,
} from "@/features/agents/catalog/types";

const AGENT_ICONS: Record<string, LucideIcon> = {
  IMAGE_GENERATOR: ImageIcon,
  VIDEO_GENERATOR: VideoIcon,
  CAMPAIGN_MAKER: MegaphoneIcon,
  BRAND_DIGITAL_ACTIVATION: ZapIcon,
  STORY_TELLER: BookOpenIcon,
  AVATAR: SquareUserIcon,
  SECURE_CHAT: MessageSquareIcon,
  BEXLOGIX: BoxIcon,
};

/* ── Isometric cube geometry — the Bextudio cube concept ── */

type Pt = readonly [number, number];

function cubeFaces(cx: number, cy: number, r: number) {
  const wx = 0.8660254 * r; // cos(30°)
  const hy = 0.5 * r;
  const top: Pt = [cx, cy - r];
  const ur: Pt = [cx + wx, cy - hy];
  const lr: Pt = [cx + wx, cy + hy];
  const bot: Pt = [cx, cy + r];
  const ll: Pt = [cx - wx, cy + hy];
  const ul: Pt = [cx - wx, cy - hy];
  const c: Pt = [cx, cy];
  const poly = (pts: Pt[]) =>
    pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return {
    top: poly([top, ur, c, ul]),
    left: poly([ul, c, bot, ll]),
    right: poly([ur, lr, bot, c]),
    outline: poly([top, ur, lr, bot, ll, ul]),
  };
}

// A single wireframe cube (hexagon outline + the three inner spokes), drawn as
// one path so the background field stays lightweight.
function cubeWirePath(cx: number, cy: number, r: number) {
  const wx = 0.8660254 * r;
  const hy = 0.5 * r;
  const f = (n: number) => n.toFixed(1);
  const top = `${f(cx)},${f(cy - r)}`;
  const ur = `${f(cx + wx)},${f(cy - hy)}`;
  const lr = `${f(cx + wx)},${f(cy + hy)}`;
  const bot = `${f(cx)},${f(cy + r)}`;
  const ll = `${f(cx - wx)},${f(cy + hy)}`;
  const ul = `${f(cx - wx)},${f(cy - hy)}`;
  const c = `${f(cx)},${f(cy)}`;
  return `M${top} L${ur} L${lr} L${bot} L${ll} L${ul} Z M${ul} L${c} L${ur} M${c} L${bot}`;
}

// Tumbling-blocks tessellation: cubes on a pointy-top hexagon lattice.
function CubeField({ className }: { className?: string }) {
  const W = 1000;
  const H = 360;
  const R = 34;
  const sx = Math.sqrt(3) * R;
  const sy = 1.5 * R;
  const paths: string[] = [];
  for (let row = -1; row * sy < H + R; row += 1) {
    for (let col = -1; col * sx < W + R; col += 1) {
      const cx = col * sx + (row % 2 ? sx / 2 : 0);
      const cy = row * sy;
      paths.push(cubeWirePath(cx, cy, R));
    }
  }
  return (
    <svg
      aria-hidden
      className={className}
      fill="none"
      preserveAspectRatio="xMidYMid slice"
      viewBox={`0 0 ${W} ${H}`}
    >
      {paths.map((d, i) => (
        <path
          d={d}
          key={i}
          stroke="var(--bv-brand-tint-32)"
          strokeWidth={1}
        />
      ))}
    </svg>
  );
}

// A flat-shaded isometric cube (three solid faces — depth without a gradient).
function ShadedCube({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const f = cubeFaces(cx, cy, r);
  return (
    <g>
      <polygon fill="var(--bv-brand)" points={f.top} />
      <polygon fill="var(--bv-brand-mid)" points={f.left} />
      <polygon fill="var(--bv-brand-deep)" points={f.right} />
      <polygon
        fill="none"
        points={f.outline}
        stroke="var(--bv-brand-deep)"
        strokeOpacity={0.35}
        strokeWidth={1}
      />
    </g>
  );
}

// The hero illustration: a central "brain" cube with agent cubes wired into it.
function BrainHubArt({ className }: { className?: string }) {
  const hub: Pt = [150, 142];
  const sats: Pt[] = [
    [56, 74],
    [250, 88],
    [150, 246],
  ];
  return (
    <svg
      aria-hidden
      className={className}
      fill="none"
      viewBox="0 0 300 290"
    >
      {sats.map(([x, y], i) => (
        <line
          key={`line-${i}`}
          stroke="var(--bv-brand-mid)"
          strokeDasharray="3 4"
          strokeOpacity={0.5}
          strokeWidth={1.5}
          x1={x}
          x2={hub[0]}
          y1={y}
          y2={hub[1]}
        />
      ))}
      <ShadedCube cx={hub[0]} cy={hub[1]} r={48} />
      {sats.map(([x, y], i) => (
        <ShadedCube cx={x} cy={y} key={`cube-${i}`} r={20} />
      ))}
    </svg>
  );
}

function AgentCard({ agent }: { agent: AgentCatalogItem }) {
  const Icon = AGENT_ICONS[agent.key] ?? SparklesIcon;
  return (
    <Link
      className="group relative flex aspect-square flex-col justify-between overflow-hidden rounded-xl border bg-[var(--bv-card)] p-5 transition-all duration-200 hover:-translate-y-0.5"
      href={`/agents/${agent.slug}`}
      style={{
        borderColor: "var(--bv-line)",
        boxShadow: "var(--bv-shadow-card)",
      }}
    >
      <span
        className="flex size-11 shrink-0 items-center justify-center rounded-xl"
        style={{
          background: "var(--bv-brand-tint-16)",
          color: "var(--bv-brand-deep)",
        }}
      >
        <Icon className="size-5" />
      </span>
      <div className="space-y-1.5">
        <h3 className="ds-h3">{agent.name}</h3>
        <p className="line-clamp-3 text-[13px] leading-relaxed text-[var(--bv-ink-3)]">
          {agent.description}
        </p>
      </div>
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--bv-brand-deep)]">
        <BrainCircuitIcon className="size-3.5 shrink-0" />
        <span>Connected to the Brain</span>
      </div>
    </Link>
  );
}

export function AppLanding({
  workspace,
}: {
  workspace: AgentCatalogWorkspace;
}) {
  const brandName = workspace.access.brandName;
  const featured = workspace.agents.slice(0, 4);

  return (
    <main
      className="min-h-svh px-4 py-6 sm:px-6 sm:py-10"
      style={{ background: "#ffffff", color: "var(--bv-ink)" }}
    >
      <div
        className="mx-auto w-full max-w-6xl space-y-10"
        style={{ animation: "ds-fade-in 600ms var(--bv-ease)" }}
      >
        {/* Hero — Brand Integrated Brain */}
        <section
          className="relative overflow-hidden rounded-2xl border"
          style={{
            borderColor: "var(--bv-line)",
            background: "var(--bv-card)",
            boxShadow: "var(--bv-shadow-hub)",
          }}
        >
          <CubeField className="pointer-events-none absolute inset-0 h-full w-full opacity-60" />
          <div className="relative grid gap-8 p-8 sm:p-10 md:grid-cols-[1.35fr_1fr] md:items-center">
            <div className="space-y-5">
              <Eyebrow>Bextudio · Brand OS</Eyebrow>
              <h1 className="ds-h1 max-w-xl">
                The brain behind every on-brand decision
              </h1>
              <p className="ds-body max-w-lg">
                The Brand Integrated Brain holds {brandName}&apos;s approved
                knowledge. Every agent plugs into it — so everything they
                create stays unmistakably on-brand.
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <Button asChild size="lg">
                  <Link href="/brand-integrated-brain">
                    <BrainCircuitIcon />
                    Open Brand Brain
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/agents">Explore agents</Link>
                </Button>
              </div>
            </div>
            <div className="hidden md:block">
              <BrainHubArt className="mx-auto h-auto w-full max-w-[300px]" />
            </div>
          </div>
        </section>

        {/* Agents powered by the Brain */}
        <section className="space-y-5">
          <div className="space-y-2">
            <Eyebrow>Powered by the Brain</Eyebrow>
            <h2 className="ds-h2">Agents that already know {brandName}</h2>
            <p className="ds-body max-w-xl">
              Each agent draws on the Brand Brain&apos;s approved knowledge base
              — no re-briefing, always on-brand.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {featured.map((agent) => (
              <AgentCard agent={agent} key={agent.key} />
            ))}
          </div>

          <div>
            <Button asChild variant="ghost">
              <Link href="/agents">
                View all agents
                <ArrowRightIcon />
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
