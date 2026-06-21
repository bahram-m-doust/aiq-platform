import "server-only";

import { logServerError } from "@/lib/logging/server";
import { readTrimmedRuntimeEnv } from "@/lib/env/runtime";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPublicSupabaseEnv } from "@/lib/supabase/env";

export type HealthCheckState = "ok" | "error";

export type HealthStatus = {
  service: "bextudio-platform";
  status: HealthCheckState;
  timestamp: string;
  checks: {
    env: HealthCheckState;
    supabase: HealthCheckState;
  };
  // Per-variable presence (booleans only, never values) so operators can see
  // exactly which required server env var is missing when `env` is "error".
  envDetail: Record<string, boolean>;
};

function requiredServerEnvDetail(): Record<string, boolean> {
  return {
    NEXT_PUBLIC_SUPABASE: hasPublicSupabaseEnv(),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(
      readTrimmedRuntimeEnv("SUPABASE_SERVICE_ROLE_KEY"),
    ),
    KEY_ENCRYPTION_KEY: Boolean(
      readTrimmedRuntimeEnv("KEY_ENCRYPTION_KEY") ||
        readTrimmedRuntimeEnv("KEY_ENCRYPTION_KEYS"),
    ),
    APP_BASE_URL: Boolean(process.env.APP_BASE_URL?.trim()),
    ADMIN_BASE_URL: Boolean(process.env.ADMIN_BASE_URL?.trim()),
  };
}

function hasRequiredServerEnv() {
  return Object.values(requiredServerEnvDetail()).every(Boolean);
}

async function checkSupabase() {
  const admin = createAdminClient();
  const { error } = await admin.from("plans").select("id").limit(1);

  if (error) {
    throw error;
  }
}

export async function getHealthStatus(now = new Date()): Promise<HealthStatus> {
  const env: HealthCheckState = hasRequiredServerEnv() ? "ok" : "error";
  let supabase: HealthCheckState = "error";

  if (env === "ok") {
    try {
      await checkSupabase();
      supabase = "ok";
    } catch (error) {
      logServerError({
        label: "[health] supabase check failed",
        error,
      });
    }
  }

  const status: HealthCheckState =
    env === "ok" && supabase === "ok" ? "ok" : "error";

  return {
    service: "bextudio-platform",
    status,
    timestamp: now.toISOString(),
    checks: {
      env,
      supabase,
    },
    envDetail: requiredServerEnvDetail(),
  };
}
