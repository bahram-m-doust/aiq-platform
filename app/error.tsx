"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the failure in the console for local debugging.
    console.error(error);
  }, [error]);

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
          <span
            className="flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-semibold text-white"
            style={{
              background:
                "linear-gradient(135deg, var(--bv-brand), var(--bv-brand-deep))",
              boxShadow: "0 8px 24px var(--bv-brand-glow)",
            }}
          >
            B
          </span>
        </div>

        <p
          className="font-mono text-xs uppercase tracking-[0.28em]"
          style={{ color: "var(--bv-brand-mid)" }}
        >
          Something broke
        </p>

        <h1
          className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl"
          style={{ color: "var(--bv-ink)" }}
        >
          This page hit a snag
        </h1>

        <p
          className="mx-auto mt-4 max-w-md text-base leading-7"
          style={{ color: "var(--bv-ink-3)" }}
        >
          We couldn&apos;t complete that request. It&apos;s usually temporary —
          try again, or head back and pick up where you left off.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-11 w-full items-center justify-center rounded-full px-7 text-sm font-medium text-white transition-transform duration-200 hover:scale-[1.02] active:scale-[0.99] sm:w-auto"
            style={{
              background:
                "linear-gradient(90deg, var(--bv-brand), var(--bv-brand-mid))",
              boxShadow: "0 8px 24px var(--bv-brand-glow)",
            }}
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex h-11 w-full items-center justify-center rounded-full border px-7 text-sm font-medium transition-colors sm:w-auto"
            style={{
              borderColor: "var(--bv-line)",
              color: "var(--bv-ink-2)",
            }}
          >
            Back to dashboard
          </Link>
        </div>

        {error.digest ? (
          <p
            className="mt-8 font-mono text-[11px] tracking-wide"
            style={{ color: "var(--bv-ink-4)" }}
          >
            Reference: {error.digest}
          </p>
        ) : null}
      </section>
    </main>
  );
}
