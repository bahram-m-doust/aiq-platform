import "server-only";

import type { UserProfile } from "@/features/auth/types";
import {
  canViewAdminModulesRole,
  isCanonicalModuleType,
} from "@/features/modules/schema";
import {
  getAdminModuleDetail,
  getClientModuleDetail,
} from "@/features/modules/queries";
import type { ModuleRecord } from "@/features/modules/types";
import { moduleServiceError } from "@/features/modules/service-errors";

export async function requireAdminModuleDetail({
  moduleId,
  profile,
}: {
  moduleId: string;
  profile: UserProfile;
}) {
  const detail = await getAdminModuleDetail({ moduleId, profile });

  if (!detail) {
    moduleServiceError("Module could not be found.");
  }

  return detail;
}

export async function requireClientModuleDetail({
  moduleId,
  profileId,
}: {
  moduleId: string;
  profileId: string;
}) {
  const detail = await getClientModuleDetail({ moduleId, profileId });

  if (!detail) {
    moduleServiceError("Module could not be found.");
  }

  return detail;
}

export function assertModuleTypeIsCanonical(brandModule: ModuleRecord) {
  if (!isCanonicalModuleType(brandModule.moduleType)) {
    moduleServiceError("This module type is not configured for the MVP workflow.");
  }
}

export function assertAdminModuleRole(role: string | null | undefined) {
  if (!canViewAdminModulesRole(role)) {
    moduleServiceError("You do not have permission to manage modules.");
  }
}
