"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";

// Gates the progress panel's review affordance — the "Unanswered" box while
// gaps remain, and the final "Review & submit" button once they're closed —
// once the user has reached the "Review & submit" step. Reaching review is
// recorded per session in sessionStorage, so navigating into a section to fix
// answers and coming back (which drops the ?review=1 flag) keeps the affordance
// visible instead of vanishing.
const noopSubscribe = () => () => {};

export function UnansweredReveal({
  reviewReached,
  sessionId,
  children,
}: {
  reviewReached: boolean;
  sessionId: string;
  children: ReactNode;
}) {
  const key = `bextudio:intake-review-reached:${sessionId}`;

  // Read the persisted "review reached" flag in an SSR/hydration-safe way.
  const persistedReached = useSyncExternalStore(
    noopSubscribe,
    () => {
      try {
        return window.sessionStorage.getItem(key) === "1";
      } catch {
        return false;
      }
    },
    () => false,
  );

  // Record that review was reached so later visits (without ?review=1) persist.
  useEffect(() => {
    if (!reviewReached) return;
    try {
      window.sessionStorage.setItem(key, "1");
    } catch {
      // sessionStorage unavailable — fall back to the URL-driven prop only.
    }
  }, [reviewReached, key]);

  if (!reviewReached && !persistedReached) return null;
  return <>{children}</>;
}
