import { ragStatusLabels } from "@/features/rag/schema";
import type { RagStatus } from "@/features/rag/types";

export function RagStatusBadge({ status }: { status: RagStatus }) {
  return (
    <span className="inline-flex rounded-lg border border-border px-2.5 py-1 font-mono text-xs text-muted-foreground">
      {ragStatusLabels[status]}
    </span>
  );
}
