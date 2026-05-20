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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createBrandFromAccessKeyAction,
  initialCreateBrandFormState,
} from "@/features/brands/create-brand/actions";
import { SubmitButton } from "@/features/auth/components/SubmitButton";

export function CreateBrandForm({
  accessKeyId,
  keyPrefix,
  planName,
}: {
  accessKeyId: string;
  keyPrefix: string;
  planName: string | null;
}) {
  const [state, formAction] = useActionState(
    createBrandFromAccessKeyAction,
    initialCreateBrandFormState,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Brand Workspace</CardTitle>
        <CardDescription>
          Access key {keyPrefix} is verified
          {planName ? ` for the ${planName} plan` : ""}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-5">
          <input name="access_key_id" type="hidden" value={accessKeyId} />
          {state.status === "error" ? (
            <Alert variant="destructive">
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="brand_name">Brand name</Label>
              <Input
                autoComplete="organization"
                id="brand_name"
                name="brand_name"
                placeholder="Bextudio"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Input
                id="industry"
                name="industry"
                placeholder="Hospitality, real estate, technology"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              autoComplete="url"
              id="website"
              name="website"
              placeholder="https://example.com"
              type="url"
            />
          </div>

          <SubmitButton
            idleLabel="Create brand workspace"
            pendingLabel="Creating workspace"
          />
        </form>
      </CardContent>
    </Card>
  );
}
