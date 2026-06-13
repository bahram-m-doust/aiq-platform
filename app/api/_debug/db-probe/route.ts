import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// TEMPORARY diagnostic endpoint. Reproduces the exact admin-client queries that
// app/(app)/layout.tsx runs, so we can read the real Postgres/PostgREST error
// that is otherwise hidden behind the production "Internal Server Error" page.
// Returns ONLY error metadata (no row data). DELETE this file once diagnosed.
const PROBE_TOKEN = "bx_probe_7Kq9mZ2vR8nL4pT";

type ProbeResult = {
  name: string;
  ok: boolean;
  code: string | null;
  message: string | null;
  details: string | null;
  hint: string | null;
};

function describe(error: unknown): Omit<ProbeResult, "name" | "ok"> {
  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    return {
      code: typeof e.code === "string" ? e.code : null,
      message: typeof e.message === "string" ? e.message : String(error),
      details: typeof e.details === "string" ? e.details : null,
      hint: typeof e.hint === "string" ? e.hint : null,
    };
  }
  return { code: null, message: String(error), details: null, hint: null };
}

async function probe(
  name: string,
  run: () => PromiseLike<{ error: unknown }>,
): Promise<ProbeResult> {
  try {
    const { error } = await run();
    if (error) {
      return { name, ok: false, ...describe(error) };
    }
    return { name, ok: true, code: null, message: null, details: null, hint: null };
  } catch (error) {
    return { name, ok: false, ...describe(error) };
  }
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("token") !== PROBE_TOKEN) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();

  const results = await Promise.all([
    probe("plans.select", () => admin.from("plans").select("id").limit(1)),
    probe("users_profile.select", () =>
      admin.from("users_profile").select("id").limit(1),
    ),
    probe("brand_memberships.select", () =>
      admin.from("brand_memberships").select("brand_id, role").limit(1),
    ),
    probe("brand_memberships.join_brands", () =>
      admin
        .from("brand_memberships")
        .select("brand_id, role, brands(id, name)")
        .limit(1),
    ),
    probe("brand_entitlements.select", () =>
      admin
        .from("brand_entitlements")
        .select("brand_id, status, starts_at, expires_at")
        .limit(1),
    ),
    probe("brand_entitlements.join_plans", () =>
      admin
        .from("brand_entitlements")
        .select("brand_id, status, plans(name, credits)")
        .limit(1),
    ),
    probe("brands.icon_path", () =>
      admin.from("brands").select("icon_path").limit(1),
    ),
    probe("notifications.select", () =>
      admin.from("notifications").select("id").limit(1),
    ),
  ]);

  return NextResponse.json(
    { ok: results.every((r) => r.ok), results },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
