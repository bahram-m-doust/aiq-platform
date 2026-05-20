"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SubmitButton } from "@/features/auth/components/SubmitButton";
import { acceptSpecialistInvitationAction } from "@/features/invitations/actions";
import { initialAcceptInvitationFormState } from "@/features/invitations/schema";

export function AcceptInvitationForm({
  rawKey,
  email,
}: {
  rawKey: string;
  email: string;
}) {
  const [state, formAction] = useActionState(
    acceptSpecialistInvitationAction,
    initialAcceptInvitationFormState,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accept Brand Specialist invitation</CardTitle>
        <CardDescription>
          You are signed in as {email}. The invitation must be assigned to this
          email address before access can be activated.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input name="access_key" type="hidden" value={rawKey} />
          {state.status === "error" ? (
            <Alert variant="destructive">
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}
          <SubmitButton
            idleLabel="Accept invitation"
            pendingLabel="Accepting"
          />
        </form>
      </CardContent>
    </Card>
  );
}
