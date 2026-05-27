"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";

import type {
  BrandBuildProgress,
  PhaseProgress,
  PhaseStatus,
  SubstepProgress,
  SubstepState,
} from "@/features/dashboard/build-progress";

const STATE_COPY: Record<SubstepState, string> = {
  done: "Done",
  "in-progress": "In progress",
  "awaiting-review": "Awaiting review",
  locked: "Locked",
};



/* ── SVG Glyphs ── */

function Chevron({ size = 18 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width={size}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function BackArrow() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="14"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width="14"
    >
      <line x1="19" x2="5" y1="12" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function LockIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width={size}
    >
      <rect height="9" rx="2" width="16" x="4" y="11" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

const sProps = {
  stroke: "white",
  strokeWidth: 1.7,
  fill: "none",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function PhaseGlyph({ kind }: { kind: string }) {
  if (kind === "clipboard")
    return (
      <svg aria-hidden="true" height="18" viewBox="0 0 24 24" width="18">
        <rect height="17" rx="2" width="12" x="6" y="4" {...sProps} />
        <rect height="4" rx="1" width="6" x="9" y="2" {...sProps} />
        <line x1="9" x2="15" y1="11" y2="11" {...sProps} />
        <line x1="9" x2="15" y1="14" y2="14" {...sProps} />
        <line x1="9" x2="13" y1="17" y2="17" {...sProps} />
      </svg>
    );
  if (kind === "spark")
    return (
      <svg aria-hidden="true" height="18" viewBox="0 0 24 24" width="18">
        <path d="M12 3v4" {...sProps} />
        <path d="M12 17v4" {...sProps} />
        <path d="M3 12h4" {...sProps} />
        <path d="M17 12h4" {...sProps} />
        <path
          d="M12 8a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4z"
          {...sProps}
        />
      </svg>
    );
  if (kind === "chip")
    return (
      <svg aria-hidden="true" height="18" viewBox="0 0 24 24" width="18">
        <rect height="10" rx="2" width="10" x="7" y="7" {...sProps} />
        <path
          d="M10 7V4M14 7V4M10 20v-3M14 20v-3M7 10H4M7 14H4M20 10h-3M20 14h-3"
          {...sProps}
        />
      </svg>
    );
  return null;
}

function StatePill({ state }: { state: SubstepState }) {
  const stateStyles: Record<SubstepState, React.CSSProperties> = {
    done: { color: "#1f9c69", borderColor: "rgba(43,199,138,0.28)", background: "rgba(43,199,138,0.08)" },
    "in-progress": { color: "#1f6cd6", borderColor: "rgba(42,124,255,0.28)", background: "rgba(42,124,255,0.08)" },
    "awaiting-review": { color: "#b87600", borderColor: "rgba(255,178,35,0.32)", background: "rgba(255,178,35,0.10)" },
    locked: { color: "var(--bv-ink-3)", borderStyle: "dashed", background: "#fff" },
  };

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider whitespace-nowrap"
      style={stateStyles[state]}
    >
      <span
        className="inline-block size-[5px] rounded-full bg-current"
        style={
          state === "in-progress"
            ? { animation: "bv-pulse 1.4s var(--bv-ease) infinite" }
            : undefined
        }
      />
      {STATE_COPY[state]}
    </span>
  );
}

/* ── Phase Card ── */

const TONE_GRADIENTS: Record<number, string> = {
  1: "linear-gradient(150deg, var(--bv-c1-a), var(--bv-c1-b))",
  2: "linear-gradient(150deg, var(--bv-c2-a), var(--bv-c2-b))",
  3: "linear-gradient(150deg, var(--bv-c3-a), var(--bv-c3-b))",
};

const BAR_GRADIENTS: Record<number, string> = {
  1: "linear-gradient(90deg, var(--bv-c1-a), var(--bv-c1-b))",
  2: "linear-gradient(90deg, var(--bv-c2-a), var(--bv-c2-b))",
  3: "linear-gradient(90deg, var(--bv-c3-a), var(--bv-c3-b))",
};

function PhaseCard({
  phase,
  open,
  onToggle,
  onOpenSub,
  phaseState,
}: {
  phase: PhaseProgress;
  open: boolean;
  onToggle: () => void;
  onOpenSub: (phase: PhaseProgress, substep: SubstepProgress, state: SubstepState) => void;
  phaseState: PhaseStatus;
}) {
  const isLocked = phaseState === "locked";
  const tone = phase.phase;

  return (
    <div
      className="relative w-full overflow-hidden rounded-[20px] border transition-all duration-300"
      style={{
        background: "var(--bv-card)",
        borderColor: "var(--bv-line)",
        boxShadow: "var(--bv-shadow-card)",
        maxWidth: 560,
      }}
    >
      {phaseState === "active" && (
        <div
          className="absolute inset-x-0 top-0 h-0.5 opacity-90"
          style={{
            background: `linear-gradient(90deg, transparent, var(--bv-accent), transparent)`,
          }}
        />
      )}

      <button
        aria-controls={`${phase.key}-panel`}
        aria-expanded={open}
        className="block w-full cursor-pointer border-0 bg-transparent p-4 text-left"
        onClick={onToggle}
        type="button"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <span
            className="grid size-[30px] place-items-center rounded-lg text-white"
            style={{
              background: TONE_GRADIENTS[tone],
              boxShadow:
                "0 3px 10px -3px rgba(15,15,20,0.25), inset 0 1px 0 rgba(255,255,255,0.35)",
            }}
          >
            <PhaseGlyph kind={phase.iconKind} />
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--bv-ink-3)]">
            <span
              className="inline-block size-[5px] rounded-full"
              style={{
                background:
                  phaseState === "complete"
                    ? "#2bc78a"
                    : phaseState === "active"
                      ? "var(--bv-accent)"
                      : "var(--bv-ink-4)",
                boxShadow:
                  phaseState === "active"
                    ? "0 0 0 3px var(--bv-accent-tint)"
                    : undefined,
              }}
            />
            Phase {String(phase.phase).padStart(2, "0")}
          </span>
        </div>

        <h2 className="mb-1 text-[17px] font-semibold tracking-[-0.014em] text-[var(--bv-ink)]">
          {phase.title}
        </h2>
        <p className="mb-3 text-[13px] leading-relaxed text-[var(--bv-ink-2)]">
          {phase.description}
        </p>

        <div className="mb-2.5 flex items-center gap-3">
          <span
            className="flex-1 h-1.5 overflow-hidden rounded-full"
            style={{ background: "rgba(15,15,20,0.06)" }}
          >
            <span
              className="block h-full rounded-full transition-all duration-700"
              style={{
                width: `${phase.percent}%`,
                background: isLocked
                  ? "var(--bv-ink-4)"
                  : BAR_GRADIENTS[tone],
                transitionTimingFunction: "var(--bv-ease)",
              }}
            />
          </span>
          <span className="min-w-[38px] text-right font-mono text-[11.5px] text-[var(--bv-ink-2)]">
            {phase.percent}%
          </span>
        </div>

        <div className="flex items-center justify-between gap-2.5 border-t border-dashed pt-2.5" style={{ borderColor: "var(--bv-line-dashed)" }}>
          <span className="text-xs text-[var(--bv-ink-3)]">
            {phase.teamVerb} by the{" "}
            <strong className="font-medium text-[var(--bv-ink-2)]">
              {phase.team}
            </strong>
          </span>
          <span
            className="text-[var(--bv-ink-3)] transition-transform duration-300"
            style={{
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              transitionTimingFunction: "var(--bv-ease)",
            }}
          >
            <Chevron />
          </span>
        </div>
      </button>

      <div
        aria-hidden={!open}
        className="overflow-hidden border-t border-transparent transition-all duration-500"
        id={`${phase.key}-panel`}
        style={{
          maxHeight: open ? 1600 : 0,
          borderTopColor: open ? "var(--bv-line)" : "transparent",
          background:
            "linear-gradient(180deg, rgba(15,15,20,0.012), transparent 40px)",
          transitionTimingFunction: "var(--bv-ease)",
        }}
      >
        <div className="grid gap-2 p-3 pt-3">
          <div className="mx-1 mb-1 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--bv-ink-3)]">
            <span>Sub-steps</span>
            <span className="text-[var(--bv-ink-4)]">
              {phase.substeps.length} total
            </span>
          </div>
          {phase.substeps.map((s, i) => {
            const effectiveState = isLocked ? "locked" : s.state;
            return (
              <button
                className="block w-full cursor-pointer rounded-[14px] border bg-[var(--bv-card-soft)] p-3 text-left transition-all duration-200 hover:border-[var(--bv-line-2)] hover:bg-white disabled:cursor-not-allowed disabled:opacity-55"
                disabled={effectiveState === "locked"}
                key={s.id}
                onClick={() => onOpenSub(phase, s, effectiveState)}
                style={{ borderColor: "var(--bv-line)" }}
                tabIndex={open ? 0 : -1}
                type="button"
              >
                <div className="mb-1 flex items-baseline gap-2">
                  <span className="shrink-0 font-mono text-[10.5px] text-[var(--bv-ink-4)]">
                    {phase.phase}.{String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="min-w-0 flex-1 text-[13.5px] font-medium tracking-[-0.005em]">
                    {s.title}
                  </h3>
                </div>
                <p className="mb-2.5 text-xs leading-relaxed text-[var(--bv-ink-3)]">
                  {s.description}
                </p>
                <div className="flex items-center justify-end">
                  <StatePill state={effectiveState} />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Detail Page (overlay) ── */

function DetailPage({
  phase,
  substep,
  state,
  onBack,
}: {
  phase: PhaseProgress;
  substep: SubstepProgress;
  state: SubstepState;
  onBack: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onBack();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onBack]);

  const isLocked = state === "locked";
  const progress = isLocked ? 0 : substep.progress;
  const idxInPhase =
    phase.substeps.findIndex((x) => x.id === substep.id) + 1;

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      style={{
        background: "var(--bv-bg)",
        animation: "bv-slide-up 420ms var(--bv-ease)",
      }}
    >
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: `radial-gradient(900px 600px at 100% -10%, rgba(255,255,255,0.95), transparent 60%),
                       radial-gradient(800px 600px at -10% 100%, rgba(225,225,232,0.5), transparent 60%)`,
        }}
      />

      <div className="relative z-10 mx-auto max-w-[980px] px-7 pb-24 pt-9">
        <div className="mb-9 flex items-center justify-between">
          <button
            className="inline-flex cursor-pointer items-center gap-2 rounded-full border bg-white px-3.5 py-2 text-[13px] text-[var(--bv-ink-2)] shadow-sm transition-all hover:border-[var(--bv-line-2)] hover:text-[var(--bv-ink)]"
            onClick={onBack}
            style={{ borderColor: "var(--bv-line)" }}
            type="button"
          >
            <BackArrow /> Back to roadmap
          </button>
          <span className="font-mono text-[11px] tracking-wider text-[var(--bv-ink-3)]">
            <kbd className="rounded border border-[var(--bv-line-2)] bg-white px-1.5 py-0.5 font-mono text-[10px] text-[var(--bv-ink-2)]">
              Esc
            </kbd>{" "}
            to close
          </span>
        </div>

        <div className="mb-3.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--bv-ink-3)]">
          <span>Brand Brain</span>
          <span className="mx-2 text-[var(--bv-ink-4)]">/</span>
          <span>
            Phase {String(phase.phase).padStart(2, "0")} · {phase.title}
          </span>
          <span className="mx-2 text-[var(--bv-ink-4)]">/</span>
          <span className="text-[var(--bv-ink)]">{substep.title}</span>
        </div>

        <h2 className="mb-3.5 text-[clamp(30px,4vw,40px)] font-semibold leading-[1.07] tracking-[-0.025em] text-[var(--bv-ink)]">
          {substep.title}
        </h2>
        <p className="mb-7 max-w-[600px] text-[16.5px] leading-relaxed text-[var(--bv-ink-2)]">
          {substep.description}
        </p>

        <div className="mb-8 flex flex-wrap gap-2">
          <StatePill state={state} />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--bv-line)] bg-white px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--bv-ink-2)]">
            <span className="inline-block size-[5px] rounded-full bg-current" />
            {phase.teamVerb} by the {phase.team}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--bv-line)] bg-white px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--bv-ink-2)]">
            <span className="inline-block size-[5px] rounded-full bg-current" />
            Step {phase.phase}.{String(idxInPhase).padStart(2, "0")}
          </span>
        </div>

        {isLocked && (
          <div
            className="mb-6 flex gap-3.5 rounded-[14px] border border-dashed bg-white p-4 text-sm leading-relaxed text-[var(--bv-ink-2)]"
            style={{ borderColor: "var(--bv-line-2)" }}
          >
            <LockIcon size={18} />
            <div>
              This step is locked until the previous phase wraps. The team picks
              this up once{" "}
              <strong className="text-[var(--bv-ink)]">
                {phase.phase === 2 ? "Phase 01" : "Phase 02"}
              </strong>{" "}
              is delivered.
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
          <div
            className="rounded-[20px] border p-5"
            style={{
              background: "var(--bv-card)",
              borderColor: "var(--bv-line)",
              boxShadow: "var(--bv-shadow-card)",
            }}
          >
            <h3 className="mb-3.5 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--bv-ink-3)]">
              Progress
            </h3>
            <div className="mb-4 flex items-baseline gap-2.5">
              <span className="font-mono text-[54px] font-medium leading-none tracking-[-0.025em] text-[var(--bv-ink)]">
                {progress}
              </span>
              <span className="font-mono text-lg text-[var(--bv-ink-3)]">
                %
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full"
              style={{ background: "rgba(15,15,20,0.06)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${progress}%`,
                  background: BAR_GRADIENTS[phase.phase],
                  transitionTimingFunction: "var(--bv-ease)",
                }}
              />
            </div>
            <div className="mt-5 space-y-0">
              <div className="flex items-center justify-between border-t border-dashed py-3 text-[13px]" style={{ borderColor: "var(--bv-line)" }}>
                <span className="text-[var(--bv-ink-3)]">Status</span>
                <span className="font-mono text-[var(--bv-ink)]">
                  {STATE_COPY[state]}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-dashed py-3 text-[13px]" style={{ borderColor: "var(--bv-line)" }}>
                <span className="text-[var(--bv-ink-3)]">Owner</span>
                <span className="font-mono text-[var(--bv-ink)]">
                  {phase.team}
                </span>
              </div>
            </div>
          </div>

          <div
            className="rounded-[20px] border p-5"
            style={{
              background: "var(--bv-card)",
              borderColor: "var(--bv-line)",
              boxShadow: "var(--bv-shadow-card)",
            }}
          >
            <h3 className="mb-3.5 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--bv-ink-3)]">
              Info
            </h3>
            <p className="text-sm leading-relaxed text-[var(--bv-ink-2)]">
              {substep.description}
            </p>
            <div className="mt-4 flex items-center justify-between border-t border-dashed py-3 text-[13px]" style={{ borderColor: "var(--bv-line)" }}>
              <span className="text-[var(--bv-ink-3)]">Phase</span>
              <span className="font-mono text-[var(--bv-ink)]">
                {phase.title}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-dashed py-3 text-[13px]" style={{ borderColor: "var(--bv-line)" }}>
              <span className="text-[var(--bv-ink-3)]">Step</span>
              <span className="font-mono text-[var(--bv-ink)]">
                {phase.phase}.{String(idxInPhase).padStart(2, "0")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Build View ── */

export function BrandBuildView({
  progress,
  email,
}: {
  progress: BrandBuildProgress;
  email: string;
}) {
  const [openPhases, setOpenPhases] = useState<Record<string, boolean>>({});
  const [detail, setDetail] = useState<{
    phase: PhaseProgress;
    substep: SubstepProgress;
    state: SubstepState;
  } | null>(null);

  const phaseInfo = useMemo(() => {
    const info: Record<
      string,
      { phaseState: PhaseStatus; isLocked: boolean; overall: number }
    > = {};
    let prevComplete = true;
    for (const p of progress.phases) {
      const isLocked = !prevComplete;
      info[p.key] = {
        phaseState: isLocked ? "locked" : p.status,
        isLocked,
        overall: p.percent,
      };
      prevComplete = prevComplete && p.status === "complete";
    }
    return info;
  }, [progress.phases]);

  const spineFillPct = useMemo(() => {
    let filled = 0;
    for (const p of progress.phases) {
      const inf = phaseInfo[p.key];
      if (inf.phaseState === "complete") filled += 1;
      else if (inf.phaseState === "active") filled += p.percent / 100;
    }
    return Math.round((filled / progress.phases.length) * 100);
  }, [progress.phases, phaseInfo]);

  const activePhase = progress.activePhase;
  const toggle = useCallback(
    (key: string) =>
      setOpenPhases((o) => ({ ...o, [key]: !o[key] })),
    [],
  );
  const openSub = useCallback(
    (phase: PhaseProgress, substep: SubstepProgress, state: SubstepState) =>
      setDetail({ phase, substep, state }),
    [],
  );
  const closeDetail = useCallback(() => setDetail(null), []);

  return (
    <div
      className="mx-auto max-w-[1180px] px-7 pb-24 pt-10"
      style={{ color: "var(--bv-ink)" }}
    >
      {/* ── Top Bar ── */}
      <div className="mb-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="relative size-8 rounded-[9px]"
            style={{
              background: "linear-gradient(135deg, #0e0e14, #2a2a36)",
              boxShadow:
                "0 2px 6px rgba(15,15,20,0.18), inset 0 0 0 1px rgba(255,255,255,0.05)",
            }}
          >
            <div
              className="absolute inset-[7px] rounded"
              style={{
                background:
                  "linear-gradient(135deg, #ff8a5b, #2a7cff 60%, #2bc78a)",
                opacity: 0.92,
              }}
            />
          </div>
          <div>
            <div className="text-[15px] font-semibold tracking-[-0.012em]">
              Brand Brain
            </div>
            <div className="mt-px font-mono text-[11.5px] tracking-wider text-[var(--bv-ink-3)]">
              bextudio · build view
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[12.5px] text-[var(--bv-ink-3)]">
          <span
            className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 font-mono text-[11px] tracking-wider text-[var(--bv-ink-2)] shadow-sm"
            style={{ borderColor: "var(--bv-line)" }}
          >
            <span
              className="size-1.5 rounded-full"
              style={{
                background: "#2bc78a",
                boxShadow: "0 0 0 4px rgba(43,199,138,0.18)",
                animation: "bv-live-pulse 1.8s var(--bv-ease) infinite",
              }}
            />
            Live
          </span>
        </div>
      </div>

      {/* ── Panel ── */}
      <div
        className="relative overflow-hidden rounded-[28px] border px-7 pb-11 pt-9"
        style={{
          background: "var(--bv-panel)",
          borderColor: "var(--bv-panel-edge)",
          boxShadow: "var(--bv-shadow-panel)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(700px 360px at 50% -20%, rgba(255,255,255,0.95), transparent 65%),
                         radial-gradient(900px 600px at 100% 100%, rgba(231,232,240,0.4), transparent 60%)`,
          }}
        />

        <div className="relative z-10">
          {/* Hub */}
          <div className="mb-7 flex w-full items-center justify-center">
            <div
              className="relative inline-flex items-center gap-3.5 rounded-full border bg-white px-5 py-3 pl-3.5"
              style={{
                borderColor: "var(--bv-line)",
                boxShadow: "var(--bv-shadow-hub)",
              }}
            >
              <span
                className="size-9 rounded-full"
                style={{
                  background: `conic-gradient(from 0deg, rgba(42,124,255,0) 0deg, rgba(42,124,255,0.7) 270deg, rgba(42,124,255,0) 360deg), #ffffff`,
                  mask: `radial-gradient(circle at 50% 50%, transparent 13px, #000 13.5px, #000 17px, transparent 17.5px)`,
                  WebkitMask: `radial-gradient(circle at 50% 50%, transparent 13px, #000 13.5px, #000 17px, transparent 17.5px)`,
                  animation: "bv-spin 1.6s linear infinite",
                }}
              />
              <span className="text-[15px] font-medium tracking-[-0.01em] whitespace-nowrap">
                Building{" "}
                <span className="text-[var(--bv-accent)]">
                  {activePhase?.title ?? "Brand Brain"}
                </span>
              </span>
              <span
                className="ml-1 border-l pl-3.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--bv-ink-3)]"
                style={{ borderColor: "var(--bv-line)" }}
              >
                {progress.overallPercent}% · {progress.stepsDone}/
                {progress.stepsTotal}
              </span>
            </div>
          </div>

          {/* Spine Track */}
          <div className="relative pl-14 max-sm:pl-9">
            <div
              className="absolute left-[19px] bottom-[18px] top-[18px] w-0.5 rounded-sm max-sm:left-[11px]"
              style={{
                backgroundImage: `linear-gradient(to bottom, var(--bv-line-dashed) 0 6px, transparent 6px 12px)`,
                backgroundSize: "2px 12px",
                backgroundRepeat: "repeat-y",
              }}
            >
              <div
                className="absolute inset-x-0 top-0 rounded-sm transition-all duration-700"
                style={{
                  height: `${spineFillPct}%`,
                  background: `linear-gradient(to bottom, var(--bv-c2-a), var(--bv-c2-b))`,
                  boxShadow: "0 0 16px rgba(42,124,255,0.35)",
                  transitionTimingFunction: "var(--bv-ease)",
                }}
              />
            </div>

            {progress.phases.map((p) => {
              const info = phaseInfo[p.key];
              return (
                <div
                  className="relative mb-3 last:mb-0"
                  key={p.key}
                >
                  <div
                    className="absolute -left-[45px] top-5 z-[2] size-3.5 rounded-full border-2 transition-all duration-300 max-sm:-left-[29px]"
                    style={{
                      background:
                        info.phaseState === "complete"
                          ? `linear-gradient(140deg, var(--bv-c2-a), var(--bv-c2-b))`
                          : info.phaseState === "active"
                            ? "#fff"
                            : "var(--bv-bg)",
                      borderColor:
                        info.phaseState === "complete"
                          ? "transparent"
                          : info.phaseState === "active"
                            ? "var(--bv-accent)"
                            : "var(--bv-line-2)",
                      boxShadow:
                        info.phaseState === "complete"
                          ? "0 0 0 4px rgba(42,124,255,0.12)"
                          : info.phaseState === "active"
                            ? "0 0 0 4px rgba(42,124,255,0.16)"
                            : undefined,
                      transitionTimingFunction: "var(--bv-ease)",
                    }}
                  />
                  <div
                    className="absolute -left-[38px] top-[27px] z-[1] h-0.5 w-[30px] max-sm:hidden"
                    style={{
                      backgroundImage:
                        info.phaseState === "active"
                          ? `linear-gradient(to right, var(--bv-accent) 0 4px, transparent 4px 8px)`
                          : `linear-gradient(to right, var(--bv-line-dashed) 0 4px, transparent 4px 8px)`,
                      backgroundSize: "8px 2px",
                    }}
                  />
                  <PhaseCard
                    onOpenSub={openSub}
                    onToggle={() => toggle(p.key)}
                    open={Boolean(openPhases[p.key])}
                    phase={p}
                    phaseState={info.phaseState}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Caption ── */}
      <section className="max-w-[720px] px-1 pt-10">
        <span className="mb-3.5 inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--bv-ink-3)]">
          <span
            className="inline-block h-px w-[18px]"
            style={{ background: "var(--bv-line-2)" }}
          />
          Brand Brain · build roadmap
        </span>
        <h1 className="mb-3.5 text-[clamp(28px,3.6vw,38px)] font-semibold leading-[1.1] tracking-[-0.024em] text-[var(--bv-ink)]">
          Three phases. One brand-aware brain.
        </h1>
        <p className="max-w-[560px] text-base leading-relaxed text-[var(--bv-ink-2)]">
          Brand Brain is built in sequence — first the brand tells us who it is,
          then strategy makes it operable, then the AI team makes it speak. Tap
          any phase to open its steps.
        </p>
        <div className="mt-7 flex flex-wrap gap-x-9 gap-y-5">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--bv-ink-3)]">
              Overall
            </div>
            <div className="mt-1 font-mono text-xl font-medium tracking-[-0.01em]">
              {progress.overallPercent}%
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--bv-ink-3)]">
              Steps done
            </div>
            <div className="mt-1 font-mono text-xl font-medium tracking-[-0.01em]">
              {progress.stepsDone} / {progress.stepsTotal}
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--bv-ink-3)]">
              Active phase
            </div>
            <div className="mt-1 font-mono text-xl font-medium tracking-[-0.01em]">
              {activePhase
                ? `0${activePhase.phase} · ${activePhase.title}`
                : "Complete"}
            </div>
          </div>
        </div>
      </section>

      {/* ── Quick Links ── */}
      <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-dashed pt-6" style={{ borderColor: "var(--bv-line-dashed)" }}>
        <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--bv-ink-4)]">
          Go to
        </span>
        {[
          { href: "/dashboard/questionnaire", label: "Questionnaire" },
          { href: "/dashboard/modules", label: "Modules" },
          { href: "/dashboard/brain", label: "Brain" },
          { href: "/dashboard/agents", label: "Agents" },
          { href: "/dashboard/files", label: "Files" },
          { href: "/dashboard/change-requests", label: "Changes" },
        ].map((link) => (
          <Link
            className="rounded-full border bg-white px-3 py-1.5 text-xs text-[var(--bv-ink-2)] shadow-sm transition-all hover:border-[var(--bv-line-2)] hover:text-[var(--bv-ink)]"
            href={link.href}
            key={link.href}
            style={{ borderColor: "var(--bv-line)" }}
          >
            {link.label}
          </Link>
        ))}
      </div>

      {/* ── Footer ── */}
      <div className="mt-6 text-xs text-[var(--bv-ink-4)]">
        Signed in as {email}
      </div>

      {/* ── Detail overlay ── */}
      {detail && (
        <DetailPage
          onBack={closeDetail}
          phase={detail.phase}
          state={detail.state}
          substep={detail.substep}
        />
      )}
    </div>
  );
}
