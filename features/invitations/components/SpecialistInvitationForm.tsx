"use client";

import { useActionState, useMemo } from "react";
import Link from "next/link";
import { MailCheckIcon, MailWarningIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/features/auth/components/SubmitButton";
import { createSpecialistInvitationAction } from "@/features/invitations/actions";
import { initialSpecialistInvitationFormState } from "@/features/invitations/schema";
import type { SpecialistInvitationContext } from "@/features/invitations/types";

export function SpecialistInvitationForm({
  context,
}: {
  context: SpecialistInvitationContext;
}) {
  const [state, formAction] = useActionState(
    createSpecialistInvitationAction,
    initialSpecialistInvitationFormState,
  );
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Invite Brand Specialist</CardTitle>
          <CardDescription>
            Send a time-limited, email-bound invitation to join{" "}
            {context.brandName} as a Brand Specialist.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="grid gap-5">
            {state.status === "error" ? (
              <Alert variant="destructive">
                <AlertDescription>{state.message}</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="target_email">Specialist email</Label>
                <Input
                  autoComplete="email"
                  id="target_email"
                  name="target_email"
                  placeholder="specialist@example.com"
                  required
                  type="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expires_at">Invitation expiry</Label>
                <Input
                  id="expires_at"
                  min={today}
                  name="expires_at"
                  required
                  type="date"
                />
              </div>
            </div>

            <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
              The invitation will create a JOIN_BRAND key for Brand Specialist
              access only. The key is bound to the recipient email and can be
              redeemed once before expiry.
            </div>

            <div className="flex justify-end">
              <SubmitButton
                idleLabel="Send invitation"
                pendingLabel="Sending"
              />
            </div>
          </form>
        </CardContent>
      </Card>

      {state.status === "success" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {state.warning ? (
                <MailWarningIcon className="size-4" />
              ) : (
                <MailCheckIcon className="size-4" />
              )}
              Invitation created
            </CardTitle>
            <CardDescription>{state.message}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {state.warning ? (
              <Alert>
                <MailWarningIcon className="size-4" />
                <AlertTitle>Email delivery warning</AlertTitle>
                <AlertDescription>{state.warning}</AlertDescription>
              </Alert>
            ) : null}

            {state.invitationUrl ? (
              <div className="space-y-2">
                <Label htmlFor="invitation_url">One-time invitation link</Label>
                <Input
                  aria-label="One-time invitation link"
                  id="invitation_url"
                  readOnly
                  value={state.invitationUrl}
                />
              </div>
            ) : null}

            <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
              <p>
                Prefix:{" "}
                <span className="font-mono text-foreground">
                  {state.accessKey.keyPrefix}
                </span>
              </p>
              <p>
                Role:{" "}
                <span className="font-mono text-foreground">
                  {state.accessKey.targetRole}
                </span>
              </p>
              {state.resendEmailId ? (
                <p>
                  Resend id:{" "}
                  <span className="font-mono text-foreground">
                    {state.resendEmailId}
                  </span>
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Button asChild variant="outline">
        <Link href="/dashboard">Return to Dashboard</Link>
      </Button>
    </div>
  );
}
