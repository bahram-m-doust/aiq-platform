import type { ReactNode } from "react";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,_#edf0f3_38%,_#f9fafb_100%)] px-6 py-10 text-foreground">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
