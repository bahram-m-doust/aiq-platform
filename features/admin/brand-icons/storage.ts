import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export const brandIconsBucket = "brand-icons";

export async function uploadBrandIcon({
  storagePath,
  file,
}: {
  storagePath: string;
  file: File;
}) {
  const admin = createAdminClient();
  const body = await file.arrayBuffer();
  const { error } = await admin.storage
    .from(brandIconsBucket)
    .upload(storagePath, body, {
      cacheControl: "3600",
      contentType: "image/png",
      upsert: true,
    });

  if (error) {
    throw error;
  }
}

export async function removeBrandIcon(storagePath: string) {
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(brandIconsBucket)
    .remove([storagePath]);

  if (error) {
    throw error;
  }
}

export function brandIconPublicUrl(iconPath: string | null) {
  if (!iconPath) return null;
  const admin = createAdminClient();
  const { data } = admin.storage.from(brandIconsBucket).getPublicUrl(iconPath);
  return data.publicUrl;
}
