import "server-only";

import { decryptSecret, encryptSecret } from "@/lib/crypto/encrypt";
import { logAudit } from "@/lib/audit/logAudit";
import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_PROVIDER = "OPENROUTER";

type ApiKeyRow = {
  id: string;
  brand_id: string;
  provider: string;
  encrypted_key: string;
  label: string | null;
  is_active: boolean;
};

export async function getBrandApiKey(
  brandId: string,
  provider = DEFAULT_PROVIDER,
): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("brand_api_keys")
    .select("id, brand_id, provider, encrypted_key, label, is_active")
    .eq("brand_id", brandId)
    .eq("provider", provider)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;

  const row = data as ApiKeyRow | null;
  if (!row) return null;

  return decryptSecret(row.encrypted_key);
}

export async function hasBrandApiKey(
  brandId: string,
  provider = DEFAULT_PROVIDER,
): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("brand_api_keys")
    .select("id")
    .eq("brand_id", brandId)
    .eq("provider", provider)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

export async function setBrandApiKey({
  brandId,
  apiKey,
  provider = DEFAULT_PROVIDER,
  label,
  actorId,
}: {
  brandId: string;
  apiKey: string;
  provider?: string;
  label?: string;
  actorId: string;
}): Promise<void> {
  const encrypted = encryptSecret(apiKey);
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { error } = await admin
    .from("brand_api_keys")
    .upsert(
      {
        brand_id: brandId,
        provider,
        encrypted_key: encrypted,
        label: label ?? null,
        is_active: true,
        created_by: actorId,
        updated_at: now,
      },
      { onConflict: "brand_id, provider" },
    );

  if (error) throw error;

  await logAudit({
    actorUserId: actorId,
    brandId,
    action: "admin_override_used",
    entityType: "brand_api_key",
    after: { provider, label: label ?? null, action: "set" },
  });
}

export async function deleteBrandApiKey({
  brandId,
  provider = DEFAULT_PROVIDER,
  actorId,
}: {
  brandId: string;
  provider?: string;
  actorId: string;
}): Promise<void> {
  const admin = createAdminClient();

  const { error } = await admin
    .from("brand_api_keys")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("brand_id", brandId)
    .eq("provider", provider);

  if (error) throw error;

  await logAudit({
    actorUserId: actorId,
    brandId,
    action: "admin_override_used",
    entityType: "brand_api_key",
    after: { provider, action: "delete" },
  });
}
