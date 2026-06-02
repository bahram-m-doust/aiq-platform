"use client";

import { useState, useEffect, useMemo, useCallback } from "react";

import type {
  BrandBuildProgress,
  PhaseProgress,
  PhaseStatus,
  SubstepProgress,
  SubstepState,
} from "@/features/dashboard/build-progress";
import { FinalSubmitReadiness } from "@/features/intake/components/FinalSubmitReadiness";
import type { IntakeCompletion } from "@/features/intake/types";

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
  if (kind === "palette")
    return (
      <svg aria-hidden="true" height="18" viewBox="0 0 24 24" width="18">
        <path
          d="M12 3a9 9 0 0 0 0 18c1.1 0 2-.9 2-2 0-.52-.2-1-.54-1.36-.33-.36-.53-.83-.53-1.34 0-1.1.9-2 2-2h1.6A4.97 4.97 0 0 0 21 9.5C21 5.9 16.97 3 12 3z"
          {...sProps}
        />
        <circle cx="7.5" cy="10.5" fill="white" r="1" stroke="none" />
        <circle cx="10.5" cy="7.5" fill="white" r="1" stroke="none" />
        <circle cx="14.5" cy="7.5" fill="white" r="1" stroke="none" />
        <circle cx="16.5" cy="10.5" fill="white" r="1" stroke="none" />
      </svg>
    );
  return null;
}

