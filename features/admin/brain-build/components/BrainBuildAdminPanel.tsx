"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BrainCircuitIcon, CalendarClockIcon, CheckCircle2Icon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildBrainNowAction,
  scheduleBrainBuildAction,
} from "@/features/admin/brain-build/actions";
import {
  initialBrainBuildActionState,
  type BrainBuildSchedule,
} from "@/features/admin/brain-build/types";

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function BrainBuildAdminPanel({
  brandId,
  brandName,
  schedule,
}: {
  brandId: string;
  brandName: string;
  schedule: BrainBuildSchedule | null;
}) {
  const router = useRouter();
  const [targetDate, setTargetDate] = useState(
    schedule?.targetDate ?? todayIso(),
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isScheduling, startSchedule] = useTransition();
  const [buildOpen, setBuildOpen] = useState(false);
  const [isBuilding, startBuild] = useTransition();

  const built = Boolean(schedule?.builtAt);

  function handleSchedule() {
    if (!targetDate) return;
    setError(null);
    setNotice(null);
    startSchedule(async () => {
      const formData = new FormData();
      formData.append("brand_id", brandId);
      formData.append("target_date", targetDate);
      const result = await scheduleBrainBuildAction(
        initialBrainBuildActionState,
        formData,
      );
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      setNotice(result.message);
      router.refresh();
    });
  }

  function handleBuild() {
    setError(null);
    setNotice(null);
    startBuild(async () => {
      const formData = new FormData();
      formData.append("brand_id", brandId);
      const result = await buildBrainNowAction(
        initialBrainBuildActionState,
        formData,
      );
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      setBuildOpen(false);
      setNotice(result.message);
      router.refresh();
    });
  }

  return (
    <details className="group rounded-lg border border-border">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium">
        <span className="inline-flex items-center gap-2">
          <BrainCircuitIcon className="size-4 text-muted-foreground" />
          Brain Build
        </span>
        {built ? (
          <Badge variant="default">
            <CheckCircle2Icon className="size-3" />
            Built
          </Badge>
        ) : schedule ? (
          <Badge variant="secondary">
            Scheduled · {formatDate(schedule.targetDate)}
          </Badge>
        ) : (
          <Badge variant="outline">Not scheduled</Badge>
        )}
      </summary>

      <div className="space-y-4 border-t border-border px-3 py-3">
        {built ? (
          <p className="text-sm text-muted-foreground">
            Brain was built on {formatDate(schedule?.builtAt ?? null)}. The Brand
            Brain chatbot is unlocked for this brand. Re-running a build re-syncs
            the latest RAG-approved documents.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Set a target date to show {brandName}&apos;s team an animated
            progress bar in Phase 04. When ready, run{" "}
            <span className="font-medium text-foreground">Build Now</span> to
            sync RAG documents, activate the brain, and notify the team.
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor={`brain-build-date-${brandId}`}>Target date</Label>
          <div className="flex items-center gap-2">
            <Input
              className="max-w-[12rem]"
              id={`brain-build-date-${brandId}`}
              min={todayIso()}
              onChange={(event) => setTargetDate(event.target.value)}
              type="date"
              value={targetDate}
            />
            <Button
              disabled={isScheduling || !targetDate}
              onClick={handleSchedule}
              size="sm"
              type="button"
              variant="outline"
            >
              <CalendarClockIcon className="size-4" />
              {isScheduling
                ? "Saving…"
                : schedule
                  ? "Update date"
                  : "Schedule"}
            </Button>
          </div>
        </div>

        <Dialog onOpenChange={setBuildOpen} open={buildOpen}>
          <DialogTrigger asChild>
            <Button size="sm" type="button">
              <BrainCircuitIcon className="size-4" />
              {built ? "Rebuild brain" : "Build Now"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {built ? "Rebuild" : "Build"} brain for “{brandName}”?
              </DialogTitle>
              <DialogDescription>
                This syncs every RAG-approved document into the knowledge base
                (chunk + embed), activates the Brand Brain agent, marks the brain
                complete, and emails + notifies all brand members that their
                Brand Brain is ready.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                disabled={isBuilding}
                onClick={() => setBuildOpen(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button disabled={isBuilding} onClick={handleBuild} type="button">
                {isBuilding ? "Building…" : built ? "Rebuild brain" : "Build now"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {notice ? (
          <Alert>
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        ) : null}
      </div>
    </details>
  );
}
