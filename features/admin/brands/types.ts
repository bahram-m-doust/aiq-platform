import type { BrainBuildSchedule } from "@/features/admin/brain-build/types";
import type { PaginationState } from "@/lib/pagination";

// Brand membership roles, ordered from least to most senior. Promote walks up
// this ladder, demote walks down it.
export const brandRoleLadder = [
  "BRAND_SPECIALIST",
  "EXECUTIVE_MANAGER",
  "OWNER",
] as const;

export type BrandMembershipRole = (typeof brandRoleLadder)[number];

const brandRoleLabels: Record<BrandMembershipRole, string> = {
  OWNER: "Owner",
  EXECUTIVE_MANAGER: "Executive Manager",
  BRAND_SPECIALIST: "Brand Specialist",
};

export function isBrandMembershipRole(
  value: string,
): value is BrandMembershipRole {
  return (brandRoleLadder as readonly string[]).includes(value);
}

export function brandRoleLabel(role: string): string {
  return isBrandMembershipRole(role) ? brandRoleLabels[role] : role;
}

// The next role up the ladder (promotion), or null when already at the top.
export function promoteRole(role: string): BrandMembershipRole | null {
  if (!isBrandMembershipRole(role)) return null;
  const index = brandRoleLadder.indexOf(role);
  return index >= 0 && index < brandRoleLadder.length - 1
    ? brandRoleLadder[index + 1]
    : null;
}

// The next role down the ladder (demotion), or null when already at the bottom.
export function demoteRole(role: string): BrandMembershipRole | null {
  if (!isBrandMembershipRole(role)) return null;
  const index = brandRoleLadder.indexOf(role);
  return index > 0 ? brandRoleLadder[index - 1] : null;
}

export type AdminBrandMember = {
  membershipId: string;
  userId: string;
  email: string;
  fullName: string | null;
  role: string;
  status: string;
  createdAt: string | null;
};

export type AdminBrandSummary = {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  status: string;
  createdAt: string | null;
  memberCount: number;
  ownerCount: number;
  members: AdminBrandMember[];
  brainBuild: BrainBuildSchedule | null;
};

export type AdminBrandsPage = {
  brands: AdminBrandSummary[];
  pagination: PaginationState;
};

export type BrandAdminActionState =
  | { status: "idle"; message: string }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

export const initialBrandAdminActionState: BrandAdminActionState = {
  status: "idle",
  message: "",
};
