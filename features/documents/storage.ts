import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export const privateFilesBucket = "bextudio-files";
// Signed URLs are embedded into server-rendered pages (download buttons, PDF
// preview iframes). A 60s TTL broke them for anyone reading for over a minute;
// one hour comfortably covers a review session while staying short-lived.
export const signedDownloadUrlTtlSeconds = 60 * 60;

// Bound how long a storage read can tie up a request. supabase-js's storage
// client exposes no per-call AbortSignal, so we race the download against a
// timer — this caps the handler's wait (the underlying socket closes on its
// own) rather than letting a slow/hung storage backend hold the request open.
const downloadTimeoutMs = 30_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

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
  const { data, error } = await withTimeout(
    admin.storage.from(privateFilesBucket).download(storagePath),
    downloadTimeoutMs,
    "Private file download",
  );

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
