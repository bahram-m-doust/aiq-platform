import type { Metadata } from "next";

import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getCurrentUser,
  getUserProfileByAuthUserId,
} from "@/features/auth/queries";
import { ensureUserProfile } from "@/features/auth/profile";
import { buildInvitationAcceptPath } from "@/features/invitations/schema";
import { AcceptInvitationForm } from "@/features/invitations/components/AcceptInvitationForm";
import { AcceptInvitationPrompt } from "@/features/invitations/components/AcceptInvitationPrompt";

export const metadata: Metadata = {
  title: "Accept Invitation | AIQ Platform",
};

export const dynamic = "force-dynamic";

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const params = await searchParams;
  const rawKey = typeof params.key === "string" ? params.key.trim() : "";
  const acceptPath = rawKey ? buildInvitationAcceptPath(rawKey) : "/invite/accept";
  const user = await getCurrentUser();

  if (!rawKey) {
    return (
      <main className="min-h-svh bg-background px-6 py-10 text-foreground">
        <section className="mx-auto w-full max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Accept invitation</CardTitle>
              <CardDescription>
                A valid invitation link is required to join a brand workspace.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert variant="destructive">
                <AlertDescription>Invitation key is missing.</AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-svh bg-background px-6 py-10 text-foreground">
        <section className="mx-auto w-full max-w-2xl">
          <AcceptInvitationPrompt acceptPath={acceptPath} />
        </section>
      </main>
    );
  }

  let profile = await getUserProfileByAuthUserId(user.id);

  if (!profile) {
    await ensureUserProfile(user);
    profile = await getUserProfileByAuthUserId(user.id);
  }

  if (!profile) {
    throw new Error("Authenticated user profile could not be loaded.");
  }

  return (
    <main className="min-h-svh bg-background px-6 py-10 text-foreground">
      <section className="mx-auto w-full max-w-2xl">
        <AcceptInvitationForm
          email={user.email ?? profile.email}
          rawKey={rawKey}
        />
      </section>
    </main>
  );
}
