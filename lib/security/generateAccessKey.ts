import "server-only";

import { randomBytes } from "node:crypto";

import { hashAccessKey } from "@/lib/security/hashAccessKey";

const ACCESS_KEY_PREFIX = "bext_";
const ACCESS_KEY_RANDOM_BYTES = 32;
const ACCESS_KEY_DISPLAY_PREFIX_LENGTH = 16;

export type GeneratedAccessKey = {
  rawKey: string;
  keyPrefix: string;
  keyHash: string;
};

export function generateAccessKey(): GeneratedAccessKey {
  const rawKey = `${ACCESS_KEY_PREFIX}${randomBytes(ACCESS_KEY_RANDOM_BYTES).toString("base64url")}`;

  return {
    rawKey,
    keyPrefix: rawKey.slice(0, ACCESS_KEY_DISPLAY_PREFIX_LENGTH),
    keyHash: hashAccessKey(rawKey),
  };
}
