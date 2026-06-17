"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useBreadcrumbLabels } from "@/components/app/breadcrumb-labels";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { APP_ROOT_SEGMENTS } from "@/lib/routes";

// Friendly labels for known route segments. Unknown segments (dynamic ids,
// slugs) fall back to a humanized version of the segment.
const SEGMENT_LABELS: Record<string, string> = {
  agents: "Agents",
  "integrated-brand-brain": "Integrated Brand Brain",
  "brand-brain": "Brand Brain",
  roadmap: "Build Roadmap",
  "city-model": "City Model",
  documents: "Documents",
  questionnaire: "Questionnaires",
  settings: "Settings",
  modules: "Modules",
  invitations: "Invitations",
  "change-requests": "Change Requests",
  "create-brand": "Create Brand",
};

function humanizeSegment(segment: string) {
  const decoded = decodeURIComponent(segment);
  return (
    SEGMENT_LABELS[decoded] ??
    decoded.replace(/[-_]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

export function AppBreadcrumb() {
  const pathname = usePathname();
  // Server-resolved overrides for dynamic segments (section title, agent name…).
  const labelOverrides = useBreadcrumbLabels();
  const segments = pathname.split("/").filter(Boolean);

  // App pages live under the `(app)` route group (no shared URL prefix),
  // so recognize them by their known first segment.
  if (!APP_ROOT_SEGMENTS.has(segments[0])) return null;

  // Home is the root of the app shell — it has no breadcrumb trail of its own.
  if (segments[0] === "home" && segments.length === 1) return null;

  const crumbs = [
    ...segments.map((segment, index) => {
      const href = `/${segments.slice(0, index + 1).join("/")}`;
      return {
        key: `${segment}-${index}`,
        // Override (real label) wins, then the known-segment map, then humanize.
        label: labelOverrides[href] ?? humanizeSegment(segment),
        href,
        isLast: index === segments.length - 1,
      };
    }),
  ];

  return (
    <div className="hidden items-center gap-2 md:flex">
      <span aria-hidden className="h-4 w-px shrink-0 bg-border" />
      <Breadcrumb>
        <BreadcrumbList>
          {crumbs.map((crumb) => (
            <Fragment key={crumb.key}>
              <BreadcrumbItem>
                {crumb.isLast ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!crumb.isLast && <BreadcrumbSeparator />}
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
