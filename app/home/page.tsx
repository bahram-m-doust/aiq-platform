import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Home | Bextudio Platform",
};

export default function HomePage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-6 text-foreground">
      <div className="text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Bextudio
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Home</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This landing page is coming soon.
        </p>
      </div>
    </main>
  );
}
