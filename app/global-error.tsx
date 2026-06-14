"use client";

import { Button } from "@/components/ui/button";

// Catches render errors in the root layout itself — the one place app/error.tsx
// cannot reach. Must render its own <html>/<body> because the layout crashed.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          alignItems: "center",
          background: "#ffffff",
          color: "#0e0e14",
          display: "flex",
          fontFamily: "system-ui, sans-serif",
          justifyContent: "center",
          minHeight: "100vh",
          margin: 0,
        }}
      >
        <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <p
            style={{
              fontSize: 11,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#82828d",
            }}
          >
            Bextudio
          </p>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: "8px 0" }}>
            Something went wrong
          </h1>
          <p style={{ color: "#4a4a55", fontSize: 14, lineHeight: 1.55 }}>
            An unexpected error occurred. Your work is safe — try again, or
            contact the Bextudio team if the problem persists.
          </p>
          <Button
            onClick={() => reset()}
            style={{
              background: "#0891b2",
              border: "none",
              borderRadius: 8,
              color: "#ffffff",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 500,
              marginTop: 16,
              padding: "10px 20px",
            }}
            type="button"
          >
            Try again
          </Button>
        </div>
      </body>
    </html>
  );
}
