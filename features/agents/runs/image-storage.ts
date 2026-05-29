import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export const agentImagesBucket = "agent-images";
export const agentImageSignedUrlTtlSeconds = 60 * 30;

export async function uploadAgentImagePng({
  storagePath,
  pngBytes,
}: {
  storagePath: string;
  pngBytes: Buffer;
}) {
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(agentImagesBucket)
    .upload(storagePath, pngBytes, {
      cacheControl: "3600",
      contentType: "image/png",
      upsert: false,
    });
  if (error) throw error;
}

export async function createAgentImageSignedUrl(storagePath: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(agentImagesBucket)
    .createSignedUrl(storagePath, agentImageSignedUrlTtlSeconds);
  if (error) throw error;
  return data.signedUrl;
}

export async function createAgentImageSignedUrls(storagePaths: string[]) {
  return Promise.all(storagePaths.map(createAgentImageSignedUrl));
}
