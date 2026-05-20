import { moduleStatusLabels } from "@/features/modules/schema";
import type { ModuleStatus } from "@/features/modules/types";

export function ModuleStatusBadge({ status }: { status: ModuleStatus }) {
  return (
    <span className="inline-flex rounded-lg border border-border px-2.5 py-1 font-mono text-xs text-muted-foreground">
      {moduleStatusLabels[status]}
    </span>
  );
}
