export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export type PaginationInput = {
  page?: unknown;
  pageSize?: unknown;
};

export type SupabaseRange = {
  page: number;
  pageSize: number;
  from: number;
  to: number;
};

export type PaginationState = {
  page: number;
  pageSize: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

function firstValue(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

function toNumber(value: unknown) {
  const first = firstValue(value);

  if (typeof first === "number") {
    return first;
  }

  if (typeof first === "string" && first.trim()) {
    return Number(first);
  }

  return Number.NaN;
}

export function clampPage(value: unknown = 1) {
  const parsed = toNumber(value);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return Math.floor(parsed);
}

export function clampPageSize(value: unknown = DEFAULT_PAGE_SIZE) {
  const parsed = toNumber(value);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(MAX_PAGE_SIZE, Math.floor(parsed));
}

export function toSupabaseRange(input: PaginationInput = {}): SupabaseRange {
  const page = clampPage(input.page);
  const pageSize = clampPageSize(input.pageSize);
  const from = (page - 1) * pageSize;

  return {
    page,
    pageSize,
    from,
    to: from + pageSize - 1,
  };
}

export function paginationInputFromSearchParams(
  searchParams: Record<string, string | string[] | undefined> = {},
): PaginationInput {
  return {
    page: searchParams.page,
    pageSize: searchParams.pageSize,
  };
}

export function paginatedRows<T>(rows: T[], range: SupabaseRange) {
  const hasNextPage = rows.length > range.pageSize;

  return {
    rows: hasNextPage ? rows.slice(0, range.pageSize) : rows,
    pagination: {
      page: range.page,
      pageSize: range.pageSize,
      hasPreviousPage: range.page > 1,
      hasNextPage,
    } satisfies PaginationState,
  };
}
