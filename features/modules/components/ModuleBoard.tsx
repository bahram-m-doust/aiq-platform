import Link from "next/link";
import { FileTextIcon, InboxIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DSCard, DSCardBody, DSCardHeader } from "@/components/ds/Card";
import { ModuleStatusBadge } from "@/features/modules/components/ModuleStatusBadge";
import type { AdminModuleBoardItem } from "@/features/modules/types";

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Not recorded";
}

function latestArtifactLabel(module: AdminModuleBoardItem) {
  if (!module.latestArtifact) {
    return "No artifact";
  }

  return `${module.latestArtifact.artifactType} v${module.latestArtifact.version}`;
}

export function ModuleBoard({
  modules,
  basePath,
  emptyTitle,
  emptyDescription,
  actionLabel,
}: {
  modules: AdminModuleBoardItem[];
  basePath: "/admin/modules" | "/dashboard/modules";
  emptyTitle: string;
  emptyDescription: string;
  actionLabel: string;
}) {
  if (modules.length === 0) {
    return (
      <DSCard tone="soft">
        <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
          <div
            className="flex size-14 items-center justify-center rounded-2xl"
            style={{
              background:
                "linear-gradient(135deg, var(--bv-brand-tint-16), var(--bv-brand-tint-8))",
              color: "var(--bv-brand-deep)",
              boxShadow: "0 0 0 1px var(--bv-brand-tint-16)",
            }}
          >
            <InboxIcon className="size-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="ds-h3">{emptyTitle}</h2>
            <p className="ds-body max-w-md mx-auto">{emptyDescription}</p>
          </div>
        </div>
      </DSCard>
    );
  }

  return (
    <div className="grid gap-4">
      {modules.map((module) => (
        <DSCard hover key={module.id}>
          <DSCardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <h3 className="ds-h3">{module.title}</h3>
                <p className="ds-caption">
                  {module.brandName} · {module.moduleTypeLabel}
                </p>
              </div>
              <ModuleStatusBadge status={module.status} />
            </div>
          </DSCardHeader>
          <DSCardBody>
            <div className="grid gap-4 md:grid-cols-[1fr_auto]">
              <dl className="grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-[var(--bv-ink-3)] text-xs">Assigned to</dt>
                  <dd className="mt-0.5">{module.assignedToEmail ?? "Unassigned"}</dd>
                </div>
                <div>
                  <dt className="text-[var(--bv-ink-3)] text-xs">Latest artifact</dt>
                  <dd className="mt-0.5">{latestArtifactLabel(module)}</dd>
                </div>
                <div>
                  <dt className="text-[var(--bv-ink-3)] text-xs">Updated</dt>
                  <dd className="mt-0.5 font-mono text-xs">{formatDate(module.updatedAt)}</dd>
                </div>
              </dl>
              <div className="flex items-start md:justify-end">
                <Button asChild variant="outline">
                  <Link href={`${basePath}/${module.id}`}>
                    <FileTextIcon className="size-4" />
                    {actionLabel}
                  </Link>
                </Button>
              </div>
            </div>
          </DSCardBody>
        </DSCard>
      ))}
    </div>
  );
}
