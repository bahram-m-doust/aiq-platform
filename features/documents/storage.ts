import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export const privateFilesBucket = "bextudio-files";
export const signedDownloadUrlTtlSeconds = 60;

export async function uploadPrivateFile({
  storagePath,
  file,
  mimeType,
}: {
  storagePath: string;
  file: File;
  mimeType: string | null;
}) {
  const admin = createAdminClient();
  const body = await file.arrayBuffer();
  const { error } = await admin.storage
    .from(privateFilesBucket)
    .upload(storagePath, body, {
      cacheControl: "3600",
      contentType: mimeType ?? "application/octet-stream",
      upsert: false,
    });

  if (error) {
    throw error;
  }
}

export async function removePrivateFile(storagePath: string) {
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(privateFilesBucket)
    .remove([storagePath]);
  if (error) {
    throw error;
  }
}

export async function downloadPrivateFile(storagePath: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(privateFilesBucket)
    .download(storagePath);

  if (error || !data) {
    throw error ?? new Error("Private file could not be downloaded.");
  }

  return data;
}

export async function createPrivateFileSignedDownloadUrl({
  storagePath,
  downloadName,
}: {
  storagePath: string;
  downloadName: string;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(privateFilesBucket)
    .createSignedUrl(storagePath, signedDownloadUrlTtlSeconds, {
      download: downloadName,
    });

  if (error || !data?.signedUrl) {
    throw error ?? new Error("Signed download URL could not be created.");
  }

  return data.signedUrl;
}

// Signed URL WITHOUT a `download` disposition, so the browser renders the file
// inline (e.g. a PDF preview in an iframe) instead of forcing a download.
export async function createPrivateFileSignedInlineUrl({
  storagePath,
}: {
  storagePath: string;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(privateFilesBucket)
    .createSignedUrl(storagePath, signedDownloadUrlTtlSeconds);

  if (error || !data?.signedUrl) {
    throw error ?? new Error("Signed inline URL could not be created.");
  }

  return data.signedUrl;
}
