import Link from "next/link";
import type { ReactNode } from "react";
import { buildPaginatedHref, getVisiblePageNumbers, type PaginationQueryValue } from "@/lib/pagination";
import styles from "./DirectoryPagination.module.css";

export type DirectoryPaginationProps = {
  pathname: string;
  page: number;
  totalPages: number;
  query?: Record<string, PaginationQueryValue>;
  anchor?: string;
  className?: string;
  ariaLabel?: string;
};

export function DirectoryPagination({
  pathname,
  page,
  totalPages,
  query = {},
  anchor,
  className,
  ariaLabel = "目录分页"
}: DirectoryPaginationProps) {
  if (totalPages <= 1) return null;

  const pages = getVisiblePageNumbers(page, totalPages);
  const link = (target: number, label: ReactNode, title: string, extraClass?: string) => (
    <Link
      aria-label={title}
      className={[styles.link, extraClass].filter(Boolean).join(" ")}
      href={buildPaginatedHref(pathname, target, query, anchor)}
      scroll={anchor ? true : undefined}
    >
      {label}
    </Link>
  );

  return (
    <nav aria-label={ariaLabel} className={[styles.pagination, className].filter(Boolean).join(" ")} data-testid="directory-pagination">
      <div className={styles.controls}>
        {page > 1 ? link(1, "首页", "前往第一页", styles.edge) : <span className={`${styles.link} ${styles.edge} ${styles.disabled}`} aria-disabled="true">首页</span>}
        {page > 1 ? link(page - 1, "上一页", "前往上一页") : <span className={`${styles.link} ${styles.disabled}`} aria-disabled="true">上一页</span>}
        <span className={styles.numbers}>
          {pages.map((item) => item === page
            ? <span aria-current="page" className={`${styles.link} ${styles.current}`} key={item}>{item}</span>
            : <span key={item}>{link(item, item, `前往第 ${item} 页`)}</span>)}
        </span>
        {page < totalPages ? link(page + 1, "下一页", "前往下一页") : <span className={`${styles.link} ${styles.disabled}`} aria-disabled="true">下一页</span>}
        {page < totalPages ? link(totalPages, "末页", "前往最后一页", styles.edge) : <span className={`${styles.link} ${styles.edge} ${styles.disabled}`} aria-disabled="true">末页</span>}
      </div>
      <p className={styles.summary}>第 {page} / {totalPages} 页</p>
    </nav>
  );
}
