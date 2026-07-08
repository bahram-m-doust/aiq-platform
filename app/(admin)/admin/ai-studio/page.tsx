import type { Metadata } from "next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requirePlatformOwner } from "@/features/auth/queries";
import { AdminBrandRow } from "@/features/openrouter/components/AdminBrandRow";
import { AdminOpenAIKeyPanel } from "@/features/openai/components/AdminOpenAIKeyPanel";
import { getMonthSpendCents } from "@/features/openrouter/usage";
import { getRagSyncDashboard } from "@/features/rag/queries";
import { wrapSupabaseError } from "@/lib/errors";
import { hasOpenAIEnv, hasStoredOpenAIKey } from "@/lib/openai/client";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "AI Studio | AIQ Admin",
};

export const dynamic = "force-dynamic";

type BrandRow = {
  id: string;
  name: string;
  monthly_budget_cents: number | null;
};

export default async function AdminAiStudioPage() {
  await requirePlatformOwner("/admin/ai-studio");
  const admin = createAdminClient();

  const [{ data: brandsData, error: brandsError }, syncGroups] =
    await Promise.all([
      admin
        .from("brands")
        .select("id, name, monthly_budget_cents")
        .order("name", { ascending: true }),
      getRagSyncDashboard(),
    ]);

  if (brandsError) {
    throw wrapSupabaseError(brandsError, "admin ai-studio brands list failed");
  }

  const brands = (brandsData ?? []) as BrandRow[];
  const groupsByBrandId = new Map(
    syncGroups.map((group) => [group.brandId, group]),
  );
  const hasEnvOpenAIKey = hasOpenAIEnv();
  const hasStoredGlobalOpenAIKey = await hasStoredOpenAIKey();
  const hasGlobalOpenAIKey = hasStoredGlobalOpenAIKey || hasEnvOpenAIKey;
  const spends = await Promise.all(brands.map((b) => getMonthSpendCents(b.id)));

  return (
    <main className="px-6 py-10">
      <section className="mx-auto w-full max-w-5xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-sm uppercase tracking-[0.2em] text-muted-foreground">
              Platform owner
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal">
              AI Studio - OpenAI &amp; Budgets
            </h1>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Brand AI operations</CardTitle>
            <CardDescription>
              Monitor OpenAI File Search sync, vector stores, and monthly USD
              caps. OpenAI API access is configured globally by Platform
              Owners.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AdminOpenAIKeyPanel
              hasEnvOpenAIKey={hasEnvOpenAIKey}
              hasStoredOpenAIKey={hasStoredGlobalOpenAIKey}
            />
            {brands.length === 0 ? (
              <p className="text-sm text-muted-foreground">No brands yet.</p>
            ) : (
              brands.map((brand, i) => {
                const group = groupsByBrandId.get(brand.id);

                return (
                  <AdminBrandRow
                    brandId={brand.id}
                    brandName={brand.name}
                    eligibleCount={group?.eligibleCount ?? 0}
                    failedCount={group?.failedCount ?? 0}
                    hasGlobalOpenAIKey={hasGlobalOpenAIKey}
                    key={brand.id}
                    knowledgeBaseStatus={
                      group?.knowledgeBaseStatus ?? "NOT_READY"
                    }
                    monthSpendCents={spends[i] ?? 0}
                    monthlyBudgetCents={brand.monthly_budget_cents}
                    providerVectorStoreId={
                      group?.providerVectorStoreId ?? null
                    }
                    syncedCount={group?.syncedCount ?? 0}
                    syncingCount={group?.syncingCount ?? 0}
                  />
                );
              })
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
