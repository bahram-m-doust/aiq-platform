import "server-only";

import {
  decryptSecretWithMetadata,
  encryptSecret,
} from "@/lib/crypto/encrypt";
import { logAudit } from "@/lib/audit/logAudit";
import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_PROVIDER = "OPENROUTER";
export const OPENAI_PROVIDER = "OPENAI";

type ApiKeyRow = {
  id: string;
  brand_id: string | null;
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

  const decrypted = decryptSecretWithMetadata(row.encrypted_key);
  if (decrypted.needsReencryption) {
    const { error: migrationError } = await admin
      .from("brand_api_keys")
      .update({
        encrypted_key: encryptSecret(decrypted.plaintext),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("encrypted_key", row.encrypted_key);
    if (migrationError) throw migrationError;
  }

  return decrypted.plaintext;
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

async function decryptApiKeyRow(row: ApiKeyRow): Promise<string> {
  const decrypted = decryptSecretWithMetadata(row.encrypted_key);

  if (decrypted.needsReencryption) {
    const admin = createAdminClient();
    const { error } = await admin
      .from("brand_api_keys")
      .update({
        encrypted_key: encryptSecret(decrypted.plaintext),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("encrypted_key", row.encrypted_key);

    if (error) throw error;
  }

  return decrypted.plaintext;
}

export async function getGlobalProviderApiKey(
  provider: string,
): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("brand_api_keys")
    .select("id, brand_id, provider, encrypted_key, label, is_active")
    .is("brand_id", null)
    .eq("provider", provider)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;

  const row = data as ApiKeyRow | null;
  return row ? decryptApiKeyRow(row) : null;
}

export async function hasGlobalProviderApiKey(
  provider: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("brand_api_keys")
    .select("id")
    .is("brand_id", null)
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

export async function setGlobalProviderApiKey({
  apiKey,
  provider,
  label,
  actorId,
}: {
  apiKey: string;
  provider: string;
  label?: string;
  actorId: string;
}): Promise<void> {
  const encrypted = encryptSecret(apiKey);
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: existing, error: existingError } = await admin
    .from("brand_api_keys")
    .select("id")
    .is("brand_id", null)
    .eq("provider", provider)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing && typeof existing.id === "string") {
    const { error } = await admin
      .from("brand_api_keys")
      .update({
        encrypted_key: encrypted,
        label: label ?? null,
        is_active: true,
        created_by: actorId,
        updated_at: now,
      })
      .eq("id", existing.id);

    if (error) throw error;
  } else {
    const { error } = await admin.from("brand_api_keys").insert({
      brand_id: null,
      provider,
      encrypted_key: encrypted,
      label: label ?? null,
      is_active: true,
      created_by: actorId,
      updated_at: now,
    });

    if (error) throw error;
  }

  await logAudit({
    actorUserId: actorId,
    brandId: null,
    action: "admin_override_used",
    entityType: "provider_api_key",
    after: { provider, label: label ?? null, scope: "global", action: "set" },
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

export async function deleteGlobalProviderApiKey({
  provider,
  actorId,
}: {
  provider: string;
  actorId: string;
}): Promise<void> {
  const admin = createAdminClient();

  const { error } = await admin
    .from("brand_api_keys")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .is("brand_id", null)
    .eq("provider", provider);

  if (error) throw error;

  await logAudit({
    actorUserId: actorId,
    brandId: null,
    action: "admin_override_used",
    entityType: "provider_api_key",
    after: { provider, scope: "global", action: "delete" },
  });
}
