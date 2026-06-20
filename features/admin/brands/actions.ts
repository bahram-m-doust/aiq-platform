"use server";

import { revalidatePath } from "next/cache";

import { requirePlatformOwner } from "@/features/auth/queries";
import { normalizeWebsite } from "@/features/brands/create-brand/schema";
import {
  type BrandAdminActionState,
  demoteRole,
  isBrandMembershipRole,
  brandRoleLabel,
  promoteRole,
} from "@/features/admin/brands/types";
import { logAudit } from "@/lib/audit/logAudit";
import { logServerError } from "@/lib/logging/server";
import { createAdminClient } from "@/lib/supabase/admin";

function errorState(message: string): BrandAdminActionState {
  return { status: "error", message };
}

function successState(message: string): BrandAdminActionState {
  return { status: "success", message };
}

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

// Count the brand's remaining active owners. Used to block actions that would
// leave a brand with nobody able to manage it (an orphaned workspace).
async function countActiveOwners(
  admin: ReturnType<typeof createAdminClient>,
  brandId: string,
): Promise<number> {
  const { count, error } = await admin
    .from("brand_memberships")
    .select("id", { count: "exact", head: true })
    .eq("brand_id", brandId)
    .eq("role", "OWNER")
    .eq("status", "ACTIVE");
  if (error) throw error;
  return count ?? 0;
}

export async function createBrandAction(
  _previousState: BrandAdminActionState,
  formData: FormData,
): Promise<BrandAdminActionState> {
  const { profile } = await requirePlatformOwner("/admin/brands");

  const name = formString(formData, "brand_name");
  const industry = formString(formData, "industry");
  const websiteInput = formString(formData, "website");
  const ownerEmail = formString(formData, "owner_email").toLowerCase();

  if (!name) {
    return errorState("Enter the brand name.");
  }
  if (name.length > 120) {
    return errorState("Brand name must be 120 characters or fewer.");
  }

  let website: string | null = null;
  if (websiteInput) {
    website = normalizeWebsite(websiteInput);
    if (!website) {
      return errorState("Website must be a valid http or https URL.");
    }
  }

  const admin = createAdminClient();

  try {
    // Optional owner: only attach a membership when the email matches an
    // existing profile, otherwise create the brand and report it back so the
    // owner can be assigned later.
    let ownerProfileId: string | null = null;
    let ownerLookupMissed = false;
    if (ownerEmail) {
      const { data: ownerProfile, error: ownerError } = await admin
        .from("users_profile")
        .select("id")
        .eq("email", ownerEmail)
        .maybeSingle();
      if (ownerError) throw ownerError;
      if (ownerProfile) {
        ownerProfileId = (ownerProfile as { id: string }).id;
      } else {
        ownerLookupMissed = true;
      }
    }

    const { data: brandData, error: brandError } = await admin
      .from("brands")
      .insert({
        name,
        industry: industry || null,
        website,
        status: "CREATED",
        created_by: profile.id,
      })
      .select("id, name")
      .single();
    if (brandError) throw brandError;

    const brand = brandData as { id: string; name: string };

    // Every brand gets a draft intake session so the questionnaire flow has a
    // session to attach answers to (mirrors the create-brand RPC).
    const { error: sessionError } = await admin.from("intake_sessions").insert({
      brand_id: brand.id,
      status: "DRAFT",
      completion_percent: 0,
    });
    if (sessionError) {
      logServerError({
        label: "[admin-brands] intake session create failed",
        error: sessionError,
        metadata: { brandId: brand.id },
      });
    }

    if (ownerProfileId) {
      const { error: membershipError } = await admin
        .from("brand_memberships")
        .insert({
          brand_id: brand.id,
          user_id: ownerProfileId,
          role: "OWNER",
          status: "ACTIVE",
          invited_by: profile.id,
        });
      if (membershipError) {
        logServerError({
          label: "[admin-brands] owner membership create failed",
          error: membershipError,
          metadata: { brandId: brand.id },
        });
        ownerLookupMissed = true;
        ownerProfileId = null;
      }
    }

    await logAudit({
      actorUserId: profile.id,
      actorRole: profile.global_role,
      brandId: brand.id,
      action: "brand_created",
      entityType: "brand",
      entityId: brand.id,
      before: null,
      after: {
        brand: { id: brand.id, name: brand.name, status: "CREATED" },
        created_via: "admin_console",
        owner_user_id: ownerProfileId,
      },
    });

    revalidatePath("/admin/brands");

    if (ownerEmail && ownerLookupMissed) {
      return successState(
        `Brand "${brand.name}" created. No user found for ${ownerEmail} — assign an owner once they register.`,
      );
    }
    if (ownerProfileId) {
      return successState(
        `Brand "${brand.name}" created with ${ownerEmail} as owner.`,
      );
    }
    return successState(`Brand "${brand.name}" created.`);
  } catch (error) {
    logServerError({
      label: "[admin-brands] create failed",
      error,
      metadata: { actor: profile.id },
    });
    return errorState("Brand could not be created.");
  }
}

