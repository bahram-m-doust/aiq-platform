import type { Metadata } from "next";
import Link from "next/link";
import {
  Building2Icon,
  FileTextIcon,
  ImageIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  LogOutIcon,
  MailOpenIcon,
  PencilRulerIcon,
  ScrollTextIcon,
  ShieldCheckIcon,
  BrainIcon,
  MessageSquareTextIcon,
  TagIcon,
  TelescopeIcon,
  UsersIcon,
} from "lucide-react";

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
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Admin | Bextudio Platform",
};

export const dynamic = "force-dynamic";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </h2>
  );
}

export default async function AdminPage() {
  const { user, profile } = await requirePlatformOwner("/admin");
  const email = user.email ?? profile.email;
  const pendingDemoRequests = await getPendingDemoRequestCount();
  const admin = createAdminClient();
  const { data: recentSubmissions } = await admin
    .from("audit_logs")
    .select("brand_id, created_at")
    .eq("action", "intake_final_submitted")
    .order("created_at", { ascending: false })
    .limit(5);

  const submissionBrandIds = Array.from(
    new Set(
      (recentSubmissions ?? [])
        .map((row) => row.brand_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const brandNameById = new Map<string, string>();
  if (submissionBrandIds.length > 0) {
    const { data: brandRows } = await admin
      .from("brands")
      .select("id, name")
      .in("id", submissionBrandIds);
    for (const row of (brandRows ?? []) as { id: string; name: string }[]) {
      brandNameById.set(row.id, row.name);
    }
  }

  return (
    <main className="px-6 py-10">
      <section className="mx-auto w-full max-w-4xl space-y-6">
        <div>
          <p className="font-mono text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Platform owner
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">
            Admin
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Operational tools for the Bextudio team — grouped by what you&apos;re
            doing. Every action is scoped to a brand and audited.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Admin access verified</CardTitle>
            <CardDescription>Signed in as {email}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-muted-foreground">
              Platform Owner access is active. Use admin tools for scoped,
              audited operational actions.
            </p>
          </CardContent>
        </Card>

        {recentSubmissions && recentSubmissions.length > 0 ? (
          <Card>
            <CardHeader className="pb-3">
              <SectionLabel>Recent Questionnaire Submissions</SectionLabel>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(recentSubmissions as { brand_id: string; created_at: string }[]).map((sub, i) => {
                  const name = brandNameById.get(sub.brand_id);
                  return (
                    <div
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                      key={i}
                    >
                      <span className="font-medium">
                        {name ?? `Brand ${String(sub.brand_id).slice(0, 8)}…`}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(sub.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Access & Activation */}
        <Card>
          <CardHeader className="pb-3">
            <SectionLabel>Access &amp; Activation</SectionLabel>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              <Button asChild className="justify-start gap-2" size="lg">
                <Link href="/admin/access-keys">
                  <KeyRoundIcon className="size-4" />
                  Create access key
                </Link>
              </Button>
              <Button asChild className="justify-start gap-2" size="lg">
                <Link href="/admin/entitlements">
                  <ShieldCheckIcon className="size-4" />
                  Manual plan grant
                </Link>
              </Button>
              <Button
                asChild
                className="justify-start gap-2"
                size="lg"
                variant="outline"
              >
                <Link href="/admin/demo-requests">
                  <MailOpenIcon className="size-4" />
                  Demo Requests
                  {pendingDemoRequests > 0 ? (
                    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive/15 px-1.5 text-xs font-semibold text-destructive">
                      {pendingDemoRequests}
                    </span>
                  ) : null}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Content & Workflow */}
        <Card>
          <CardHeader className="pb-3">
            <SectionLabel>Content &amp; Workflow</SectionLabel>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              <Button
                asChild
                className="justify-start gap-2"
                size="lg"
                variant="outline"
              >
                <Link href="/admin/questionnaire-builder">
                  <PencilRulerIcon className="size-4" />
                  Questionnaire Builder
                </Link>
              </Button>
              <Button
                asChild
                className="justify-start gap-2"
                size="lg"
                variant="outline"
              >
                <Link href="/admin/modules">
                  <LayoutDashboardIcon className="size-4" />
                  Module Board
                </Link>
              </Button>
              <Button
                asChild
                className="justify-start gap-2"
                size="lg"
                variant="outline"
              >
                <Link href="/admin/stakeholder-interviews">
                  <UsersIcon className="size-4" />
                  Stakeholder Interviews
                </Link>
              </Button>
              <Button
                asChild
                className="justify-start gap-2"
                size="lg"
                variant="outline"
              >
                <Link href="/admin/futures-research">
                  <TelescopeIcon className="size-4" />
                  Futures Research
                </Link>
              </Button>
              <Button
                asChild
                className="justify-start gap-2"
                size="lg"
                variant="outline"
              >
                <Link href="/admin/city-model">
                  <Building2Icon className="size-4" />
                  City Model
                </Link>
              </Button>
              <Button
                asChild
                className="justify-start gap-2"
                size="lg"
                variant="outline"
              >
                <Link href="/admin/change-requests">
                  <ListChecksIcon className="size-4" />
                  Change Requests
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Documents & Knowledge */}
        <Card>
          <CardHeader className="pb-3">
            <SectionLabel>Documents &amp; Knowledge</SectionLabel>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              <Button
                asChild
                className="justify-start gap-2"
                size="lg"
                variant="outline"
              >
                <Link href="/admin/documents">
                  <FileTextIcon className="size-4" />
                  Manage Documents
                </Link>
              </Button>
              <Button
                asChild
                className="justify-start gap-2"
                size="lg"
                variant="outline"
              >
                <Link href="/admin/rag">
                  <BrainIcon className="size-4" />
                  RAG Approval Queue
                </Link>
              </Button>
              <Button
                asChild
                className="justify-start gap-2"
                size="lg"
                variant="outline"
              >
                <Link href="/admin/submissions">
                  <FileTextIcon className="size-4" />
                  Questionnaire Submissions
                </Link>
              </Button>
              <Button
                asChild
                className="justify-start gap-2"
                size="lg"
                variant="outline"
              >
                <Link href="/admin/agent-instructions">
                  <MessageSquareTextIcon className="size-4" />
                  Agent Instructions
                </Link>
              </Button>
              <Button
                asChild
                className="justify-start gap-2"
                size="lg"
                variant="outline"
              >
                <Link href="/admin/ai-studio">
                  <KeyRoundIcon className="size-4" />
                  AI Studio — Keys &amp; Costs
                </Link>
              </Button>
              <Button
                asChild
                className="justify-start gap-2"
                size="lg"
                variant="outline"
              >
                <Link href="/admin/brand-icons">
                  <ImageIcon className="size-4" />
                  Brand Icons
                </Link>
              </Button>
              <Button
                asChild
                className="justify-start gap-2"
                size="lg"
                variant="outline"
              >
                <Link href="/admin/plans">
                  <TagIcon className="size-4" />
                  Pricing Plans
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* System */}
        <Card>
          <CardHeader className="pb-3">
            <SectionLabel>System</SectionLabel>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              <Button
                asChild
                className="justify-start gap-2"
                size="lg"
                variant="outline"
              >
                <Link href="/admin/audit">
                  <ScrollTextIcon className="size-4" />
                  Audit logs
                </Link>
              </Button>
              <form action={logout}>
                <Button
                  className="w-full justify-start gap-2"
                  size="lg"
                  type="submit"
                  variant="outline"
                >
                  <LogOutIcon className="size-4" />
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
