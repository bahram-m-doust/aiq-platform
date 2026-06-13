import { NextResponse, type NextRequest } from "next/server";

import { getBrandBuildProgress } from "@/features/app/build-progress";
import { getBrandAccessSummaryForProfile } from "@/features/access/queries";
import { getAgentCatalogWorkspace } from "@/features/agents/catalog/queries";
import { getIntakePageData } from "@/features/questionnaire/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// TEMPORARY diagnostic endpoint. Reproduces the exact server work that
// app/(app)/layout.tsx and the roadmap page run, so we can read the real error
// hidden behind the production "Internal Server Error" page. DELETE after use.
const PROBE_TOKEN = "bx_probe_7Kq9mZ2vR8nL4pT";

function describe(error: unknown) {
  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    return {
      name: typeof e.name === "string" ? e.name : null,
      code: typeof e.code === "string" ? e.code : null,
      message: typeof e.message === "string" ? e.message : String(error),
      details: typeof e.details === "string" ? e.details : null,
      hint: typeof e.hint === "string" ? e.hint : null,
      stack:
        typeof e.stack === "string"
          ? e.stack.split("\n").slice(0, 6).join("\n")
          : null,
    };
  }
  return {
    name: null,
    code: null,
    message: String(error),
    details: null,
    hint: null,
    stack: null,
  };
}

async function step<T>(name: string, run: () => Promise<T>) {
  try {
    const value = await run();
    return { name, ok: true, error: null, value: summarize(value) };
  } catch (error) {
    return { name, ok: false, error: describe(error), value: null };
  }
}

function summarize(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;
  // Avoid dumping large payloads — just report shape/status.
  const v = value as Record<string, unknown>;
  if ("status" in v) return { status: v.status };
  return { keys: Object.keys(v).slice(0, 8) };
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("token") !== PROBE_TOKEN) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const steps: unknown[] = [];

  // 1) Session/JWT path used by requireUserProfile -> getCurrentUser.
  steps.push(
    await step("auth.getClaims", async () => {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.getClaims();
      if (error) throw error;
      return { hasSession: Boolean(data?.claims?.sub) };
    }),
  );

  // 2) Find a real ACTIVE membership to replay the active-user render path.
  const admin = createAdminClient();
  let profileId: string | null = null;
  let brandId: string | null = null;
  let brandName: string | null = null;

  steps.push(
    await step("find.active_membership", async () => {
      const { data, error } = await admin
        .from("brand_memberships")
        .select("user_id, brand_id, brands(name)")
        .eq("status", "ACTIVE")
        .limit(1)
        .maybeSingle<{
          user_id: string;
          brand_id: string;
          brands: { name: string } | { name: string }[] | null;
        }>();
      if (error) throw error;
      profileId = data?.user_id ?? null;
      brandId = data?.brand_id ?? null;
      const b = Array.isArray(data?.brands) ? data?.brands[0] : data?.brands;
      brandName = b?.name ?? null;
      return { profileId, brandId, brandName };
    }),
  );

  if (profileId) {
    steps.push(
      await step("getBrandAccessSummaryForProfile", () =>
        getBrandAccessSummaryForProfile(profileId as string),
      ),
    );
    steps.push(
      await step("getAgentCatalogWorkspace", () =>
        getAgentCatalogWorkspace(profileId as string),
      ),
    );
    steps.push(
      await step("getIntakePageData", () =>
        getIntakePageData({ profileId: profileId as string }),
      ),
    );
    if (brandId && brandName) {
      steps.push(
        await step("getBrandBuildProgress", () =>
          getBrandBuildProgress(brandId as string, brandName as string, {}),
        ),
      );
    }
  }

  const ok = steps.every((s) => (s as { ok: boolean }).ok);
  return NextResponse.json(
    { ok, steps },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
