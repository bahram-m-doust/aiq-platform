import type { ReactNode } from "react";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Render next/link as a plain anchor so we can assert the resolved href.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { PaginationControls } from "@/components/PaginationControls";

describe("PaginationControls", () => {
  const pagination = {
    page: 2,
    pageSize: 25,
    hasPreviousPage: true,
    hasNextPage: true,
  };

  it("preserves filter params (e.g. brand_id) across page links", () => {
    render(
      <PaginationControls
        basePath="/admin/documents"
        pagination={pagination}
        params={{ brand_id: "brand-1" }}
      />,
    );

    expect(
      screen.getByRole("link", { name: /next/i }).getAttribute("href"),
    ).toBe("/admin/documents?brand_id=brand-1&page=3");
    // Page 1 omits the page param by convention, but the filter is kept.
    expect(
      screen.getByRole("link", { name: /previous/i }).getAttribute("href"),
    ).toBe("/admin/documents?brand_id=brand-1");
  });

  it("keeps existing param-less callers unchanged", () => {
    render(
      <PaginationControls basePath="/admin/audit" pagination={pagination} />,
    );

    expect(
      screen.getByRole("link", { name: /next/i }).getAttribute("href"),
    ).toBe("/admin/audit?page=3");
  });

  it("drops undefined filter values", () => {
    render(
      <PaginationControls
        basePath="/admin/documents"
        pagination={pagination}
        params={{ brand_id: undefined }}
      />,
    );

    expect(
      screen.getByRole("link", { name: /next/i }).getAttribute("href"),
    ).toBe("/admin/documents?page=3");
  });
});
