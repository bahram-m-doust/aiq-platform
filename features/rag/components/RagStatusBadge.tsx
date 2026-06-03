import { Badge } from "@/components/ui/badge";
import { ragStatusLabels } from "@/features/rag/schema";
import type { RagStatus } from "@/features/rag/types";

export function RagStatusBadge({ status }: { status: RagStatus }) {
  return <Badge variant="secondary">{ragStatusLabels[status]}</Badge>;
}
