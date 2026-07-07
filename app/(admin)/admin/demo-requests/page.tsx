import type { Metadata } from "next";

import { requirePlatformOwner } from "@/features/auth/queries";
import { AdminDemoRequestsList } from "@/features/demo-requests/components/AdminDemoRequestsList";
import { getPendingDemoRequests } from "@/features/demo-requests/queries";

export const metadata: Metadata = {
  title: "Demo Requests | AIQ Platform",
};

export const dynamic = "force-dynamic";

export default async function AdminDemoRequestsPage() {
  const { user, profile } = await requirePlatformOwner("/admin/demo-requests");
  const email = user.email ?? profile.email;
  const requests = await getPendingDemoRequests();

  return (
    <main className="min-h-svh bg-background px-6 py-10 text-foreground">
      <section className="mx-auto w-full max-w-4xl space-y-6">
        <div>
          <p className="font-mono text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Admin review
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">
            Demo Requests
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Signed in as {email}. Approve to mint a DEMO_ACCESS key and email
            the magic link.
          </p>
        </div>
        <AdminDemoRequestsList requests={requests} />

        
      </section>
    </main>
  );
}
