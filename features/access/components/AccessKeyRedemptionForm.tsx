"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  initialAccessKeyRedemptionFormState,
  redeemDashboardAccessKeyAction,
} from "@/features/access/actions";
import { SubmitButton } from "@/features/auth/components/SubmitButton";

export function AccessKeyRedemptionForm() {
  const [state, formAction] = useActionState(
    redeemDashboardAccessKeyAction,
    initialAccessKeyRedemptionFormState,
  );

  return (
    <form
      action={formAction}
      aria-label="Access Key activation"
      className="space-y-3"
    >
      {state.status === "error" ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="accessKey">Access Key</Label>
        <Input
          autoComplete="off"
          id="accessKey"
          name="accessKey"
          placeholder="Enter your Brand Access Key"
          required
          type="text"
        />
      </div>
      <SubmitButton idleLabel="Redeem Access Key" pendingLabel="Redeeming" />
      <p className="text-sm leading-6 text-muted-foreground">
        CREATE_BRAND and CLAIM_BRAND keys activate the secure brand workspace
        flow.
      </p>
    </form>
  );
}
