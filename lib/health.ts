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
};

function hasRequiredServerEnv() {
  return Boolean(
    hasPublicSupabaseEnv() &&
      readTrimmedRuntimeEnv("SUPABASE_SERVICE_ROLE_KEY") &&
      process.env.APP_BASE_URL?.trim() &&
      process.env.ADMIN_BASE_URL?.trim(),
  );
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
  };
}
