"use client";

import Link from "next/link";
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
import { SubmitButton } from "@/features/auth/components/SubmitButton";

export function LoginForm({
  nextPath,
  message,
}: {
  nextPath: string;
  message?: string;
}) {
  const [state, formAction] = useActionState(login, initialAuthFormState);
  const registerHref =
    nextPath === "/dashboard"
      ? "/register"
      : `/register?next=${encodeURIComponent(nextPath)}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Sign in</h1>
        </CardTitle>
        <CardDescription>
          Enter your Bextudio account details to continue.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input name="next" type="hidden" value={nextPath} />
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
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              autoComplete="email"
              id="email"
              name="email"
              placeholder="you@example.com"
              required
              type="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              autoComplete="current-password"
              id="password"
              name="password"
              required
              type="password"
            />
          </div>
          <SubmitButton idleLabel="Sign in" pendingLabel="Signing in" />
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          New to Bextudio?{" "}
          <Link className="text-foreground underline" href={registerHref}>
            Create an account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
