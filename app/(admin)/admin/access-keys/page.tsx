import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { AdminAccessKeyForm } from "@/features/admin/components/AdminAccessKeyForm";
import { getAdminAccessKeyFormOptions } from "@/features/admin/queries";
import { requirePlatformOwner } from "@/features/auth/queries";

export const metadata: Metadata = {
  title: "Access Keys | Bextudio Admin",
};

export const dynamic = "force-dynamic";

export default async function AdminAccessKeysPage() {
  const { profile } = await requirePlatformOwner("/admin/access-keys");
  const options = await getAdminAccessKeyFormOptions();

  return (
    <main className="min-h-svh bg-background px-6 py-10 text-foreground">
      <section className="mx-auto w-full max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-sm uppercase tracking-[0.2em] text-muted-foreground">
              Platform owner
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal">
              Brand Access Keys
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Signed in as {profile.email}
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin">Admin overview</Link>
          </Button>
        </div>

        <AdminAccessKeyForm options={options} />
      </section>
    </main>
  );
}
