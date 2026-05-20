import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { AuditLogList } from "@/features/audit/components/AuditLogList";
import { getLatestAuditLogs } from "@/features/audit/queries";
import { requirePlatformOwner } from "@/features/auth/queries";

export const metadata: Metadata = {
  title: "Audit Logs | Bextudio Platform",
};

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  const { user, profile } = await requirePlatformOwner("/admin/audit");
  const logs = await getLatestAuditLogs();
  const email = user.email ?? profile.email;

  return (
    <main className="min-h-svh bg-background px-6 py-10 text-foreground">
      <section className="mx-auto w-full max-w-6xl space-y-6">
        <div>
          <p className="font-mono text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Platform audit
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">
            Audit Logs
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Signed in as {email} | read-only operational record
          </p>
        </div>

        <AuditLogList logs={logs} />

        <Button asChild variant="outline">
          <Link href="/admin">Return to Admin</Link>
        </Button>
      </section>
    </main>
  );
}
