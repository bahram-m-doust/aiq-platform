import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DSCard, DSCardBody, DSCardHeader } from "@/components/ds/Card";
import { PageShell } from "@/components/ds/PageShell";
import { getBrandAccessSummaryForProfile } from "@/features/access/queries";
import { requireUserProfile } from "@/features/auth/queries";
import { getBrandModelDefaults } from "@/features/agents/runs/services";
import {
  DefaultImageModelCard,
  DefaultTextModelCard,
} from "@/features/openrouter/components/ModelSelectCard";
import {
  getMonthSpendCents,
  getRecentMonthUsageRows,
} from "@/features/openrouter/usage";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "AI Studio | Bextudio Platform",
};

export const dynamic = "force-dynamic";

function formatUsd(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function DashboardAiStudioPage() {
  const { profile } = await requireUserProfile("/dashboard/ai-studio");
  const summary = await getBrandAccessSummaryForProfile(profile.id);

  if (summary.status !== "ACTIVE_ACCESS" || !summary.brandId) {
    redirect("/dashboard");
  }

  if (summary.membershipRole !== "OWNER") {
    redirect("/dashboard");
  }

  const brandId = summary.brandId;
  const admin = createAdminClient();
  const { data: brandRow } = await admin
    .from("brands")
    .select("monthly_budget_cents")
    .eq("id", brandId)
    .maybeSingle<{ monthly_budget_cents: number | null }>();

  const cap = brandRow?.monthly_budget_cents ?? null;
  const [spend, defaults, recent] = await Promise.all([
    getMonthSpendCents(brandId),
    getBrandModelDefaults(brandId),
    getRecentMonthUsageRows(brandId, 5),
  ]);

  const pct =
    cap !== null && cap > 0 ? Math.min(100, (spend / cap) * 100) : 0;

  return (
    <PageShell
      eyebrow="AI"
      subtitle="Track this month's spend and pick the default models your agents use."
      title="AI Studio"
    >
      <DSCard>
        <DSCardHeader>
          <h2 className="ds-h2">Usage this month</h2>
          <p className="ds-body mt-1">
            Spend resets on the 1st of each month (UTC).
          </p>
        </DSCardHeader>
        <DSCardBody className="space-y-4">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono text-3xl tracking-[-0.02em]">
              {formatUsd(spend)}
            </span>
            <span className="text-sm text-[var(--bv-ink-3)]">
              {cap !== null ? `of ${formatUsd(cap)} cap` : "no cap set"}
            </span>
          </div>
          {cap !== null ? (
            <div
              className="h-2 overflow-hidden rounded-full"
              style={{ background: "rgba(15,15,20,0.06)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${pct}%`,
                  background:
                    "linear-gradient(90deg, var(--bv-brand), var(--bv-brand-mid))",
                }}
              />
            </div>
          ) : null}
          {recent.length > 0 ? (
            <div className="space-y-1.5 border-t border-dashed pt-3"
              style={{ borderColor: "var(--bv-line-dashed)" }}>
              <h3 className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--bv-ink-4)]">
                Recent runs
              </h3>
              <ul className="space-y-1 text-xs">
                {recent.map((row) => (
                  <li
                    className="flex items-center justify-between gap-3"
                    key={row.id}
                  >
                    <span className="font-mono text-[var(--bv-ink-3)]">
                      {formatDate(row.createdAt)}
                    </span>
                    <span className="flex-1 truncate text-[var(--bv-ink-2)]">
                      {row.kind} · {row.model}
                    </span>
                    <span className="font-mono text-[var(--bv-ink)]">
                      {formatUsd(row.costCents)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-[var(--bv-ink-3)]">
              No usage recorded this month yet.
            </p>
          )}
        </DSCardBody>
      </DSCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <DefaultTextModelCard currentModel={defaults.text} />
        <DefaultImageModelCard currentModel={defaults.image} />
      </div>
    </PageShell>
  );
}
