export const PUBLIC_DIRECTORY_PAGE_SIZE = 9;

export type PageInput = string | number | null | undefined;
export type PaginationQueryValue = string | number | null | undefined;

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export function parsePageNumber(value: PageInput): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function paginateItems<T>(
  items: readonly T[],
  requestedPage?: PageInput,
  pageSize = PUBLIC_DIRECTORY_PAGE_SIZE
): PaginatedResult<T> {
  if (!Number.isSafeInteger(pageSize) || pageSize <= 0) {
    throw new RangeError("pageSize must be a positive safe integer");
  }

  const total = items.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const page = totalPages === 0 ? 1 : Math.min(parsePageNumber(requestedPage), totalPages);
  const start = (page - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    totalPages
  };
}

export function getVisiblePageNumbers(page: number, totalPages: number, maxVisible = 5): number[] {
  if (!Number.isSafeInteger(totalPages) || totalPages <= 0) return [];
  if (!Number.isSafeInteger(maxVisible) || maxVisible <= 0) return [];

  const currentPage = Math.min(Math.max(parsePageNumber(page), 1), totalPages);
  const count = Math.min(maxVisible, totalPages);
  const half = Math.floor(count / 2);
  let start = Math.max(1, currentPage - half);
  const end = Math.min(totalPages, start + count - 1);
  start = Math.max(1, end - count + 1);

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

export function buildPaginatedHref(
  pathname: string,
  page: number,
  query: Record<string, PaginationQueryValue> = {},
  anchor?: string
) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (key !== "page" && value !== undefined && value !== null && String(value).trim()) {
      params.set(key, String(value));
    }
  });
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return `${pathname}${search ? `?${search}` : ""}${anchor ? `#${anchor}` : ""}`;
}
