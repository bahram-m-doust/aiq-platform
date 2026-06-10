import {
  createCipheriv,
  randomBytes,
} from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import {
  decryptSecret,
  decryptSecretWithMetadata,
  encryptSecret,
} from "@/lib/crypto/encrypt";

const originalEnv = {
  KEY_ENCRYPTION_KEY: process.env.KEY_ENCRYPTION_KEY,
  KEY_ENCRYPTION_KEYS: process.env.KEY_ENCRYPTION_KEYS,
  KEY_ENCRYPTION_ACTIVE_KEY_ID: process.env.KEY_ENCRYPTION_ACTIVE_KEY_ID,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

function restoreEnv() {
  for (const [name, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

afterEach(restoreEnv);

describe("secret encryption", () => {
  it("uses a versioned independent AES-256-GCM key", () => {
    process.env.KEY_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    process.env.KEY_ENCRYPTION_ACTIVE_KEY_ID = "primary";

    const encrypted = encryptSecret("provider-secret");

    expect(encrypted).toMatch(/^enc:v1:primary:/);
    expect(encrypted).not.toContain("provider-secret");
    expect(decryptSecret(encrypted)).toBe("provider-secret");
  });

  it("supports key rotation through a versioned keyring", () => {
    const oldKey = randomBytes(32).toString("base64");
    const newKey = randomBytes(32).toString("base64");
    process.env.KEY_ENCRYPTION_KEYS = JSON.stringify({ old: oldKey, next: newKey });
    process.env.KEY_ENCRYPTION_ACTIVE_KEY_ID = "old";
    const encrypted = encryptSecret("rotatable-secret");

    process.env.KEY_ENCRYPTION_ACTIVE_KEY_ID = "next";
    expect(decryptSecret(encrypted)).toBe("rotatable-secret");
    expect(encryptSecret("new-secret")).toMatch(/^enc:v1:next:/);
  });

  it("can read legacy ciphertext only for one-time re-encryption", () => {
    process.env.KEY_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    process.env.SUPABASE_SERVICE_ROLE_KEY = "legacy-service-role-key";
    const legacyKey = Buffer.from(
      process.env.SUPABASE_SERVICE_ROLE_KEY.slice(0, 32).padEnd(32, "0"),
    );
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", legacyKey, iv);
    const encrypted = Buffer.concat([
      cipher.update("legacy-secret", "utf8"),
      cipher.final(),
    ]);
    const legacyCiphertext = [
      iv.toString("base64"),
      cipher.getAuthTag().toString("base64"),
      encrypted.toString("base64"),
    ].join(":");

    expect(decryptSecretWithMetadata(legacyCiphertext)).toEqual({
      plaintext: "legacy-secret",
      needsReencryption: true,
    });
  });
});
