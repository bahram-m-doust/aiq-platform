import { Badge } from "@/components/ui/badge";
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
    <div className="flex flex-wrap gap-2">
      <Badge variant="outline">{documentVisibilityLabels[visibility]}</Badge>
      <Badge variant="secondary">{documentStatusLabels[status]}</Badge>
    </div>
  );
}
