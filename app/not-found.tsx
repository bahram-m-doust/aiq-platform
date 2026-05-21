import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <section className="mx-auto flex min-h-svh w-full max-w-3xl flex-col justify-center px-6 py-16">
        <p className="font-mono text-sm uppercase tracking-[0.2em] text-muted-foreground">
          404
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-normal text-foreground">
          Page not found
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
          This page is not available.
        </p>
        <div className="mt-8">
          <Button asChild>
            <Link href="/">Return home</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
