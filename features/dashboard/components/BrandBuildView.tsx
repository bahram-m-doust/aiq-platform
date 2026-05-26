"use client";

import { useState } from "react";
import {
  BookOpenIcon,
  BrainIcon,
  ChevronDownIcon,
  LightbulbIcon,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { cn } from "@/lib/utils";
import type {
  BrandBuildProgress,
  PhaseProgress,
  PhaseStatus,
} from "@/features/dashboard/build-progress";

type PhaseColor = "orange" | "blue" | "green";

const phaseColors: Record<1 | 2 | 3, PhaseColor> = {
  1: "orange",
  2: "blue",
  3: "green",
};

const phaseIcons: Record<1 | 2 | 3, typeof BookOpenIcon> = {
  1: BookOpenIcon,
  2: LightbulbIcon,
  3: BrainIcon,
};

const phaseIconBg: Record<PhaseColor, string> = {
  orange: "bg-orange-100 text-orange-600",
  blue: "bg-blue-100 text-blue-600",
  green: "bg-emerald-100 text-emerald-600",
};

const phaseDotColor: Record<PhaseStatus, string> = {
  complete: "bg-emerald-500",
  active: "bg-blue-500 animate-pulse",
  locked: "bg-muted-foreground/30",
};

const phaseLinks: Record<1 | 2 | 3, string> = {
  1: "/dashboard/intake",
  2: "/dashboard/modules",
  3: "/dashboard/brain",
};

function CircularProgress({
  percent,
  label,
  subtitle,
}: {
  percent: number;
  label: string;
  subtitle: string;
}) {
  const size = 120;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          className="-rotate-90"
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          width={size}
        >
          <circle
            className="text-muted"
            cx={size / 2}
            cy={size / 2}
            fill="none"
            r={radius}
            stroke="currentColor"
            strokeWidth={stroke}
          />
          <circle
            className="text-blue-500 transition-all duration-700 ease-out"
            cx={size / 2}
            cy={size / 2}
            fill="none"
            r={radius}
            stroke="currentColor"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            strokeWidth={stroke}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums">{percent}%</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium">
          Building <span className="text-blue-600">{label}</span>
        </p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function PhaseBadge({
  phase,
  status,
}: {
  phase: number;
  status: PhaseStatus;
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
      <span className={cn("inline-block size-2 rounded-full", phaseDotColor[status])} />
      Phase {String(phase).padStart(2, "0")}
    </div>
  );
}

function PhaseCard({
  phase,
}: {
  phase: PhaseProgress;
}) {
  const [expanded, setExpanded] = useState(false);
  const color = phaseColors[phase.phase];
  const Icon = phaseIcons[phase.phase];
  const isLocked = phase.status === "locked";

  return (
    <Card className={cn(isLocked && "opacity-60")}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={cn("flex size-10 items-center justify-center rounded-lg", phaseIconBg[color])}>
              <Icon className="size-5" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-base">{phase.title}</CardTitle>
              <CardDescription className="text-sm leading-relaxed">
                {phase.description}
              </CardDescription>
            </div>
          </div>
          <PhaseBadge phase={phase.phase} status={phase.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <ProgressBar color={isLocked ? "muted" : color} value={phase.percent} />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{phase.teamLabel}</span>
            <span className="tabular-nums">{phase.percent}%</span>
          </div>
        </div>

        {phase.stepsTotal > 0 ? (
          <button
            className="flex w-full items-center justify-between rounded-md px-1 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setExpanded(!expanded)}
            type="button"
          >
            <span>
              {phase.stepsDone} / {phase.stepsTotal} steps
            </span>
            <ChevronDownIcon
              className={cn(
                "size-4 transition-transform duration-200",
                expanded && "rotate-180",
              )}
            />
          </button>
        ) : null}

        {expanded && phase.status !== "locked" ? (
          <div className="pt-1">
            <Button asChild size="sm" variant="outline">
              <Link href={phaseLinks[phase.phase]}>
                {phase.status === "complete" ? "View" : "Continue"}
              </Link>
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function BrandBuildView({
  progress,
}: {
  progress: BrandBuildProgress;
}) {
  const activeLabel = progress.activePhase?.title ?? "Complete";
  const activePhaseNum = progress.activePhase?.phase ?? 3;

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-border bg-card p-8">
        <div className="flex flex-col items-center gap-6">
          <CircularProgress
            label={activeLabel}
            percent={progress.overallPercent}
            subtitle={`${progress.stepsDone} / ${progress.stepsTotal}`}
          />
        </div>

        <div className="relative mt-8 space-y-4 pl-6">
          <div className="absolute bottom-4 left-[11px] top-4 w-0.5 bg-border" />

          {progress.phases.map((phase) => (
            <div className="relative" key={phase.key}>
              <div
                className={cn(
                  "absolute -left-6 top-6 size-3 rounded-full border-2 border-card",
                  phase.status === "complete"
                    ? "bg-emerald-500"
                    : phase.status === "active"
                      ? "bg-blue-500"
                      : "bg-muted",
                )}
              />
              <PhaseCard phase={phase} />
            </div>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-3 gap-4 border-t border-border pt-6 text-center">
          <Stat label="Overall" value={`${progress.overallPercent}%`} />
          <Stat
            label="Steps Done"
            value={`${progress.stepsDone} / ${progress.stepsTotal}`}
          />
          <Stat
            label="Active Phase"
            value={`${String(activePhaseNum).padStart(2, "0")} · ${activeLabel}`}
          />
        </div>
      </div>
    </div>
  );
}
