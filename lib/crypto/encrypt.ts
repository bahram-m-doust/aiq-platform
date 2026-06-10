import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

import { readTrimmedRuntimeEnv } from "@/lib/env/runtime";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const FORMAT_PREFIX = "enc:v1";

type Keyring = {
  activeKeyId: string;
  keys: Map<string, Buffer>;
};

function decodeKey(value: string, keyId: string): Buffer {
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) {
    throw new Error(
      `Encryption key ${keyId} must be a base64-encoded 32-byte value.`,
    );
  }
  return key;
}

function getKeyring(): Keyring {
  const serializedKeys = readTrimmedRuntimeEnv("KEY_ENCRYPTION_KEYS");
  const singleKey = readTrimmedRuntimeEnv("KEY_ENCRYPTION_KEY");
  const activeKeyId =
    readTrimmedRuntimeEnv("KEY_ENCRYPTION_ACTIVE_KEY_ID") || "v1";
  const keys = new Map<string, Buffer>();

  if (serializedKeys) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(serializedKeys);
    } catch {
      throw new Error("KEY_ENCRYPTION_KEYS must be a JSON object.");
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("KEY_ENCRYPTION_KEYS must be a JSON object.");
    }

    for (const [keyId, value] of Object.entries(parsed)) {
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(keyId) || typeof value !== "string") {
        throw new Error("KEY_ENCRYPTION_KEYS contains an invalid key entry.");
      }
      keys.set(keyId, decodeKey(value, keyId));
    }
  } else if (singleKey) {
    keys.set(activeKeyId, decodeKey(singleKey, activeKeyId));
  }

  if (!keys.has(activeKeyId)) {
    throw new Error(
      "KEY_ENCRYPTION_KEY or KEY_ENCRYPTION_KEYS must contain the active key.",
    );
  }

  return { activeKeyId, keys };
}

function additionalData(keyId: string): Buffer {
  return Buffer.from(`bextudio:brand-api-key:${keyId}`, "utf8");
}

function decryptLegacySecret(ciphertext: string): string {
  const raw = readTrimmedRuntimeEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!raw) {
    throw new Error("Legacy encrypted secret requires the service role key.");
  }

  const [ivB64, authTagB64, encryptedB64] = ciphertext.split(":");
  if (!ivB64 || !authTagB64 || !encryptedB64) {
    throw new Error("Invalid encrypted secret format.");
  }

  const legacyKey = Buffer.from(raw.slice(0, 32).padEnd(32, "0"));
  const decipher = createDecipheriv(
    ALGORITHM,
    legacyKey,
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function encryptSecret(plaintext: string): string {
  const { activeKeyId, keys } = getKeyring();
  const key = keys.get(activeKeyId);
  if (!key) throw new Error("Active encryption key is unavailable.");

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(additionalData(activeKeyId));
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return [
    FORMAT_PREFIX,
    activeKeyId,
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

export function decryptSecretWithMetadata(ciphertext: string): {
  plaintext: string;
  needsReencryption: boolean;
} {
  if (!ciphertext.startsWith(`${FORMAT_PREFIX}:`)) {
    return {
      plaintext: decryptLegacySecret(ciphertext),
      needsReencryption: true,
    };
  }

  const [prefix, version, keyId, ivB64, authTagB64, encryptedB64] =
    ciphertext.split(":");
  if (
    prefix !== "enc" ||
    version !== "v1" ||
    !keyId ||
    !ivB64 ||
    !authTagB64 ||
    !encryptedB64
  ) {
    throw new Error("Invalid encrypted secret format.");
  }

  const { keys } = getKeyring();
  const key = keys.get(keyId);
  if (!key) {
    throw new Error(`Encryption key ${keyId} is unavailable.`);
  }

  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  if (iv.length !== IV_LENGTH || authTag.length !== 16) {
    throw new Error("Invalid encrypted secret parameters.");
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAAD(additionalData(keyId));
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encryptedB64, "base64")),
    decipher.final(),
  ]).toString("utf8");

  return { plaintext, needsReencryption: false };
}

export function decryptSecret(ciphertext: string): string {
  return decryptSecretWithMetadata(ciphertext).plaintext;
}
