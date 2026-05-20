import Link from "next/link";
import { FileTextIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
      <Card>
        <CardHeader>
          <CardTitle>{emptyTitle}</CardTitle>
          <CardDescription>{emptyDescription}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {modules.map((module) => (
        <Card key={module.id}>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <CardTitle>{module.title}</CardTitle>
                <CardDescription>
                  {module.brandName} | {module.moduleTypeLabel}
                </CardDescription>
              </div>
              <ModuleStatusBadge status={module.status} />
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-[1fr_auto]">
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">Assigned to</dt>
                <dd>{module.assignedToEmail ?? "Unassigned"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Latest artifact</dt>
                <dd>{latestArtifactLabel(module)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Updated</dt>
                <dd className="font-mono">{formatDate(module.updatedAt)}</dd>
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
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
