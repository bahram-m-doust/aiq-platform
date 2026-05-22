import { NextResponse } from "next/server";

import { getHealthStatus } from "@/lib/health";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const health = await getHealthStatus();
  const status = health.status === "ok" ? 200 : 503;

  return NextResponse.json(health, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
