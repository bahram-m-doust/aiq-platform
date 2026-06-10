import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type RedeemedBrandMembershipRole = "OWNER" | "BRAND_SPECIALIST";

export type RedeemedBrandMembershipActivation = {
  brand: {
    id: string;
    name: string;
    status: string;
  };
  membership: {
    id: string;
    brandId: string;
    userId: string;
    role: RedeemedBrandMembershipRole;
    status: "ACTIVE";
    invitedBy: string | null;
  };
};

type ActivationRow = {
  brand_id: string;
  brand_name: string;
  brand_status: string;
  membership_id: string;
  membership_user_id: string;
  membership_role: string;
  membership_status: string;
  membership_invited_by: string | null;
};

export async function activateRedeemedBrandMembership({
  accessKeyId,
  userId,
}: {
  accessKeyId: string;
  userId: string;
}): Promise<RedeemedBrandMembershipActivation> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .rpc("activate_redeemed_brand_membership_atomic", {
      p_access_key_id: accessKeyId,
      p_user_id: userId,
    })
    .single();

  if (error) throw error;

  const row = data as unknown as ActivationRow;
  if (
    !["OWNER", "BRAND_SPECIALIST"].includes(row.membership_role) ||
    row.membership_status !== "ACTIVE"
  ) {
    throw new Error("Unexpected redeemed brand membership state.");
  }

  return {
    brand: {
      id: row.brand_id,
      name: row.brand_name,
      status: row.brand_status,
    },
    membership: {
      id: row.membership_id,
      brandId: row.brand_id,
      userId: row.membership_user_id,
      role: row.membership_role as RedeemedBrandMembershipRole,
      status: row.membership_status,
      invitedBy: row.membership_invited_by,
    },
  };
}
