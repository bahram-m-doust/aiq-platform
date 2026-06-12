import "server-only";

import { createHash } from "node:crypto";

import { headers } from "next/headers";

import { logServerError } from "@/lib/logging/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const RATE_LIMITED_MESSAGE =
  "Too many attempts. Please try again later.";

export type RateLimitBucket =
  | "auth.login"
  | "auth.register"
  | "auth.oauth"
  | "access.redeem"
  | "demo-requests.create"
  | "invitation.create"
  | "invitation.accept"
  | "file.upload"
  | "agent.activate"
  | "agent.run"
  | "brain.run"
  | "brain.image";

export type RateLimitResult = {
  allowed: boolean;
  bucket: RateLimitBucket;
  count: number;
  limit: number;
  resetAt: Date;
};

type CheckRateLimitInput = {
  bucket: RateLimitBucket;
  identifier: string;
  limit: number;
  windowSeconds: number;
  now?: Date;
};

type CheckRequestRateLimitInput = Omit<CheckRateLimitInput, "identifier"> & {
  identifiers?: Array<string | null | undefined>;
};

function normalizedLimit(value: number) {
  return Math.max(1, Math.floor(value));
}

function normalizedWindowSeconds(value: number) {
  return Math.max(1, Math.floor(value));
}

export function normalizeRateLimitPart(value: string | null | undefined) {
  const trimmed = value?.trim().toLowerCase() ?? "";
  return trimmed ? trimmed.slice(0, 256) : null;
}

export function buildRateLimitIdentifier(
  parts: Array<string | null | undefined>,
) {
  const identifier = parts
    .map(normalizeRateLimitPart)
    .filter((part): part is string => Boolean(part))
    .join("|");

  return identifier || "anonymous";
}

export function hashRateLimitIdentifier(identifier: string) {
  return createHash("sha256").update(identifier).digest("hex");
}

export function getRateLimitWindowStart(now: Date, windowSeconds: number) {
  const safeWindowSeconds = normalizedWindowSeconds(windowSeconds);
  const windowMs = safeWindowSeconds * 1000;
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

export async function getRequestRateLimitIdentity() {
  const headerList = await headers();
  // Prefer the platform-set header (not client-forgeable on Netlify), then the
  // proxy-standard x-forwarded-for/x-real-ip. Without the fallback, every
  // client on a non-Netlify host shares one "unknown" bucket and a single
  // abuser rate-limits the whole site.
  const clientIp =
    firstHeaderValue(headerList.get("x-nf-client-connection-ip")) ??
    firstHeaderValue(headerList.get("x-forwarded-for")) ??
    firstHeaderValue(headerList.get("x-real-ip")) ??
    "unknown";

  return {
    clientIp,
    userAgent: headerList.get("user-agent") ?? "unknown",
  };
}

export async function checkRateLimit({
  bucket,
  identifier,
  limit,
  windowSeconds,
  now = new Date(),
}: CheckRateLimitInput): Promise<RateLimitResult> {
  const safeLimit = normalizedLimit(limit);
  const safeWindowSeconds = normalizedWindowSeconds(windowSeconds);
  const windowStart = getRateLimitWindowStart(now, safeWindowSeconds);
  const resetAt = new Date(windowStart.getTime() + safeWindowSeconds * 1000);
  const identifierHash = hashRateLimitIdentifier(identifier);

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("increment_rate_limit", {
    p_bucket: bucket,
    p_identifier_hash: identifierHash,
    p_window_start: windowStart.toISOString(),
  });

  if (error) {
    logServerError({
      label: "[rate-limit] increment failed",
      error,
      metadata: { bucket },
    });

    return {
      allowed: false,
      bucket,
      count: safeLimit + 1,
      limit: safeLimit,
      resetAt,
    };
  }

  const count = typeof data === "number" ? data : Number(data ?? 0);
  const safeCount = Number.isFinite(count) ? count : safeLimit + 1;

  return {
    allowed: safeCount <= safeLimit,
    bucket,
    count: safeCount,
    limit: safeLimit,
    resetAt,
  };
}

export async function checkRequestRateLimit({
  identifiers = [],
  ...input
}: CheckRequestRateLimitInput) {
  const requestIdentity = await getRequestRateLimitIdentity();
  const identifier = buildRateLimitIdentifier([
    requestIdentity.clientIp,
    ...identifiers,
  ]);

  return checkRateLimit({
    ...input,
    identifier,
  });
}
