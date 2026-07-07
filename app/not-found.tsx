import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main
      className="relative flex min-h-svh w-full flex-col items-center justify-center overflow-hidden px-6 py-16"
      style={{ background: "var(--bv-bg)", color: "var(--bv-ink)" }}
    >
      {/* Soft brand glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-1/3 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: "var(--bv-brand-glow)", opacity: 0.6 }}
      />

      <section className="relative w-full max-w-lg text-center">
        {/* Brand mark */}
        <div className="mb-8 flex justify-center">
          <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-border bg-white shadow-xs">
            <Image
              alt="AIQ STUDIO"
              className="size-full object-contain p-1"
              height={48}
              src="/aiq-sign.png"
              unoptimized
              width={48}
            />
          </span>
        </div>

        <p
          className="font-mono text-xs uppercase tracking-[0.28em]"
          style={{ color: "var(--bv-brand-mid)" }}
        >
          Error 404
        </p>

        <h1
          className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl"
          style={{ color: "var(--bv-ink)" }}
        >
          Page not found
        </h1>

        <p
          className="mx-auto mt-4 max-w-md text-base leading-7"
          style={{ color: "var(--bv-ink-3)" }}
        >
          That page doesn&apos;t exist or has moved. Let&apos;s get you back on
          track.
        </p>

        <div className="mt-9 flex justify-center">
          <Button asChild size="lg">
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
