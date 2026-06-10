"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  approveCityModelDistrictAction,
  requestCityModelDistrictChangesAction,
} from "@/features/city-model-deliverables/actions";
import type { CityModelDistrictWorkspace } from "@/features/city-model-deliverables/types";
import { DeliverableStatusBadge } from "@/features/review-deliverables/components/DeliverableStatusBadge";

export function CityModelDistrictView({
  slug,
  workspace,
}: {
  slug: string;
  workspace: CityModelDistrictWorkspace;
}) {
  const { district, status, signedUrl, fileName, canReview } = workspace;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const decide = (
    action: (slug: string) => Promise<{ ok: boolean; message?: string }>,
  ) => {
    setError(null);
    startTransition(async () => {
      const result = await action(slug);
      if (!result.ok) setError(result.message ?? "Something went wrong.");
    });
  };

  const canDecide = canReview && status === "CLIENT_REVIEW";

  return (
    <main
      className="min-h-svh px-4 py-6 sm:px-6 sm:py-10"
      style={{ background: "#ffffff", color: "var(--bv-ink)" }}
    >
      <section className="mx-auto w-full max-w-[860px] space-y-6">
        <header className="space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--bv-ink-3)]">
            City Model · District
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="ds-h1">{district.name}</h1>
            <DeliverableStatusBadge status={status} />
          </div>
          <p className="ds-body max-w-xl">{district.description}</p>
        </header>

        {signedUrl ? (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-[10px] border border-border bg-white">
              <iframe
                className="h-[78vh] w-full"
                src={signedUrl}
                title={`${district.name} deliverable`}
              />
            </div>
            {fileName ? (
              <p className="text-[12px] text-muted-foreground">{fileName}</p>
            ) : null}

            {canDecide ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  disabled={pending}
                  onClick={() => decide(approveCityModelDistrictAction)}
                  type="button"
                >
                  Approve
                </Button>
                <Button
                  disabled={pending}
                  onClick={() =>
                    decide(requestCityModelDistrictChangesAction)
                  }
                  type="button"
                  variant="outline"
                >
                  Request changes
                </Button>
                {error ? (
                  <span className="text-[12px] text-red-600">{error}</span>
                ) : null}
              </div>
            ) : status === "APPROVED" ? (
              <p className="text-[13px] font-medium text-emerald-700">
                You approved this district.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="rounded-[10px] border border-dashed border-border px-6 py-12 text-center">
            <p className="text-sm font-medium text-foreground">
              This district&apos;s deliverable is being prepared.
            </p>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              The Bextudio team will upload it here for your review and approval.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
