"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import type {
  BrainBuildScheduleView,
  BrandBuildProgress,
  PhaseProgress,
  PhaseStatus,
  SubstepProgress,
  SubstepState,
} from "@/features/app/build-progress";
import { FinalSubmitReadiness } from "@/features/questionnaire/components/FinalSubmitReadiness";
import type { IntakeCompletion } from "@/features/questionnaire/types";

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

/* ── Brain Build (Phase 04) special states ── */

function formatLongDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Cosmetic schedule progress: linear interpolation from when the build was
// scheduled to its target date, capped just shy of full until Bextudio ships
// the brain — so the bar reads "almost there" rather than implying it's done.
function scheduleProgressPercent(schedule: BrainBuildScheduleView): number {
  const start = schedule.scheduledAt
    ? new Date(schedule.scheduledAt).getTime()
    : Date.now();
  // Target lands at the end of the chosen day.
  const end = new Date(`${schedule.targetDate}T23:59:59`).getTime();
  const now = Date.now();
  if (!Number.isFinite(end) || end <= start) return 95;
  const ratio = (now - start) / (end - start);
  return Math.max(4, Math.min(95, Math.round(ratio * 100)));
}

function daysRemaining(targetDate: string): number {
  const end = new Date(`${targetDate}T23:59:59`).getTime();
  if (!Number.isFinite(end)) return 0;
  const diff = end - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

// The Phase 04 body when the phase is reachable (aesthetics approved) but the
// brain hasn't shipped: a "waiting for Bextudio" notice, or — once a target
// date is set — an animated, milestone-marked progress bar. When built, an
// "Open Brand Brain" call to action.
function BrainBuildPanel({
  phase,
  schedule,
  built,
}: {
  phase: PhaseProgress;
  schedule: BrainBuildScheduleView | null;
  built: boolean;
}) {
  const [fill, setFill] = useState(0);
  const targetPct = built
    ? 100
    : schedule
      ? scheduleProgressPercent(schedule)
      : 0;

  // Animate the bar from 0 to its target on mount so it feels alive.
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setFill(targetPct));
    return () => window.cancelAnimationFrame(id);
  }, [targetPct]);

  if (built) {
    return (
      <div
        className="rounded-[14px] border bg-[var(--bv-card-soft)] p-4"
        style={{ borderColor: "var(--bv-line)" }}
      >
        <div className="mb-2 flex items-center gap-2">
          <span
            className="inline-block size-[7px] rounded-full"
            style={{ background: "#2bc78a" }}
          />
          <h3 className="text-[13.5px] font-semibold tracking-[-0.005em] text-[var(--bv-ink)]">
            Your Brand Brain is live
          </h3>
        </div>
        <p className="mb-3.5 text-xs leading-relaxed text-[var(--bv-ink-3)]">
          The Bextudio team has finished building your brand-aware brain. Start a
          conversation grounded in everything we&apos;ve assembled together.
        </p>
        <Link
          className="inline-flex items-center gap-2 rounded-[10px] px-3.5 py-2 text-[13px] font-medium text-white transition-transform duration-200 hover:-translate-y-0.5"
          href={ROUTES.brainBrand}
          style={{ background: PHASE_GRADIENTS[4] }}
        >
          Open Brand Brain
          <svg
            aria-hidden="true"
            fill="none"
            height="14"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="14"
          >
            <line x1="5" x2="19" y1="12" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </Link>
      </div>
    );
  }

  if (!schedule) {
    return (
      <div
        className="flex gap-3.5 rounded-[14px] border border-dashed bg-[var(--bv-card-soft)] p-4"
        style={{ borderColor: "var(--bv-line-2)" }}
      >
        <span
          className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full"
          style={{ background: "var(--bv-brand-tint-16)" }}
        >
          <svg
            aria-hidden="true"
            fill="none"
            height="15"
            stroke="var(--bv-brand-deep)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.9"
            viewBox="0 0 24 24"
            width="15"
          >
            <circle cx="12" cy="12" r="9" />
            <polyline points="12 7 12 12 15 14" />
          </svg>
        </span>
        <div>
          <h3 className="mb-1 text-[13.5px] font-semibold tracking-[-0.005em] text-[var(--bv-ink)]">
            Waiting for Bextudio
          </h3>
          <p className="text-xs leading-relaxed text-[var(--bv-ink-3)]">
            Your aesthetics are approved — the foundation is complete. The
            Bextudio team is now preparing your Brand Brain build and will share a
            ready date shortly.
          </p>
        </div>
      </div>
    );
  }

  const remaining = daysRemaining(schedule.targetDate);
  const milestoneCount = phase.substeps.length;
  // Map the cosmetic time-progress onto discrete steps. Steps before the active
  // index read as done; the active index is the one currently "in build". The
  // last step never auto-completes — it only flips to done once Bextudio ships
  // the brain (the `built` branch above), so the stepper never implies it's
  // finished ahead of time.
  const reached = Math.round((fill / 100) * milestoneCount);
  const activeStep = Math.min(reached, milestoneCount - 1);

  return (
    <div
      className="rounded-[14px] border bg-[var(--bv-card-soft)] p-4"
      style={{ borderColor: "var(--bv-line)" }}
    >
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-[13.5px] font-semibold tracking-[-0.005em] text-[var(--bv-ink)]">
          Building your Brand Brain
        </h3>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--bv-ink-3)]">
          {remaining === 0 ? "Arriving soon" : `~${remaining} day${remaining === 1 ? "" : "s"} left`}
        </span>
      </div>

      {/* Stepper indicator — numbered nodes joined by connectors */}
      <ol className="mb-3 mt-5 flex items-start">
        {phase.substeps.map((s, i) => {
          const done = i < activeStep;
          const active = i === activeStep;
          return (
            <li
              className="relative flex flex-1 flex-col items-center text-center"
              key={s.id}
            >
              {i > 0 ? (
                <span
                  className="absolute right-1/2 top-[10px] z-0 h-0.5 w-full transition-all duration-500"
                  style={{
                    background:
                      i <= activeStep
                        ? "var(--bv-brand-mid)"
                        : "var(--bv-line-2)",
                    transitionDelay: `${i * 100}ms`,
                  }}
                />
              ) : null}
              <span
                className="relative z-[1] grid size-[21px] place-items-center rounded-full border-2 text-[10px] font-semibold transition-all duration-500"
                style={{
                  background: done ? "var(--bv-brand-mid)" : "#fff",
                  borderColor:
                    done || active
                      ? "var(--bv-brand-deep)"
                      : "var(--bv-line-2)",
                  color: done
                    ? "#fff"
                    : active
                      ? "var(--bv-brand-deep)"
                      : "var(--bv-ink-4)",
                  boxShadow: active
                    ? "0 0 0 4px var(--bv-brand-tint-16)"
                    : undefined,
                  transitionDelay: `${i * 100}ms`,
                }}
              >
                {done ? (
                  <svg
                    aria-hidden="true"
                    fill="none"
                    height="11"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="3"
                    viewBox="0 0 24 24"
                    width="11"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              <span
                className="mt-2 px-0.5 text-[9.5px] leading-tight"
                style={{
                  color:
                    done || active ? "var(--bv-ink-2)" : "var(--bv-ink-4)",
                }}
              >
                {s.title}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="border-t border-dashed pt-3 text-[11px] leading-relaxed text-[var(--bv-ink-3)]" style={{ borderColor: "var(--bv-line)" }}>
        Estimated ready by{" "}
        <strong className="font-medium text-[var(--bv-ink)]">
          {formatLongDate(schedule.targetDate)}
        </strong>
        . We&apos;ll email you the moment it&apos;s live.
      </p>
    </div>
  );
}

/* ── Phase Card ── */

// Per-phase accent colour, shared by the phase glyph chip and the progress bar.
const PHASE_GRADIENTS: Record<number, string> = {
  1: "var(--bv-c1-b)",
  2: "var(--bv-c2-b)",
  3: "var(--bv-c3-b)",
  4: "var(--bv-c4-b)",
};

function PhaseCard({
  phase,
  open,
  onToggle,
  onOpenSub,
  phaseState,
  submitSlot,
  justUnlocked,
  brainBuild,
}: {
  phase: PhaseProgress;
  open: boolean;
  onToggle: () => void;
  onOpenSub: (phase: PhaseProgress, substep: SubstepProgress, state: SubstepState) => void;
  phaseState: PhaseStatus;
  submitSlot?: React.ReactNode;
  justUnlocked?: boolean;
  brainBuild?: BrainBuildScheduleView | null;
}) {
  const isLocked = phaseState === "locked";
  // Phase 04 swaps its substep list for the Brain Build panel (waiting /
  // progress / live) once the phase is reachable. When still locked, we show
  // nothing at all — no sub-step cards — because the brain build process hasn't
  // started and listing its internal steps before aesthetics is approved would
  // be confusing and premature.
  const isBrainBuildLocked = phase.key === "brain_build" && isLocked;
  const showBrainBuildPanel = phase.key === "brain_build" && !isLocked;
  const brainBuilt = Boolean(brainBuild?.builtAt);
  const brainScheduled = Boolean(brainBuild);
  // Until Bextudio schedules the build, the brain phase has no real progress to
  // report — so hide the "0 / 4 complete" footer count and the empty headline
  // progress bar. Once a target date is set, the cosmetic schedule progress and
  // the in-panel stepper take over.
  const hideBrainProgress = showBrainBuildPanel && !brainBuilt && !brainScheduled;
  const hideStepCount = phase.key === "brain_build" && !brainBuilt;
  const isReadyToSubmit = phase.phase === 1 && submitSlot !== undefined;
  const tone = phase.phase;
  const cardAnimation = justUnlocked
    ? "ds-unlock 800ms var(--bv-ease)"
    : undefined;
  const panelContentRef = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState(0);

  useEffect(() => {
    const measurePanel = () => {
      setPanelHeight(panelContentRef.current?.scrollHeight ?? 0);
    };

    measurePanel();

    if (!panelContentRef.current || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(measurePanel);
    observer.observe(panelContentRef.current);

    return () => observer.disconnect();
  }, []);

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
                background: PHASE_GRADIENTS[tone],
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
        {hideBrainProgress ? (
          <div className="px-6 pb-5 pt-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--bv-ink-3)]">
              Awaiting schedule
            </span>
          </div>
        ) : (
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
                      ? "var(--bv-brand-mid)"
                      : PHASE_GRADIENTS[tone],
                  transitionTimingFunction: "var(--bv-ease)",
                }}
              />
            </span>
            <span className="text-[12px] font-medium text-[var(--bv-ink-3)]">
              {phase.percent}%
            </span>
          </div>
        )}

        {/* card footer */}
        <div
          className="flex items-center justify-between gap-3 border-t border-dashed px-6 py-4"
          style={{ borderColor: "var(--bv-line-dashed)" }}
        >
          {hideStepCount ? (
            <span className="text-[12px] leading-4 text-[var(--bv-ink-3)]">
              {brainScheduled ? "In build" : "Waiting for Bextudio"}
            </span>
          ) : (
            <span className="text-[12px] leading-4">
              <strong className="font-medium text-[var(--bv-ink)]">
                {phase.stepsDone} / {phase.stepsTotal}
              </strong>{" "}
              <span className="text-[var(--bv-ink-3)]">
                {isReadyToSubmit ? "answered" : "complete"}
              </span>
            </span>
          )}
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
          maxHeight: open ? panelHeight : 0,
          borderTopColor: open ? "var(--bv-line)" : "transparent",
          transitionTimingFunction: "var(--bv-ease)",
        }}
      >
        <div className="grid gap-2 p-3 pt-3" ref={panelContentRef}>
          {!isBrainBuildLocked && (
            <div className="mx-1 mb-1 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--bv-ink-3)]">
              <span>{showBrainBuildPanel ? "Status" : "Sub-steps"}</span>
              <span className="text-[var(--bv-ink-4)]">
                {showBrainBuildPanel
                  ? brainBuilt
                    ? "Ready"
                    : "In build"
                  : `${phase.substeps.length} total`}
              </span>
            </div>
          )}
          {showBrainBuildPanel ? (
            <BrainBuildPanel
              built={brainBuilt}
              phase={phase}
              schedule={brainBuild ?? null}
            />
          ) : null}
          {showBrainBuildPanel || isBrainBuildLocked ? null : phase.substeps.map((s, i) => {
            // href substeps (the City Model view) carry their own availability,
            // decided in build-progress (it can unlock ahead of the phase). All
            // other substeps are gated by the phase lock.
            const effectiveState: SubstepState = s.href
              ? s.state
              : isLocked
                ? "locked"
                : s.state;
            const cardClassName =
              "block w-full cursor-pointer rounded-[14px] border bg-[var(--bv-card-soft)] p-3 text-left transition-all duration-200 hover:border-[var(--bv-line-2)] hover:bg-white disabled:cursor-not-allowed disabled:opacity-40";
            const cardInner = (
              <>
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
                      {isLocked
                        ? `Unlocks after Phase ${String(phase.phase - 1).padStart(2, "0")}`
                        : "Coming soon"}
                    </span>
                  ) : <span />}
                  <StatePill state={effectiveState} />
                </div>
              </>
            );

            // Substeps with an href navigate to their own page; the rest open
            // the in-app detail overlay. Locked substeps stay inert.
            if (s.href && effectiveState !== "locked") {
              return (
                <Link
                  className={cardClassName}
                  href={s.href}
                  key={s.id}
                  style={{ borderColor: "var(--bv-line)" }}
                  tabIndex={open ? 0 : -1}
                >
                  {cardInner}
                </Link>
              );
            }

            return (
              <button
                className={cardClassName}
                disabled={effectiveState === "locked"}
                key={s.id}
                onClick={() => onOpenSub(phase, s, effectiveState)}
                style={{ borderColor: "var(--bv-line)" }}
                tabIndex={open ? 0 : -1}
                type="button"
              >
                {cardInner}
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
        style={{ background: "var(--bv-bg)" }}
      />

      <div className="relative z-10 mx-auto max-w-[980px] px-7 pb-24 pt-9">
        <div className="mb-9 flex items-center justify-between">
          <Button onClick={onBack} size="sm" type="button" variant="outline">
            <BackArrow /> Back to roadmap
          </Button>
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
                  background: PHASE_GRADIENTS[phase.phase],
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
  intakeCompletion,
  intakeSessionId,
  intakeCanApprove = false,
}: {
  progress: BrandBuildProgress;
  intakeCompletion?: IntakeCompletion | null;
  intakeSessionId?: string | null;
  intakeCanApprove?: boolean;
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

  // Progress expressed in node-index space: every completed phase advances one
  // full segment between nodes, and the active phase advances by its percent.
  // So a phase at 100% lands the value exactly on the *next* node.
  const spineProgressIndex = useMemo(() => {
    let completed = 0;
    let activeFraction = 0;
    for (const p of progress.phases) {
      const inf = phaseInfo[p.key];
      if (inf.phaseState === "complete") {
        completed += 1;
      } else if (inf.phaseState === "active") {
        activeFraction = p.percent / 100;
        break;
      } else {
        break; // locked — nothing further is filled
      }
    }
    return completed + activeFraction;
  }, [progress.phases, phaseInfo]);

  // Measure real node positions so the fill reaches the actual next node (the
  // heuristic % above can't, since phase cards have varying heights). Falls back
  // to the % until measured.
  const spineRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [spineFillPx, setSpineFillPx] = useState<number | null>(null);

  useEffect(() => {
    const TRACK_TOP = 27; // matches the spine track's `top-[27px]` (first node center)
    const measure = () => {
      const container = spineRef.current;
      const nodes = nodeRefs.current.filter(Boolean) as HTMLDivElement[];
      if (!container || nodes.length === 0) return;
      const cTop = container.getBoundingClientRect().top;
      const centers = nodes.map((n) => {
        const r = n.getBoundingClientRect();
        return r.top - cTop + r.height / 2;
      });
      const maxIdx = centers.length - 1;
      const t = Math.max(0, Math.min(maxIdx, spineProgressIndex));
      const lo = Math.floor(t);
      const hi = Math.min(maxIdx, Math.ceil(t));
      const y = centers[lo] + (centers[hi] - centers[lo]) * (t - lo);
      setSpineFillPx(Math.max(0, y - TRACK_TOP));
    };
    measure();
    window.addEventListener("resize", measure);
    // A ResizeObserver re-measures as the spine's height settles — e.g. while a
    // phase card's expand/collapse transition animates — so the fill tracks the
    // node positions instead of freezing at the pre-animation layout.
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => measure())
        : null;
    if (observer && spineRef.current) observer.observe(spineRef.current);
    return () => {
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [spineProgressIndex, openPhases, progress.phases]);

  // Once the final phase (Brain Build) is complete, the spine should stop at its
  // node — no trailing dashed segment dangling below the last card.
  const finalPhaseComplete = useMemo(() => {
    const last = progress.phases[progress.phases.length - 1];
    return last ? phaseInfo[last.key]?.phaseState === "complete" : false;
  }, [progress.phases, phaseInfo]);
  const spineEndsAtLastNode = finalPhaseComplete && spineFillPx !== null;

  const router = useRouter();
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
        if (substep.id === "stakeholder-interviews") {
          router.push(ROUTES.brainRoadmapStakeholderInterviews);
          return;
        }
        if (substep.id === "futures-research") {
          router.push(ROUTES.brainRoadmapFuturesResearch);
          return;
        }
        router.push(ROUTES.questionnaire);
        return;
      }
      if (phase.key === "strategies") {
        router.push(ROUTES.modules);
        return;
      }
      if (phase.key === "brain_build") {
        router.push(ROUTES.brain);
        return;
      }
      setDetail({ phase, substep, state });
    },
    [router],
  );
  const closeDetail = useCallback(() => setDetail(null), []);

  return (
    <div
      className="w-full px-6 pb-16 pt-6 sm:pb-24"
      style={{ color: "var(--bv-ink)" }}
    >
      {/* ── Roadmap intro ── */}
      <section className="mb-12 w-[calc(50%+328px)] max-w-full">
        <span className="mb-3.5 inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--bv-ink-3)]">
          <span
            className="inline-block h-px w-[18px]"
            style={{ background: "var(--bv-line-2)" }}
          />
          Brand Brain · build roadmap
        </span>
        <h2 className="mb-3 text-[clamp(20px,2.6vw,26px)] font-semibold leading-[1.15] tracking-[-0.02em] text-[var(--bv-ink)]">
          Building your Brand Brain, together
        </h2>
        <p className="max-w-[760px] text-[15px] leading-relaxed text-[var(--bv-ink-2)]">
          This roadmap is how we build your{" "}
          <strong className="font-medium text-[var(--bv-ink)]">
            Brand Brain
          </strong>{" "}
          — a brand-aware AI that thinks, writes, and decides the way your
          brand would. It comes together as a partnership: you bring the raw
          signal and direction, and the{" "}
          <strong className="font-medium text-[var(--bv-ink)]">
            Bextudio
          </strong>{" "}
          team turns it into strategy, aesthetics, and a trained brand model.
          Each phase below is completed hand in hand and unlocks the next, so
          they move in order — every phase builds on the one before it.
        </p>
      </section>

      {/* ── Build content ── */}
      <div
        className="mx-auto w-full max-w-[656px]"
        style={{ animation: "bv-fade-in 600ms var(--bv-ease)" }}
      >
        {/* Hub */}
          <div className="mb-16 pl-14 max-sm:pl-9">
            <div className="flex w-full max-w-[600px] items-center justify-center">
            <div className="relative inline-flex items-center gap-3.5 rounded-[8px] border border-border bg-card py-2 pl-[14px] pr-[22px] shadow-lg">
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
          </div>

          {/* Spine Track */}
          <div className="relative pl-14 max-sm:pl-9" ref={spineRef}>
            <div
              className={`absolute left-[19px] top-[27px] w-0.5 rounded-sm max-sm:left-[11px] ${
                spineEndsAtLastNode ? "" : "bottom-[18px]"
              }`}
              style={{
                height: spineEndsAtLastNode ? `${spineFillPx}px` : undefined,
                backgroundImage: `linear-gradient(to bottom, var(--bv-line-dashed) 0 6px, transparent 6px 12px)`,
                backgroundSize: "2px 12px",
                backgroundRepeat: "repeat-y",
              }}
            >
              <div
                className="absolute inset-x-0 top-0 rounded-sm transition-all duration-700"
                style={{
                  height:
                    spineFillPx !== null
                      ? `${spineFillPx}px`
                      : `${spineFillPct}%`,
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
                intakeCompletion.completionPercent === 100 &&
                // Approve & Lock only once every sub-step of the phase is done,
                // not just the questionnaire.
                p.substeps.every((s) => s.state === "done");
              // Unlock animation when phase becomes "active" or "complete" right after previous phase finished
              const justUnlocked = idx > 0 && info.phaseState !== "locked" && progress.phases[idx - 1].status === "complete";

              return (
                <div
                  className="relative mb-16 last:mb-0"
                  key={p.key}
                >
                  <div
                    ref={(el) => {
                      nodeRefs.current[idx] = el;
                    }}
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
                    brainBuild={progress.brainBuild}
                    justUnlocked={justUnlocked}
                    onOpenSub={openSub}
                    onToggle={() => toggle(p.key)}
                    open={Boolean(openPhases[p.key])}
                    phase={p}
                    phaseState={info.phaseState}
                    submitSlot={
                      isPhase1ReadyToSubmit && intakeCompletion && intakeSessionId ? (
                        <FinalSubmitReadiness
                          canApprove={intakeCanApprove}
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
