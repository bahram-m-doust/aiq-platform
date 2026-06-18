import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DEFAULT_PAGE_SIZE,
  type PaginationState,
} from "@/lib/pagination";

function pageHref({
  basePath,
  page,
  pageSize,
  params: extraParams,
}: {
  basePath: string;
  page: number;
  pageSize: number;
  params?: Record<string, string | undefined>;
}) {
  const params = new URLSearchParams();

  // Preserve filter params (e.g. the selected brand) so paging doesn't drop
  // them. Set these first so page/pageSize keep their conventional position.
  for (const [key, value] of Object.entries(extraParams ?? {})) {
    if (value) {
      params.set(key, value);
    }
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  if (pageSize !== DEFAULT_PAGE_SIZE) {
    params.set("pageSize", String(pageSize));
  }

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function PaginationControls({
  basePath,
  pagination,
  params,
}: {
  basePath: string;
  pagination: PaginationState;
  params?: Record<string, string | undefined>;
}) {
  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-3"
    >
      <p className="font-mono text-xs text-muted-foreground">
        Page {pagination.page} | {pagination.pageSize} per page
      </p>
      <div className="flex items-center gap-2">
        {pagination.hasPreviousPage ? (
          <Button asChild size="sm" variant="outline">
            <Link
              href={pageHref({
                basePath,
                page: pagination.page - 1,
                pageSize: pagination.pageSize,
                params,
              })}
            >
              <ChevronLeftIcon className="size-4" />
              Previous
            </Link>
          </Button>
        ) : (
          <Button disabled size="sm" variant="outline">
            <ChevronLeftIcon className="size-4" />
            Previous
          </Button>
        )}

        {pagination.hasNextPage ? (
          <Button asChild size="sm" variant="outline">
            <Link
              href={pageHref({
                basePath,
                page: pagination.page + 1,
                pageSize: pagination.pageSize,
                params,
              })}
            >
              Next
              <ChevronRightIcon className="size-4" />
            </Link>
          </Button>
        ) : (
          <Button disabled size="sm" variant="outline">
            Next
            <ChevronRightIcon className="size-4" />
          </Button>
        )}
      </div>
    </nav>
  );
}
