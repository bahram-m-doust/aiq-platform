import "server-only";

import { headers } from "next/headers";

const localAppOrigin = "http://localhost:3000";

function normalizeHttpOrigin(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

function configuredAppOrigin() {
  return normalizeHttpOrigin(process.env.APP_BASE_URL) ?? localAppOrigin;
}

function trustedConfiguredOrigins() {
  return Array.from(
    new Set(
      [
        configuredAppOrigin(),
        normalizeHttpOrigin(process.env.ADMIN_BASE_URL),
      ].filter((origin): origin is string => Boolean(origin)),
    ),
  );
}

export function resolveTrustedAppOrigin(
  requestOrigin: string | null | undefined,
) {
  const appOrigin = configuredAppOrigin();
  const normalizedRequestOrigin = normalizeHttpOrigin(requestOrigin);

  if (
    normalizedRequestOrigin &&
    trustedConfiguredOrigins().includes(normalizedRequestOrigin)
  ) {
    return normalizedRequestOrigin;
  }

  return appOrigin;
}

export async function getTrustedRequestOrigin() {
  const headerStore = await headers();
  return resolveTrustedAppOrigin(headerStore.get("origin"));
}
