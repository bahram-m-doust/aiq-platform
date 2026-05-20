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
import { login } from "@/features/auth/actions";
import { initialAuthFormState } from "@/features/auth/schemas";
import { GoogleSignInButton } from "@/features/auth/components/GoogleSignInButton";
import { SubmitButton } from "@/features/auth/components/SubmitButton";

export function AdminLoginForm({
  nextPath,
  message,
}: {
  nextPath: string;
  message?: string;
}) {
  const [state, formAction] = useActionState(login, initialAuthFormState);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Admin sign in</h1>
        </CardTitle>
        <CardDescription>
          Platform Owner access only. Accounts are provisioned by invitation.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {message ? (
            <Alert>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}
          {state.status === "error" ? (
            <Alert variant="destructive">
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}
          <GoogleSignInButton nextPath={nextPath} />
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>
          <form action={formAction} className="space-y-4">
            <input name="next" type="hidden" value={nextPath} />
            <div className="space-y-2">
              <Label htmlFor="admin-email">Email</Label>
              <Input
                autoComplete="email"
                id="admin-email"
                name="email"
                placeholder="admin@example.com"
                required
                type="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password">Password</Label>
              <Input
                autoComplete="current-password"
                id="admin-password"
                name="password"
                required
                type="password"
              />
            </div>
            <SubmitButton idleLabel="Sign in" pendingLabel="Signing in" />
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
