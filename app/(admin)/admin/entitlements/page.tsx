import type { Metadata } from "next";

import { ManualPlanGrantForm } from "@/features/admin/manual-grant/components/ManualPlanGrantForm";
import { getManualGrantFormOptions } from "@/features/admin/queries";
import { requirePlatformOwner } from "@/features/auth/queries";

export const metadata: Metadata = {
  title: "Manual Plan Grant | Bextudio Admin",
};

export const dynamic = "force-dynamic";

export default async function AdminEntitlementsPage() {
  const { profile } = await requirePlatformOwner("/admin/entitlements");
  const options = await getManualGrantFormOptions();

  return (
    <main className="min-h-svh bg-background px-6 py-10 text-foreground">
      <section className="mx-auto w-full max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-sm uppercase tracking-[0.2em] text-muted-foreground">
              Platform owner
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal">
              Manual Plan Grant
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Signed in as {profile.email}
            </p>
          </div>
          
        </div>

        <ManualPlanGrantForm options={options} />
      </section>
    </main>
  );
}
