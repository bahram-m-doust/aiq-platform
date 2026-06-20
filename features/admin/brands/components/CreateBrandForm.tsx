"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { PlusIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { createBrandAction } from "@/features/admin/brands/actions";
import { initialBrandAdminActionState } from "@/features/admin/brands/types";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button className="gap-2" disabled={pending} type="submit">
      <PlusIcon className="size-4" />
      {pending ? "Creating…" : "Create brand"}
    </Button>
  );
}

export function CreateBrandForm() {
  const [state, formAction] = useActionState(
    createBrandAction,
    initialBrandAdminActionState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the inputs after a successful create so the next brand starts fresh.
  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a brand</CardTitle>
        <CardDescription>
          Spin up a new brand workspace. Optionally hand ownership to an existing
          user by email — grant a plan afterwards from Manual plan grant.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4" ref={formRef}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="brand_name">Brand name</Label>
              <Input
                id="brand_name"
                name="brand_name"
                placeholder="Acme Co."
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Input
                id="industry"
                name="industry"
                placeholder="Retail (optional)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                name="website"
                placeholder="https://example.com (optional)"
                type="url"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner_email">Owner email</Label>
              <Input
                id="owner_email"
                name="owner_email"
                placeholder="owner@example.com (optional)"
                type="email"
              />
            </div>
          </div>

          {state.status === "error" ? (
            <Alert variant="destructive">
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}
          {state.status === "success" ? (
            <Alert>
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex justify-end">
            <SubmitButton />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