export async function changeBrandMemberRoleAction(
  _previousState: BrandAdminActionState,
  formData: FormData,
): Promise<BrandAdminActionState> {
  const { profile } = await requirePlatformOwner("/admin/brands");

  const membershipId = formString(formData, "membership_id");
  const brandId = formString(formData, "brand_id");
  const direction = formString(formData, "direction");

  if (!membershipId || !brandId) {
    return errorState("Member reference is missing.");
  }
  if (direction !== "promote" && direction !== "demote") {
    return errorState("Choose a valid role change.");
  }

  const admin = createAdminClient();

  try {
    const { data: membershipData, error: membershipError } = await admin
      .from("brand_memberships")
      .select("id, brand_id, user_id, role, status")
      .eq("id", membershipId)
      .eq("brand_id", brandId)
      .maybeSingle();
    if (membershipError) throw membershipError;

    const membership = membershipData as
      | { id: string; brand_id: string; user_id: string; role: string }
      | null;
    if (!membership) {
      return errorState("Membership could not be found.");
    }

    if (!isBrandMembershipRole(membership.role)) {
      return errorState(
        `This member has an unrecognized role (${membership.role}) and can't be changed here.`,
      );
    }

    const targetRole =
      direction === "promote"
        ? promoteRole(membership.role)
        : demoteRole(membership.role);

    if (!targetRole) {
      return errorState(
        direction === "promote"
          ? "This member is already at the highest role."
          : "This member is already at the lowest role.",
      );
    }

    // Never demote the last owner — it would leave the brand unmanageable.
    if (direction === "demote" && membership.role === "OWNER") {
      const owners = await countActiveOwners(admin, brandId);
      if (owners <= 1) {
        return errorState(
          "Can't demote the only owner. Promote another member to owner first.",
        );
      }
    }

    const { error: updateError } = await admin
      .from("brand_memberships")
      .update({ role: targetRole })
      .eq("id", membershipId)
      .eq("brand_id", brandId);

    if (updateError) {
      if ((updateError as { code?: string }).code === "23505") {
        return errorState("This user already holds the target role.");
      }
      throw updateError;
    }

    await logAudit({
      actorUserId: profile.id,
      actorRole: profile.global_role,
      brandId,
      action: "brand_member_role_changed",
      entityType: "brand_membership",
      entityId: membershipId,
      before: { role: membership.role, user_id: membership.user_id },
      after: { role: targetRole, direction },
    });

    revalidatePath("/admin/brands");
    return successState(
      `Role updated to ${brandRoleLabel(targetRole)}.`,
    );
  } catch (error) {
    logServerError({
      label: "[admin-brands] role change failed",
      error,
      metadata: { membershipId, brandId, direction },
    });
    return errorState("Role could not be updated.");
  }
}

