import { describe, expect, it } from "vitest";

import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  clampPage,
  clampPageSize,
  paginatedRows,
  toSupabaseRange,
} from "@/lib/pagination";

describe("pagination helpers", () => {
  it("falls back to page 1 for invalid page values", () => {
    expect(clampPage("0")).toBe(1);
    expect(clampPage("-2")).toBe(1);
    expect(clampPage("not-a-page")).toBe(1);
    expect(clampPage(["3"])).toBe(3);
  });

  it("clamps page size to the configured maximum", () => {
    expect(clampPageSize("0")).toBe(DEFAULT_PAGE_SIZE);
    expect(clampPageSize("not-a-size")).toBe(DEFAULT_PAGE_SIZE);
    expect(clampPageSize(String(MAX_PAGE_SIZE + 50))).toBe(MAX_PAGE_SIZE);
    expect(clampPageSize("12")).toBe(12);
  });

  it("calculates Supabase ranges from one-based page numbers", () => {
    expect(toSupabaseRange({ page: 1, pageSize: 25 })).toEqual({
      page: 1,
      pageSize: 25,
      from: 0,
      to: 24,
    });
    expect(toSupabaseRange({ page: 3, pageSize: 10 })).toEqual({
      page: 3,
      pageSize: 10,
      from: 20,
      to: 29,
    });
  });

  it("uses one lookahead row to detect the next page", () => {
    const range = toSupabaseRange({ page: 2, pageSize: 2 });
    const result = paginatedRows(["a", "b", "c"], range);

    expect(result.rows).toEqual(["a", "b"]);
    expect(result.pagination).toEqual({
      page: 2,
      pageSize: 2,
      hasPreviousPage: true,
      hasNextPage: true,
    });
  });
});
