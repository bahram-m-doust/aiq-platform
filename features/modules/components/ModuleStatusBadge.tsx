import { Badge } from "@/components/ui/badge";
import { moduleStatusLabels } from "@/features/modules/schema";
import type { ModuleStatus } from "@/features/modules/types";

export function ModuleStatusBadge({ status }: { status: ModuleStatus }) {
  return <Badge variant="secondary">{moduleStatusLabels[status]}</Badge>;
}
