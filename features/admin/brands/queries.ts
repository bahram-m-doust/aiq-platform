import "server-only";

import { getBrainBuildSchedulesForBrands } from "@/features/admin/brain-build/queries";
import type {
  AdminBrandMember,
  AdminBrandSummary,
  AdminBrandsPage,
} from "@/features/admin/brands/types";
import {
  type PaginationInput,
  paginatedRows,
  toSupabaseRange,
} from "@/lib/pagination";
import { createAdminClient } from "@/lib/supabase/admin";

type BrandRow = {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  status: string;
  created_at: string | null;
};

type MembershipRow = {
  id: string;
  brand_id: string;
  user_id: string;
  role: string;
  status: string;
  created_at: string | null;
};

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
};

export async function getAdminBrandsWithMembers(
  paginationInput?: PaginationInput,
): Promise<AdminBrandsPage> {
  const admin = createAdminClient();
  const range = toSupabaseRange(paginationInput);

  const { data, error } = await admin
    .from("brands")
    .select("id, name, industry, website, status, created_at")
    .order("created_at", { ascending: false })
    .range(range.from, range.to + 1);

  if (error) {
    throw error;
  }

  const paginated = paginatedRows((data ?? []) as BrandRow[], range);
  const brands = paginated.rows;

  if (brands.length === 0) {
    return { brands: [], pagination: paginated.pagination };
  }

  const brandIds = brands.map((brand) => brand.id);

  const { data: membershipData, error: membershipError } = await admin
    .from("brand_memberships")
    .select("id, brand_id, user_id, role, status, created_at")
    .in("brand_id", brandIds)
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: true });

  if (membershipError) {
    throw membershipError;
  }

  const brainBuildByBrand = await getBrainBuildSchedulesForBrands(brandIds);

  const memberships = (membershipData ?? []) as MembershipRow[];
  const userIds = Array.from(new Set(memberships.map((row) => row.user_id)));

  const profiles = new Map<string, ProfileRow>();
  if (userIds.length > 0) {
    const { data: profileData, error: profileError } = await admin
      .from("users_profile")
      .select("id, email, full_name")
      .in("id", userIds);

    if (profileError) {
      throw profileError;
    }

    for (const profile of (profileData ?? []) as ProfileRow[]) {
      profiles.set(profile.id, profile);
    }
  }

  const membersByBrand = new Map<string, AdminBrandMember[]>();
  for (const membership of memberships) {
    const profile = profiles.get(membership.user_id);
    const member: AdminBrandMember = {
      membershipId: membership.id,
      userId: membership.user_id,
      email: profile?.email ?? "Unknown user",
      fullName: profile?.full_name ?? null,
      role: membership.role,
      status: membership.status,
      createdAt: membership.created_at,
    };
    const existing = membersByBrand.get(membership.brand_id);
    if (existing) {
      existing.push(member);
    } else {
      membersByBrand.set(membership.brand_id, [member]);
    }
  }

  return {
    brands: brands.map((brand): AdminBrandSummary => {
      const members = membersByBrand.get(brand.id) ?? [];
      return {
        id: brand.id,
        name: brand.name,
        industry: brand.industry,
        website: brand.website,
        status: brand.status,
        createdAt: brand.created_at,
        members,
        memberCount: members.length,
        ownerCount: members.filter((member) => member.role === "OWNER").length,
        brainBuild: brainBuildByBrand.get(brand.id) ?? null,
      };
    }),
    pagination: paginated.pagination,
  };
}
