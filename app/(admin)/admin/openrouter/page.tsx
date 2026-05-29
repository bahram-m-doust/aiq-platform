import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requirePlatformOwner } from "@/features/auth/queries";
import { AdminBrandRow } from "@/features/openrouter/components/AdminBrandRow";
import { getMonthSpendCents } from "@/features/openrouter/usage";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "OpenRouter | Bextudio Admin",
};

export const dynamic = "force-dynamic";

type BrandRow = {
  id: string;
  name: string;
  monthly_budget_cents: number | null;
};

type ApiKeyRow = {
  brand_id: string;
};

export default async function AdminOpenRouterPage() {
  await requirePlatformOwner("/admin/openrouter");
  const admin = createAdminClient();

  const [{ data: brandsData, error: brandsError }, { data: keysData }] =
    await Promise.all([
      admin
        .from("brands")
        .select("id, name, monthly_budget_cents")
        .order("name", { ascending: true }),
      admin
        .from("brand_api_keys")
        .select("brand_id")
        .eq("provider", "OPENROUTER")
        .eq("is_active", true),
    ]);

  if (brandsError) throw brandsError;

  const brands = (brandsData ?? []) as BrandRow[];
  const keyBrandIds = new Set(
    ((keysData ?? []) as ApiKeyRow[]).map((row) => row.brand_id),
  );

  const spends = await Promise.all(
    brands.map((b) => getMonthSpendCents(b.id)),
  );

  return (
    <main className="px-6 py-10">
      <section className="mx-auto w-full max-w-5xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-sm uppercase tracking-[0.2em] text-muted-foreground">
              Platform owner
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal">
              OpenRouter — Keys &amp; Budgets
            </h1>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin">
              <ArrowLeftIcon className="size-4" />
              Back to admin
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Per-brand OpenRouter access</CardTitle>
            <CardDescription>
              Set the encrypted API key and the monthly USD cap. Generation
              blocks automatically when the brand reaches its cap. Leave the cap
              blank for unlimited.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {brands.length === 0 ? (
              <p className="text-sm text-muted-foreground">No brands yet.</p>
            ) : (
              brands.map((brand, i) => (
                <AdminBrandRow
                  brandId={brand.id}
                  brandName={brand.name}
                  hasKey={keyBrandIds.has(brand.id)}
                  key={brand.id}
                  monthlyBudgetCents={brand.monthly_budget_cents}
                  monthSpendCents={spends[i]}
                />
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