function StatePill({ state }: { state: SubstepState }) {
  const stateStyles: Record<SubstepState, React.CSSProperties> = {
    done: { color: "#157a52", borderColor: "rgba(43,199,138,0.28)", background: "rgba(43,199,138,0.12)" },
    "in-progress": { color: "#1a5bb5", borderColor: "rgba(42,124,255,0.28)", background: "rgba(42,124,255,0.12)" },
    "awaiting-review": { color: "#996100", borderColor: "rgba(255,178,35,0.32)", background: "rgba(255,178,35,0.14)" },
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
  4: "linear-gradient(150deg, var(--bv-c4-a), var(--bv-c4-b))",
};

const BAR_GRADIENTS: Record<number, string> = {
  1: "linear-gradient(90deg, var(--bv-c1-a), var(--bv-c1-b))",
  2: "linear-gradient(90deg, var(--bv-c2-a), var(--bv-c2-b))",
  3: "linear-gradient(90deg, var(--bv-c3-a), var(--bv-c3-b))",
  4: "linear-gradient(90deg, var(--bv-c4-a), var(--bv-c4-b))",
};

function PhaseCard({
  phase,
  open,
  onToggle,
  onOpenSub,
  phaseState,
  submitSlot,
  justUnlocked,
}: {
  phase: PhaseProgress;
  open: boolean;
  onToggle: () => void;
  onOpenSub: (phase: PhaseProgress, substep: SubstepProgress, state: SubstepState) => void;
  phaseState: PhaseStatus;
  submitSlot?: React.ReactNode;
  justUnlocked?: boolean;
}) {
  const isLocked = phaseState === "locked";
  const isReadyToSubmit = phase.phase === 1 && submitSlot !== undefined;
  const tone = phase.phase;
  const cardAnimation = justUnlocked
    ? "ds-unlock 800ms var(--bv-ease)"
    : undefined;

  return (
    <div
      className="group/card relative w-full overflow-hidden rounded-[8px] border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
      style={{
        background: "var(--bv-card)",
        borderColor: isReadyToSubmit ? "var(--bv-brand-mid)" : "var(--bv-line)",
        animation: cardAnimation,
        boxShadow:
          "0px 6px 6px rgba(148,163,184,0.15), 0px 0px 1px rgba(148,163,184,0.7)",
        maxWidth: 600,
      }}
    >
      {phaseState === "active" && (
        <div
          className="absolute inset-x-0 top-0 z-[1] h-0.5 opacity-90"
          style={{
            background: `linear-gradient(90deg, transparent, var(--bv-accent), transparent)`,
          }}
        />
      )}

      <button
        aria-controls={`${phase.key}-panel`}
        aria-expanded={open}
        className="block w-full cursor-pointer border-0 bg-transparent p-0 text-left"
        onClick={onToggle}
        type="button"
      >
        {/* card header */}
        <div className="flex flex-col gap-2 px-6 pb-4 pt-6">
          <div className="flex items-center justify-between gap-3">
            <span
              className="grid size-8 place-items-center rounded-md text-white"
              style={{
                background: TONE_GRADIENTS[tone],
                boxShadow:
                  "0 3px 10px -3px rgba(15,15,20,0.25), inset 0 1px 0 rgba(255,255,255,0.35)",
              }}
            >
              <PhaseGlyph kind={phase.iconKind} />
            </span>
            <span className="flex items-center gap-1.5 text-[12px] font-medium tracking-[-0.006em] text-[var(--bv-ink-3)]">
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
              PHASE {String(phase.phase).padStart(2, "0")}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="text-[14px] font-semibold leading-5 tracking-[-0.006em] text-[var(--bv-ink)]">
              {isReadyToSubmit ? "Ready to Submit" : phase.title}
            </h2>
            <p className="text-[12px] leading-4 text-[var(--bv-ink-3)]">
              {isReadyToSubmit
                ? "All inputs captured. Lock the foundation and pass to Strategy."
                : phase.description}
            </p>
          </div>
        </div>

        {/* card content — progress */}
        <div className="flex items-center justify-between gap-4 px-6 pb-5 pt-2">
          <span
            className="h-2 flex-1 overflow-hidden rounded-full"
            style={{ background: "rgba(15,15,20,0.06)" }}
          >
            <span
              className="block h-full rounded-full transition-all duration-700"
              style={{
                width: `${phase.percent}%`,
                background: isLocked
                  ? "var(--bv-ink-4)"
                  : isReadyToSubmit
                    ? "linear-gradient(90deg, var(--bv-brand), var(--bv-brand-mid))"
                    : BAR_GRADIENTS[tone],
                transitionTimingFunction: "var(--bv-ease)",
              }}
            />
          </span>
          <span className="text-[12px] font-medium text-[var(--bv-ink-3)]">
            {phase.percent}%
          </span>
        </div>

        {/* card footer */}
        <div
          className="flex items-center justify-between gap-3 border-t border-dashed px-6 py-4"
          style={{ borderColor: "var(--bv-line-dashed)" }}
        >
          <span className="text-[12px] leading-4">
            {isReadyToSubmit ? (
              <>
                <strong className="font-medium text-[var(--bv-ink)]">
                  {phase.stepsDone} / {phase.stepsTotal}
                </strong>{" "}
                <span className="text-[var(--bv-ink-3)]">answered</span>
              </>
            ) : (
              <>
                <span className="text-[var(--bv-ink-3)]">
                  {phase.teamVerb} by the{" "}
                </span>
                <span className="font-medium text-[var(--bv-ink)]">
                  {phase.team}
                </span>
              </>
            )}
          </span>
          <span
            className="text-[var(--bv-ink-3)] transition-transform duration-300"
            style={{
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              transitionTimingFunction: "var(--bv-ease)",
            }}
          >
            <Chevron size={16} />
          </span>
        </div>
      </button>

      {isReadyToSubmit && submitSlot ? (
        <div
          className="border-t bg-[var(--bv-card-soft)] px-4 py-3.5"
          style={{
            borderColor: "var(--bv-line)",
            animation: "ds-fade-in 500ms var(--bv-ease) 200ms backwards",
          }}
        >
          {submitSlot}
        </div>
      ) : null}

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
                className="block w-full cursor-pointer rounded-[14px] border bg-[var(--bv-card-soft)] p-3 text-left transition-all duration-200 hover:border-[var(--bv-line-2)] hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
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
                <div className="flex items-center justify-between">
                  {effectiveState === "locked" ? (
                    <span className="text-[10px] text-[var(--bv-ink-4)]">
                      Unlocks after Phase {String(phase.phase - 1).padStart(2, "0")}
                    </span>
                  ) : <span />}
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
                {`Phase ${String(phase.phase - 1).padStart(2, "0")}`}
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
  intakeCompletion,
  intakeSessionId,
}: {
  progress: BrandBuildProgress;
  email: string;
  intakeCompletion?: IntakeCompletion | null;
  intakeSessionId?: string | null;
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
      {
        phaseState: PhaseStatus;
        isLocked: boolean;
        overall: number;
        nextUp: boolean;
      }
    > = {};
    let prevComplete = true;
    let prevReadyToHandoff = false;
    for (const p of progress.phases) {
      const isLocked = !prevComplete;
      info[p.key] = {
        phaseState: isLocked ? "locked" : p.status,
        isLocked,
        overall: p.percent,
        nextUp: isLocked && prevReadyToHandoff,
      };
      prevReadyToHandoff = !isLocked && p.percent === 100 && p.status !== "complete";
      prevComplete = prevComplete && p.status === "complete";
    }
    return info;
  }, [progress.phases]);

  const spineFillPct = useMemo(() => {
    let filled = 0;
    for (let i = 0; i < progress.phases.length; i += 1) {
      const p = progress.phases[i];
      const inf = phaseInfo[p.key];
      if (inf.phaseState === "complete") {
        filled += 1;
      } else if (inf.phaseState === "active") {
        const slice = p.percent / 100;
        const next = progress.phases[i + 1];
        const reachNext = slice === 1 && next ? 0.5 : 0;
        filled += slice + reachNext;
      }
    }
    return Math.min(100, Math.round((filled / progress.phases.length) * 100));
  }, [progress.phases, phaseInfo]);

  const activePhase = progress.activePhase;
  const toggle = useCallback(
    (key: string) =>
      setOpenPhases((o) => ({ ...o, [key]: !o[key] })),
    [],
  );
  const openSub = useCallback(
    (phase: PhaseProgress, substep: SubstepProgress, state: SubstepState) => {
      if (state === "locked") return;
      if (phase.key === "questionnaires") {
        window.location.href = `/dashboard/questionnaire/${substep.id}`;
        return;
      }
      if (phase.key === "strategies") {
        window.location.href = "/dashboard/modules";
        return;
      }
      if (phase.key === "brain_build") {
        window.location.href = "/dashboard/brain";
        return;
      }
      setDetail({ phase, substep, state });
    },
    [],
  );
  const closeDetail = useCallback(() => setDetail(null), []);

  return (
    <div
      className="mx-auto max-w-[1180px] px-4 pb-16 pt-6 sm:px-7 sm:pb-24 sm:pt-10"
      style={{ color: "var(--bv-ink)" }}
    >
      {/* ── Welcome ── */}
      <div className="mb-8">
        <h1 className="text-[clamp(24px,3vw,32px)] font-semibold tracking-[-0.02em] text-[var(--bv-ink)]">
          Welcome to {progress.brandName} City
        </h1>
      </div>

      {/* ── Top Bar ── */}
      <div className="mb-14 flex items-center justify-end">
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

      {/* ── Build content ── */}
      <div style={{ animation: "bv-fade-in 600ms var(--bv-ease)" }}>
        {/* Hub */}
          <div className="mb-7 flex w-full items-center justify-center">
            <div
              className="relative inline-flex items-center gap-3.5 rounded-[8px] border bg-white py-[9px] pl-[15px] pr-[23px]"
              style={{
                borderColor: "var(--bv-line)",
                boxShadow: "var(--bv-shadow-hub)",
              }}
            >
              {!activePhase && (
                <svg
                  aria-hidden="true"
                  className="shrink-0"
                  fill="none"
                  height="15"
                  stroke="#2bc78a"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                  width="15"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              <span className="text-[15px] font-medium tracking-[-0.01em] whitespace-nowrap text-[var(--bv-ink)]">
                {activePhase ? (
                  <>
                    Building{" "}
                    <span className="text-[var(--bv-accent)]">
                      {activePhase.title}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[var(--bv-accent)]">All phases</span>{" "}
                    complete
                  </>
                )}
              </span>
              {activePhase && (
                <span
                  className="border-l pl-[15px] font-mono text-[10.5px] uppercase tracking-[0.07em] whitespace-nowrap text-[var(--bv-ink-3)]"
                  style={{ borderColor: "var(--bv-line)" }}
                >
                  {activePhase.percent}% · {activePhase.stepsDone}/
                  {activePhase.stepsTotal}
                </span>
              )}
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
                  background: `linear-gradient(to bottom, var(--bv-brand), var(--bv-brand-mid))`,
                  boxShadow: "0 0 16px var(--bv-brand-tint-32)",
                  transitionTimingFunction: "var(--bv-ease)",
                }}
              />
            </div>

            {progress.phases.map((p, idx) => {
              const info = phaseInfo[p.key];
              const isPhase1ReadyToSubmit =
                p.key === "questionnaires" &&
                intakeCompletion !== null &&
                intakeCompletion !== undefined &&
                intakeSessionId !== null &&
                intakeSessionId !== undefined &&
                intakeCompletion.totalQuestions > 0 &&
                intakeCompletion.completionPercent === 100;
              // Unlock animation when phase becomes "active" or "complete" right after previous phase finished
              const justUnlocked = idx > 0 && info.phaseState !== "locked" && progress.phases[idx - 1].status === "complete";

              return (
                <div
                  className="relative mb-3 last:mb-0"
                  key={p.key}
                >
                  <div
                    className="absolute -left-[43px] top-5 z-[2] size-3.5 rounded-full border-2 transition-all duration-500 max-sm:-left-[31px]"
                    style={{
                      background:
                        info.phaseState === "complete"
                          ? `linear-gradient(140deg, var(--bv-brand), var(--bv-brand-mid))`
                          : info.phaseState === "active"
                            ? "#fff"
                            : info.nextUp
                              ? "#fff"
                              : "var(--bv-bg)",
                      borderColor:
                        info.phaseState === "complete"
                          ? "transparent"
                          : info.phaseState === "active"
                            ? "var(--bv-brand-deep)"
                            : info.nextUp
                              ? "var(--bv-brand-mid)"
                              : "var(--bv-line-2)",
                      boxShadow:
                        info.phaseState === "complete"
                          ? "0 0 0 4px var(--bv-brand-tint-16), 0 0 12px var(--bv-brand-tint-32)"
                          : info.phaseState === "active"
                            ? "0 0 0 4px var(--bv-brand-tint-16)"
                            : info.nextUp
                              ? "0 0 0 4px var(--bv-brand-tint-8)"
                              : undefined,
                      animation: info.nextUp
                        ? "ds-glow-pulse 2.4s var(--bv-ease) infinite"
                        : undefined,
                      transitionTimingFunction: "var(--bv-ease)",
                    }}
                  />
                  <div
                    className="absolute -left-[29px] top-[27px] z-[1] h-0.5 w-[29px] max-sm:hidden"
                    style={{
                      backgroundImage:
                        info.phaseState === "active" || info.phaseState === "complete"
                          ? `linear-gradient(to right, var(--bv-brand-deep) 0 4px, transparent 4px 8px)`
                          : info.nextUp
                            ? `linear-gradient(to right, var(--bv-brand-mid) 0 4px, transparent 4px 8px)`
                            : `linear-gradient(to right, var(--bv-line-dashed) 0 4px, transparent 4px 8px)`,
                      backgroundSize: "8px 2px",
                    }}
                  />
                  <PhaseCard
                    justUnlocked={justUnlocked}
                    onOpenSub={openSub}
                    onToggle={() => toggle(p.key)}
                    open={Boolean(openPhases[p.key])}
                    phase={p}
                    phaseState={info.phaseState}
                    submitSlot={
                      isPhase1ReadyToSubmit && intakeCompletion && intakeSessionId ? (
                        <FinalSubmitReadiness
                          completion={intakeCompletion}
                          sessionId={intakeSessionId}
                        />
                      ) : undefined
                    }
                  />
                </div>
              );
            })}
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
        <h2 className="mb-3.5 text-[clamp(22px,2.8vw,30px)] font-semibold leading-[1.1] tracking-[-0.024em] text-[var(--bv-ink)]">
          Four phases. One brand-aware brain.
        </h2>
        <p className="max-w-[560px] text-base leading-relaxed text-[var(--bv-ink-2)]">
          Brand Brain is built in sequence — first the brand tells us who it is,
          then strategy makes it operable, then aesthetics give it a face, and
          finally the AI team makes it speak.
        </p>
      </section>

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
