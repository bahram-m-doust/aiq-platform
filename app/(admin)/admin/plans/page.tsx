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
import { CreatePlanForm } from "@/features/admin/plans/components/CreatePlanForm";
import {
  PlanRow,
  type PlanRowData,
} from "@/features/admin/plans/components/PlanRow";
import { requirePlatformOwner } from "@/features/auth/queries";
import { wrapSupabaseError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Pricing plans | Bextudio Admin",
};

export const dynamic = "force-dynamic";

export default async function AdminPlansPage() {
  await requirePlatformOwner("/admin/plans");
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("plans")
    .select("id, name, price, currency, duration_days, is_active")
    .order("price", { ascending: true, nullsFirst: true });

  if (error) {
    throw wrapSupabaseError(error, "admin plans list failed");
  }

  const plans = (data ?? []) as PlanRowData[];

  return (
    <main className="px-6 py-10">
      <section className="mx-auto w-full max-w-5xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-sm uppercase tracking-[0.2em] text-muted-foreground">
              Platform owner
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal">
              Pricing plans
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
            <CardTitle>Create plan</CardTitle>
            <CardDescription>
              Plan name must be unique. Leave price or duration empty for a
              custom-quoted plan. Inactive plans are hidden from the access-key
              dropdown.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreatePlanForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Existing plans ({plans.length})</CardTitle>
            <CardDescription>
              Edit name, price, currency, duration, or active state. Changes
              save per row.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {plans.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No plans yet. Create one above.
              </p>
            ) : (
              plans.map((plan) => <PlanRow key={plan.id} plan={plan} />)
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
