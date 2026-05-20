import "server-only";

import { createHash } from "node:crypto";

export function normalizeAccessKey(rawKey: string) {
  return rawKey.trim();
}

export function hashAccessKey(rawKey: string) {
  return createHash("sha256").update(normalizeAccessKey(rawKey)).digest("hex");
}
