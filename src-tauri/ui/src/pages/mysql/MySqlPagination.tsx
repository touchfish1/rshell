import { useState, type KeyboardEvent } from "react";
import type { I18nKey } from "../../i18n";

interface Props {
  page: number;
  pageSize: number;
  totalRows: number;
  loading: boolean;
  summary?: string;
  hasMore?: boolean;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
  onPrevPage: () => void;
  onNextPage: () => void;
  onGoToPage: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function MySqlPagination({
  page,
  pageSize,
  totalRows,
  loading,
  summary,
  hasMore,
  tr,
  onPrevPage,
  onNextPage,
  onGoToPage,
  onPageSizeChange,
}: Props) {
  const [jumpPage, setJumpPage] = useState("");

  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const atLastPage = (page + 1) * pageSize >= totalRows;

  const triggerJump = (raw: string) => {
    const num = Number.parseInt(raw, 10);
    if (!Number.isFinite(num)) return;
    const target = Math.min(totalPages, Math.max(1, num));
    setJumpPage(String(target));
    if (target - 1 !== page) {
      onGoToPage(target - 1);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    triggerJump(jumpPage);
  };

  return (
    <div className="mysql-table-pagination">
      <span className="mysql-data-summary mysql-table-pagination-summary">
        {summary ?? `${tr("mysql.page.tablePageSummary", { page: page + 1, rows: Math.min(pageSize, totalRows - page * pageSize), pageSize })}`}
      </span>
      <select
        className="mysql-field mysql-select mysql-table-page-size"
        value={pageSize}
        onChange={(event) => onPageSizeChange(Number(event.target.value))}
      >
        {[50, 100, 200, 500, 1000].map((size) => (
          <option key={size} value={size}>
            {tr("mysql.page.perPage", { size })}
          </option>
        ))}
      </select>
      <button
        className="btn btn-ghost mysql-table-page-btn"
        disabled={page <= 0 || loading}
        onClick={onPrevPage}
      >
        {tr("mysql.page.prevPage")}
      </button>
      <span className="mysql-table-empty mysql-table-pagination-text">
        {page + 1} / {totalPages}
      </span>
      <input
        className="mysql-field mysql-table-page-jump"
        type="number"
        min={1}
        max={totalPages}
        value={jumpPage}
        onChange={(event) => setJumpPage(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tr("mysql.page.pagePlaceholder")}
      />
      <button
        className="btn btn-ghost mysql-table-page-btn"
        onClick={() => triggerJump(jumpPage)}
      >
        {tr("mysql.page.jump")}
      </button>
      <button
        className="btn btn-ghost mysql-table-page-btn"
        disabled={(atLastPage && !hasMore) || loading}
        onClick={onNextPage}
      >
        {tr("mysql.page.nextPage")}
      </button>
    </div>
  );
}
