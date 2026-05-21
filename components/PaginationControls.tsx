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
}: {
  basePath: string;
  page: number;
  pageSize: number;
}) {
  const params = new URLSearchParams();

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
}: {
  basePath: string;
  pagination: PaginationState;
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
