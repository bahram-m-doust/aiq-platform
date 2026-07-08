import "server-only";

import OpenAI from "openai";

import {
  getGlobalProviderApiKey,
  hasGlobalProviderApiKey,
  OPENAI_PROVIDER,
} from "@/features/brands/api-keys";
import { readTrimmedRuntimeEnv } from "@/lib/env/runtime";
import { DomainError, isDomainErrorWithCode } from "@/lib/errors";
import {
  coerceOpenAITextModel,
  DEFAULT_OPENAI_TEXT_MODEL,
} from "@/lib/openai/models";

const CODE = "openai_config";
const OPENAI_REQUEST_TIMEOUT_MS = 120_000;
const OPENAI_MAX_RETRIES = 2;

let client: OpenAI | null = null;
let clientKeyFingerprint: string | null = null;

export function isOpenAIConfigError(error: unknown): error is DomainError {
  return isDomainErrorWithCode(error, CODE);
}

export function hasOpenAIEnv(): boolean {
  return Boolean(readTrimmedRuntimeEnv("OPENAI_API_KEY"));
}

export async function hasStoredOpenAIKey(): Promise<boolean> {
  return hasGlobalProviderApiKey(OPENAI_PROVIDER);
}

export async function hasOpenAIKey(): Promise<boolean> {
  return (await hasStoredOpenAIKey()) || hasOpenAIEnv();
}

export function getOpenAIModel(): string {
  return coerceOpenAITextModel(
    process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_TEXT_MODEL,
  );
}

export function shouldStoreOpenAIResponses(): boolean {
  return readTrimmedRuntimeEnv("OPENAI_RESPONSE_STORE").toLowerCase() === "true";
}

function fingerprintSecret(secret: string): string {
  return `${secret.length}:${secret.slice(0, 7)}:${secret.slice(-4)}`;
}

async function resolveOpenAIApiKey(): Promise<string> {
  const storedKey = await getGlobalProviderApiKey(OPENAI_PROVIDER);
  if (storedKey) return storedKey;

  const apiKey = readTrimmedRuntimeEnv("OPENAI_API_KEY");
  if (!apiKey) {
    throw new DomainError(
      CODE,
      "OpenAI API key is required for Brand Brain OpenAI File Search.",
    );
  }
  return apiKey;
}

export async function getOpenAIClient(): Promise<OpenAI> {
  const apiKey = await resolveOpenAIApiKey();
  const fingerprint = fingerprintSecret(apiKey);
  if (client && clientKeyFingerprint === fingerprint) return client;

  client = new OpenAI({
    apiKey,
    timeout: OPENAI_REQUEST_TIMEOUT_MS,
    maxRetries: OPENAI_MAX_RETRIES,
  });
  clientKeyFingerprint = fingerprint;

  return client;
}

export function clearOpenAIClientCache(): void {
  client = null;
  clientKeyFingerprint = null;
}
