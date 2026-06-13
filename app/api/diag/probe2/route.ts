import { NextResponse, type NextRequest } from "next/server";

import { getBrandBuildProgress } from "@/features/app/build-progress";
import { getBrandBrainWorkspace } from "@/features/agents/brain/queries";
import { getIntakePageData } from "@/features/questionnaire/queries";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// TEMPORARY. Replays the roadmap/brain page server work for a real ACTIVE
// member so we can read the error hidden behind the 500. Never throws itself.
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
          ? e.stack.split("\n").slice(0, 8).join("\n")
          : null,
    };
  }
  return { name: null, code: null, message: String(error), details: null, hint: null, stack: null };
}

async function tryCall(run: () => Promise<unknown>) {
  try {
    await run();
    return { ok: true, error: null };
  } catch (error) {
    return { ok: false, error: describe(error) };
  }
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("token") !== PROBE_TOKEN) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const out: Record<string, unknown> = {};

  try {
    const admin = createAdminClient();
    const { data: m, error: mErr } = await admin
      .from("brand_memberships")
      .select("user_id, brand_id, brands(name)")
      .eq("status", "ACTIVE")
      .limit(1)
      .maybeSingle<{
        user_id: string;
        brand_id: string;
        brands: { name: string } | { name: string }[] | null;
      }>();

    out.member = { found: Boolean(m), error: mErr ? describe(mErr) : null };

    if (m) {
      const profileId = m.user_id;
      const brandId = m.brand_id;
      const b = Array.isArray(m.brands) ? m.brands[0] : m.brands;
      const brandName = b?.name ?? "";
      out.context = { profileId, brandId, brandName };

      out.getIntakePageData = await tryCall(() =>
        getIntakePageData({ profileId }),
      );
      out.getBrandBuildProgress = await tryCall(() =>
        getBrandBuildProgress(brandId, brandName, {}),
      );
      out.getBrandBrainWorkspace = await tryCall(() =>
        getBrandBrainWorkspace(profileId),
      );
    }
  } catch (error) {
    out.topLevelError = describe(error);
  }

  return NextResponse.json(out, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
