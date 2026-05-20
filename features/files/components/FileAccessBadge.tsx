import type { FileStatus, FileVisibility } from "@/features/files/types";
import {
  fileStatusLabels,
  fileVisibilityLabels,
} from "@/features/files/schema";

export function FileAccessBadge({
  visibility,
  status,
}: {
  visibility: FileVisibility;
  status: FileStatus;
}) {
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <span className="rounded-md border border-border px-2 py-1 font-medium">
        {fileVisibilityLabels[visibility]}
      </span>
      <span className="rounded-md bg-muted px-2 py-1 text-muted-foreground">
        {fileStatusLabels[status]}
      </span>
    </div>
  );
}
