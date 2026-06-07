import type { DocumentStatus, DocumentVisibility } from "@/features/documents/types";
import {
  documentStatusLabels,
  documentVisibilityLabels,
} from "@/features/documents/schema";

export function DocumentAccessBadge({
  visibility,
  status,
}: {
  visibility: DocumentVisibility;
  status: DocumentStatus;
}) {
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <span className="rounded-md border border-border px-2 py-1 font-medium">
        {documentVisibilityLabels[visibility]}
      </span>
      <span className="rounded-md bg-muted px-2 py-1 text-muted-foreground">
        {documentStatusLabels[status]}
      </span>
    </div>
  );
}
