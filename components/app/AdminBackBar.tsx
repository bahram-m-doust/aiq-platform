"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";

// One consistent "back" control for every admin page. Lives in the admin
// layout so it always sits in the same place. On the /admin overview there is
// nothing to go back to, but the bar still renders for the right-side actions
// (e.g. the notifications bell). On a deeper page (e.g. a module detail) it
// steps back to that section's board; otherwise to the admin overview.
export function AdminBackBar({ actions }: { actions?: ReactNode }) {
  const pathname = usePathname();

  const isOverview = pathname === "/admin";
  const segments = pathname.split("/").filter(Boolean); // ["admin", section, ...]
  const isDeep = segments.length > 2;
  const backHref = isDeep ? `/${segments.slice(0, -1).join("/")}` : "/admin";
  const label = isDeep ? "Back" : "Back to Admin";

  if (isOverview && !actions) return null;

  return (
    <div className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3">
        {isOverview ? (
          <span />
        ) : (
          <Link
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            href={backHref}
          >
            <ChevronLeftIcon className="size-4" />
            {label}
          </Link>
        )}
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