export async function removeBrandMemberAction(
  _previousState: BrandAdminActionState,
  formData: FormData,
): Promise<BrandAdminActionState> {
  const { profile } = await requirePlatformOwner("/admin/brands");

  const membershipId = formString(formData, "membership_id");
  const brandId = formString(formData, "brand_id");

  if (!membershipId || !brandId) {
    return errorState("Member reference is missing.");
  }

  const admin = createAdminClient();

  try {
    const { data: membershipData, error: membershipError } = await admin
      .from("brand_memberships")
      .select("id, brand_id, user_id, role")
      .eq("id", membershipId)
      .eq("brand_id", brandId)
      .maybeSingle();
    if (membershipError) throw membershipError;

    const membership = membershipData as
      | { id: string; user_id: string; role: string }
      | null;
    if (!membership) {
      return errorState("Membership could not be found.");
    }

    // Removing the last owner would orphan the brand.
    if (membership.role === "OWNER") {
      const owners = await countActiveOwners(admin, brandId);
      if (owners <= 1) {
        return errorState(
          "Can't remove the only owner. Promote another member first, or delete the brand.",
        );
      }
    }

    const { error: deleteError } = await admin
      .from("brand_memberships")
      .delete()
      .eq("id", membershipId)
      .eq("brand_id", brandId);
    if (deleteError) throw deleteError;

    await logAudit({
      actorUserId: profile.id,
      actorRole: profile.global_role,
      brandId,
      action: "brand_member_removed",
      entityType: "brand_membership",
      entityId: membershipId,
      before: { role: membership.role, user_id: membership.user_id },
      after: null,
    });

    revalidatePath("/admin/brands");
    return successState("Member removed from the brand.");
  } catch (error) {
    logServerError({
      label: "[admin-brands] member remove failed",
      error,
      metadata: { membershipId, brandId },
    });
    return errorState("Member could not be removed.");
  }
}

export async function deleteBrandAction(
  _previousState: BrandAdminActionState,
  formData: FormData,
): Promise<BrandAdminActionState> {
  const { profile } = await requirePlatformOwner("/admin/brands");

  const brandId = formString(formData, "brand_id");
  const confirmName = formString(formData, "confirm_name");

  if (!brandId) {
    return errorState("Brand reference is missing.");
  }

  const admin = createAdminClient();

  try {
    const { data: brandData, error: brandError } = await admin
      .from("brands")
      .select("id, name")
      .eq("id", brandId)
      .maybeSingle();
    if (brandError) throw brandError;

    const brand = brandData as { id: string; name: string } | null;
    if (!brand) {
      return errorState("Brand could not be found.");
    }

    // Type-to-confirm: the typed name must match exactly. Guards against
    // deleting the wrong brand from a long list.
    if (confirmName !== brand.name) {
      return errorState("The typed brand name does not match.");
    }

    // Most brand-scoped tables cascade from brands. The exceptions that lack ON
    // DELETE CASCADE must be cleared first, in this order:
    //   1. audit_logs.brand_id  -> detach (keep the history, drop the link)
    //   2. intake_snapshots     -> delete (also FK intake_sessions w/o cascade)
    //   3. access_keys          -> delete (target_brand_id has no cascade)
    // then deleting the brand cascades everything else.
    const { error: auditDetachError } = await admin
      .from("audit_logs")
      .update({ brand_id: null })
      .eq("brand_id", brandId);
    if (auditDetachError) throw auditDetachError;

    const { error: snapshotError } = await admin
      .from("intake_snapshots")
      .delete()
      .eq("brand_id", brandId);
    if (snapshotError) throw snapshotError;

    const { error: accessKeyError } = await admin
      .from("access_keys")
      .delete()
      .eq("target_brand_id", brandId);
    if (accessKeyError) throw accessKeyError;

    const { error: deleteError } = await admin
      .from("brands")
      .delete()
      .eq("id", brandId);
    if (deleteError) throw deleteError;

    // The brand row is gone, so this audit entry can't reference brand_id (FK).
    // Record the id in entity_id / after_json instead.
    await logAudit({
      actorUserId: profile.id,
      actorRole: profile.global_role,
      brandId: null,
      action: "brand_deleted",
      entityType: "brand",
      entityId: brandId,
      before: { id: brandId, name: brand.name },
      after: { deleted_via: "admin_console" },
    });

    revalidatePath("/admin/brands");
    return successState(`Brand "${brand.name}" was permanently deleted.`);
  } catch (error) {
    logServerError({
      label: "[admin-brands] delete failed",
      error,
      metadata: { brandId, actor: profile.id },
    });
    return errorState("Brand could not be deleted.");
  }
}
