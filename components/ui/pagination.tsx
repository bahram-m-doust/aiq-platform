import * as React from "react";
import Link from "next/link";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsRightIcon,
  MoreHorizontalIcon,
} from "lucide-react";
import { type VariantProps } from "class-variance-authority";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      aria-label="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      data-slot="pagination"
      role="navigation"
      {...props}
    />
  );
}

function PaginationContent({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      className={cn("flex flex-row items-center gap-1", className)}
      data-slot="pagination-content"
      {...props}
    />
  );
}

function PaginationItem(props: React.ComponentProps<"li">) {
  return <li data-slot="pagination-item" {...props} />;
}

type PaginationLinkProps = {
  isActive?: boolean;
  // When href is omitted the item renders as a disabled, non-interactive span.
  href?: string;
} & Pick<VariantProps<typeof buttonVariants>, "size"> &
  Omit<React.ComponentProps<typeof Link>, "href">;

function PaginationLink({
  className,
  isActive,
  size = "icon",
  href,
  children,
  ...props
}: PaginationLinkProps) {
  const classes = cn(
    buttonVariants({ variant: isActive ? "outline" : "ghost", size }),
    className,
  );

  if (!href) {
    return (
      <span
        aria-disabled="true"
        className={cn(classes, "pointer-events-none opacity-50")}
        data-slot="pagination-link"
      >
        {children}
      </span>
    );
  }

  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      className={classes}
      data-active={isActive}
      data-slot="pagination-link"
      href={href}
      {...props}
    >
      {children}
    </Link>
  );
}

function PaginationPrevious({
  className,
  ...props
}: Omit<PaginationLinkProps, "size">) {
  return (
    <PaginationLink
      aria-label="Go to previous page"
      className={cn("gap-1 px-2.5", className)}
      size="default"
      {...props}
    >
      <ChevronLeftIcon />
      <span>Previous</span>
    </PaginationLink>
  );
}

function PaginationNext({
  className,
  ...props
}: Omit<PaginationLinkProps, "size">) {
  return (
    <PaginationLink
      aria-label="Go to next page"
      className={cn("gap-1 px-2.5", className)}
      size="default"
      {...props}
    >
      <span>Next</span>
      <ChevronRightIcon />
    </PaginationLink>
  );
}

function PaginationLast({
  className,
  ...props
}: Omit<PaginationLinkProps, "size">) {
  return (
    <PaginationLink
      aria-label="Go to last page"
      className={cn("gap-1 px-2.5", className)}
      size="default"
      {...props}
    >
      <span>Last</span>
      <ChevronsRightIcon />
    </PaginationLink>
  );
}

function PaginationEllipsis({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden
      className={cn("flex size-8 items-center justify-center", className)}
      data-slot="pagination-ellipsis"
      {...props}
    >
      <MoreHorizontalIcon className="size-4" />
      <span className="sr-only">More pages</span>
    </span>
  );
}

export {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationLast,
  PaginationEllipsis,
};
