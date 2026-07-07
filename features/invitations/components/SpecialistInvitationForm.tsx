"use client";

import { useActionState, useMemo } from "react";
import { MailCheckIcon, MailWarningIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CopyButton } from "@/components/ui/copy-button";
import { DSCard, DSCardBody, DSCardHeader } from "@/components/ds/Card";
import { DatePicker } from "@/components/ui/date-picker";
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
  void context;
  const [state, formAction] = useActionState(
    createSpecialistInvitationAction,
    initialSpecialistInvitationFormState,
  );
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  return (
    <div className="w-full max-w-[374px] space-y-6">
      <DSCard className="p-6">
        <DSCardBody className="p-0">
          <form action={formAction} className="grid gap-6">
            {state.status === "error" ? (
              <Alert variant="destructive">
                <AlertDescription>{state.message}</AlertDescription>
              </Alert>
            ) : null}

            <div className="flex flex-col gap-4">
              <div className="space-y-2">
                <Label
                  className="text-sm font-medium leading-none"
                  htmlFor="target_email"
                >
                  Specialist email
                </Label>
                <Input
                  aria-describedby="target_email_description"
                  autoComplete="email"
                  className="h-9 text-sm font-normal leading-5 shadow-xs"
                  id="target_email"
                  name="target_email"
                  placeholder="specialist@example.com"
                  required
                  type="email"
                />
                <p
                  className="text-sm font-normal leading-5 text-muted-foreground"
                  id="target_email_description"
                >
                  We will send the invitation link to this email address.
                </p>
              </div>

              <div className="space-y-2">
                <Label
                  className="text-sm font-medium leading-none"
                  htmlFor="expires_at"
                >
                  Invitation expiry
                </Label>
                <DatePicker
                  ariaDescribedBy="expires_at_description"
                  id="expires_at"
                  min={today}
                  name="expires_at"
                  required
                />
                <p
                  className="text-sm font-normal leading-5 text-muted-foreground"
                  id="expires_at_description"
                >
                  After this date, the invitation can no longer be accepted.
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <SubmitButton
                idleLabel="Send invitation"
                pendingLabel="Sending"
              />
            </div>
          </form>
        </DSCardBody>
      </DSCard>

      {state.status === "success" ? (
        <DSCard className="space-y-6 p-6">
          <DSCardHeader className="space-y-1.5 p-0">
            <h2 className="ds-h2 flex items-center gap-2">
              {state.warning ? (
                <MailWarningIcon className="size-4" />
              ) : (
                <MailCheckIcon className="size-4" />
              )}
              Invitation created
            </h2>
            <p className="ds-body">{state.message}</p>
          </DSCardHeader>
          <DSCardBody className="space-y-4 p-0">
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
                <div className="flex gap-2">
                  <Input
                    aria-label="One-time invitation link"
                    className="flex-1"
                    id="invitation_url"
                    readOnly
                    value={state.invitationUrl}
                  />
                  <CopyButton ariaLabel="Copy invitation link" value={state.invitationUrl} />
                </div>
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
          </DSCardBody>
        </DSCard>
      ) : null}
    </div>
  );
}
