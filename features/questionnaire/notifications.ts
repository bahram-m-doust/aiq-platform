import "server-only";

import type { IntakeInternalNotificationPlaceholder } from "@/features/questionnaire/types";

export function createIntakeInternalNotificationPlaceholder({
  brandId,
  sessionId,
  snapshotId,
  createdAt,
}: {
  brandId: string;
  sessionId: string;
  snapshotId: string;
  createdAt: string;
}): IntakeInternalNotificationPlaceholder {
  return {
    status: "placeholder",
    channel: "internal_team",
    event: "intake_final_submitted",
    brandId,
    sessionId,
    snapshotId,
    createdAt,
    delivery: "not_configured",
  };
}
