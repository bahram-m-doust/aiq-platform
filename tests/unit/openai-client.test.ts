import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("openai", () => ({
  default: vi.fn(function OpenAIMock(options: unknown) {
    return { options };
  }),
}));

vi.mock("@/features/brands/api-keys", () => ({
  getGlobalProviderApiKey: vi.fn(),
  hasGlobalProviderApiKey: vi.fn(),
  OPENAI_PROVIDER: "OPENAI",
}));

import OpenAI from "openai";

import {
  getGlobalProviderApiKey,
  hasGlobalProviderApiKey,
} from "@/features/brands/api-keys";
import {
  clearOpenAIClientCache,
  getOpenAIClient,
  hasOpenAIKey,
} from "@/lib/openai/client";

const mockedOpenAI = vi.mocked(OpenAI);
const mockedGetGlobalProviderApiKey = vi.mocked(getGlobalProviderApiKey);
const mockedHasGlobalProviderApiKey = vi.mocked(hasGlobalProviderApiKey);

const originalOpenAIEnv = process.env.OPENAI_API_KEY;

describe("OpenAI client configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearOpenAIClientCache();
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    clearOpenAIClientCache();
    if (originalOpenAIEnv === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalOpenAIEnv;
    }
  });

  it("uses the encrypted Admin-stored OpenAI key before env fallback", async () => {
    process.env.OPENAI_API_KEY = "sk-env-key";
    mockedGetGlobalProviderApiKey.mockResolvedValue("sk-db-key");

    await getOpenAIClient();

    expect(mockedOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "sk-db-key" }),
    );
  });

  it("falls back to OPENAI_API_KEY when no Admin key is stored", async () => {
    process.env.OPENAI_API_KEY = "sk-env-key";
    mockedGetGlobalProviderApiKey.mockResolvedValue(null);

    await getOpenAIClient();

    expect(mockedOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "sk-env-key" }),
    );
  });

  it("reports configured when either DB or env key exists", async () => {
    mockedHasGlobalProviderApiKey.mockResolvedValueOnce(true);
    await expect(hasOpenAIKey()).resolves.toBe(true);

    mockedHasGlobalProviderApiKey.mockResolvedValueOnce(false);
    process.env.OPENAI_API_KEY = "sk-env-key";
    await expect(hasOpenAIKey()).resolves.toBe(true);
  });
});
