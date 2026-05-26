import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { readTrimmedRuntimeEnv } from "@/lib/env/runtime";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getEncryptionKey(): Buffer {
  const raw = readTrimmedRuntimeEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!raw) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for encryption.");
  }
  return Buffer.from(raw.slice(0, 32).padEnd(32, "0"));
}

export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

export function decryptSecret(ciphertext: string): string {
  const key = getEncryptionKey();
  const [ivB64, authTagB64, encryptedB64] = ciphertext.split(":");

  if (!ivB64 || !authTagB64 || !encryptedB64) {
    throw new Error("Invalid encrypted secret format.");
  }

  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const encrypted = Buffer.from(encryptedB64, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");
}
