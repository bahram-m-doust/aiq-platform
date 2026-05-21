"use client";

import { Button } from "@/components/ui/button";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <section className="mx-auto flex min-h-svh w-full max-w-3xl flex-col justify-center px-6 py-16">
        <p className="font-mono text-sm uppercase tracking-[0.2em] text-muted-foreground">
          Error
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-normal text-foreground">
          Something went wrong
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
          The request could not be completed.
        </p>
        <div className="mt-8">
          <Button onClick={reset} type="button">
            Try again
          </Button>
        </div>
      </section>
    </main>
  );
}
