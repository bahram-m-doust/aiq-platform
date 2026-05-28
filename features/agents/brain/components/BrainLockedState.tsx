import { BrainIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DSCard, DSCardBody, DSCardHeader } from "@/components/ds/Card";
import { readinessLabels } from "@/features/agents/brain/schema";
import type {
  BrandBrainAccess,
  BrandBrainReadiness,
} from "@/features/agents/brain/types";

export function BrainLockedState({
  access,
  readiness,
}: {
  access: BrandBrainAccess | null;
  readiness: BrandBrainReadiness;
}) {
  return (
    <DSCard>
      <DSCardHeader>
        <h2 className="ds-h2 flex items-center gap-2">
          <BrainIcon className="size-5" />
          Brand Brain locked
        </h2>
        <p className="ds-body mt-1">
          Brand Brain becomes available after the brand knowledge base completes
          RAG sync.
        </p>
      </DSCardHeader>
      <DSCardBody className="space-y-4">
        <Alert>
          <AlertTitle>Readiness status</AlertTitle>
          <AlertDescription>{readiness.message}</AlertDescription>
        </Alert>
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-[var(--bv-ink-3)] text-xs">Brand</dt>
            <dd className="mt-0.5 font-medium">
              {access?.brandName ?? "Not active"}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--bv-ink-3)] text-xs">Knowledge base</dt>
            <dd className="mt-0.5 font-medium">
              {readinessLabels[readiness.status]}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--bv-ink-3)] text-xs">Synced files</dt>
            <dd className="mt-0.5 font-medium">{readiness.syncedFileCount}</dd>
          </div>
        </dl>
      </DSCardBody>
    </DSCard>
  );
}
