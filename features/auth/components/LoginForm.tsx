"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { login } from "@/features/auth/actions";
import { initialAuthFormState } from "@/features/auth/schemas";
import { GoogleSignInButton } from "@/features/auth/components/GoogleSignInButton";
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
    nextPath === "/home"
      ? "/register"
      : `/register?next=${encodeURIComponent(nextPath)}`;

  return (
    <>
      <div className="rounded-lg border border-border bg-card px-8 py-10 shadow-xs">
        <div className="flex flex-col gap-10">
          <div className="flex items-center justify-center">
            <Image
              alt="Bextudio"
              height={16}
              src="/square-sign.png"
              unoptimized
              width={16}
              className="mr-1.5 size-5"
            />
            <span className="text-sm font-semibold tracking-wider">
              BEXTUDIO
            </span>
          </div>

          <div className="flex flex-col gap-4">
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
          </div>

          <div className="relative">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
              Or
            </span>
          </div>

          <form action={formAction} className="flex flex-col gap-4">
            <input name="next" type="hidden" value={nextPath} />
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  className="text-sm text-foreground underline"
                  href="/forgot-password"
                >
                  Forgot your password?
                </Link>
              </div>
              <Input
                autoComplete="current-password"
                id="password"
                name="password"
                required
                type="password"
              />
            </div>
            <div className="mt-6 flex flex-col gap-6">
              <SubmitButton idleLabel="Login" pendingLabel="Logging in…" />
              <p className="text-center text-sm text-card-foreground">
                Don&apos;t have an account?{" "}
                <Link className="text-foreground underline" href={registerHref}>
                  Sign up
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>

      <p className="mt-6 text-center text-xs leading-4 text-muted-foreground">
        By clicking continue, you agree to our{" "}
        <Link className="underline" href="/terms">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link className="underline" href="/privacy">
          Privacy Policy
        </Link>
      </p>
    </>
  );
}
