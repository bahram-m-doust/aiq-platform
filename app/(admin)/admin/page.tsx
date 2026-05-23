import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { logout } from "@/features/auth/actions";
import { requirePlatformOwner } from "@/features/auth/queries";
import { getPendingDemoRequestCount } from "@/features/demo-requests/queries";

export const metadata: Metadata = {
  title: "Admin | Bextudio Platform",
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { user, profile } = await requirePlatformOwner("/admin");
  const email = user.email ?? profile.email;
  const pendingDemoRequests = await getPendingDemoRequestCount();

  return (
    <main className="min-h-svh bg-background px-6 py-10 text-foreground">
      <section className="mx-auto w-full max-w-4xl space-y-6">
        <div>
          <p className="font-mono text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Platform owner
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">
            Admin
          </h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Admin access verified</CardTitle>
            <CardDescription>Signed in as {email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-6 text-muted-foreground">
              Platform Owner access is active. Use admin tools for scoped,
              audited operational actions.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/admin/entitlements">Manual plan grant</Link>
              </Button>
              <Button asChild>
                <Link href="/admin/access-keys">Create access key</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/admin/change-requests">Review Change Requests</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/admin/demo-requests">
                  Demo Requests
                  {pendingDemoRequests > 0 ? (
                    <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive/15 px-1.5 text-xs font-semibold text-destructive">
                      {pendingDemoRequests}
                    </span>
                  ) : null}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/admin/files">Manage Files</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/admin/modules">Module Board</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/admin/rag">RAG Approval Queue</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/admin/audit">Audit logs</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/admin/intake-builder">Intake Builder</Link>
              </Button>
              <form action={logout}>
                <Button type="submit" variant="outline">
                  Sign out
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
