import * as Sentry from "@sentry/nextjs";

// Server + edge error tracking. Inert unless SENTRY_DSN is set, so this stays a
// complete no-op until a Sentry project exists and the env var is configured
// (set SENTRY_DSN in Netlify; optional SENTRY_TRACES_SAMPLE_RATE, default 0).
// Server-only on purpose: it captures the route-handler / server-action /
// server-component errors testers actually hit (500s) without adding the Sentry
// SDK to the client bundle. Client-side capture can be added later via
// instrumentation-client.ts if needed.
export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
  });
}

// Next.js calls this for uncaught errors in server components, route handlers,
// and server actions. A no-op until register() initializes Sentry.
export const onRequestError = Sentry.captureRequestError;
