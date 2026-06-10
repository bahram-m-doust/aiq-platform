"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";

// One consistent "back" control for every admin page. Lives in the admin
// layout so it always sits in the same place. Hidden on the /admin overview
// itself (nothing to go back to). On a deeper page (e.g. a module detail) it
// steps back to that section's board; otherwise to the admin overview.
export function AdminBackBar() {
  const pathname = usePathname();

  if (pathname === "/admin") return null;

  const segments = pathname.split("/").filter(Boolean); // ["admin", section, ...]
  const isDeep = segments.length > 2;
  const backHref = isDeep ? `/${segments.slice(0, -1).join("/")}` : "/admin";
  const label = isDeep ? "Back" : "Back to Admin";

  return (
    <div className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center px-6 py-3">
        <Link
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          href={backHref}
        >
          <ChevronLeftIcon className="size-4" />
          {label}
        </Link>
      </div>
    </div>
  );
}
