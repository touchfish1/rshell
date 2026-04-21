import { useMemo, useState } from "react";
import type { I18nKey } from "../i18n";
import type { AuditRecord } from "../services/types";

interface Props {
  open: boolean;
  loading: boolean;
  records: AuditRecord[];
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
  onClose: () => void;
  onRefresh: () => void;
}

type FilterType = "all" | "connect" | "command" | "disconnect" | "control" | "zookeeper" | "redis" | "mysql" | "failed";
type ViewType = "list" | "report";

function mapEventType(eventType: string) {
  if (eventType.startsWith("zk_")) return "zookeeper";
  if (eventType.startsWith("redis_")) return "redis";
  if (eventType.startsWith("mysql_")) return "mysql";
  if (eventType.includes("failed")) return "failed";
  if (eventType.includes("disconnect")) return "disconnect";
  if (eventType.includes("connect")) return "connect";
  if (eventType === "control") return "control";
  if (eventType === "command") return "command";
  return "all";
}

function maskSensitiveCommand(input: string) {
  if (!input) return input;
  let text = input;
  text = text.replace(
    /\b(password|passwd|pwd|token|secret|api[_-]?key|access[_-]?key)\b\s*=\s*([^\s&"',}]+|"[^"]*"|'[^']*')/gi,
    "$1=***"
  );
  text = text.replace(
    /(["']?(password|passwd|pwd|token|secret|api[_-]?key|access[_-]?key)["']?\s*:\s*)("[^"]*"|'[^']*'|[^\s,}\]]+)/gi,
    '$1"***"'
  );
  const parts = text.split(/\s+/);
  const out: string[] = [];
  let nextMask = false;
  for (const part of parts) {
    if (!part) continue;
    if (nextMask) {
      out.push("***");
      nextMask = false;
      continue;
    }
    if (/^(-p|--p|--pw|--pwd|--password|--passwd|--token|--secret|--apikey|--api-key)$/i.test(part)) {
      out.push(part);
      nextMask = true;
      continue;
    }
    out.push(part);
  }
  return out.join(" ");
}

function downloadTextFile(filename: string, content: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.style.display = "none";
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  // Some WebView runtimes (including Tauri on Windows) may cancel
  // downloads if object URLs are revoked immediately.
  window.setTimeout(() => {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(href);
  }, 1200);
}

export default function AuditLogModal({ open, loading, records, tr, onClose, onRefresh }: Props) {
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [viewType, setViewType] = useState<ViewType>("list");
  const [keyword, setKeyword] = useState("");
  const [exporting, setExporting] = useState<"csv" | "json" | null>(null);
  const [exportResult, setExportResult] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const rows = useMemo(() => {
    const key = keyword.trim().toLowerCase();
    return records.filter((record) => {
      const type = mapEventType(record.event_type);
      if (filterType !== "all" && filterType !== type) return false;
      if (!key) return true;
      const content = `${record.session_name ?? ""} ${record.host ?? ""} ${record.command ?? ""} ${record.detail}`.toLowerCase();
      return content.includes(key);
    });
  }, [records, filterType, keyword]);

  const report = useMemo(() => {
    const counts: Record<string, number> = {};
    const hostCounts: Record<string, number> = {};
    const dailyCounts: Record<string, number> = {};
    for (const row of rows) {
      counts[row.event_type] = (counts[row.event_type] ?? 0) + 1;
      const host = (row.host ?? "-").trim() || "-";
      hostCounts[host] = (hostCounts[host] ?? 0) + 1;
      const day = new Date(row.timestamp_ms).toISOString().slice(0, 10);
      dailyCounts[day] = (dailyCounts[day] ?? 0) + 1;
    }
    const total = rows.length;
    const failed = rows.filter((row) => row.event_type.includes("failed")).length;
    const zk = rows.filter((row) => row.event_type.startsWith("zk_")).length;
    const redis = rows.filter((row) => row.event_type.startsWith("redis_")).length;
    const mysql = rows.filter((row) => row.event_type.startsWith("mysql_")).length;
    const topEvents = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    const topHosts = Object.entries(hostCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    const dailyTrend = Object.entries(dailyCounts).sort((a, b) => a[0].localeCompare(b[0]));
    return { total, failed, zk, redis, mysql, topEvents, topHosts, dailyTrend };
  }, [rows]);

  const makeTimestamp = () => {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  };

  const sanitizeFileSegment = (input: string) =>
    input
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9_-]/g, "")
      .slice(0, 24);

  const buildFilename = (ext: "csv" | "json") => {
    const parts = ["audit"];
    if (filterType !== "all") parts.push(filterType);
    const key = sanitizeFileSegment(keyword);
    if (key) parts.push(key);
    parts.push(makeTimestamp());
    return `${parts.join("-")}.${ext}`;
  };

  const buildCsvContent = () => {
    const header = ["time", "event_type", "session_name", "host", "command", "detail"];
    const escapeCsv = (value: string) => `"${value.replace(/"/g, "\"\"")}"`;
    const lines = rows.map((row) =>
      [
        new Date(row.timestamp_ms).toISOString(),
        row.event_type,
        row.session_name ?? "",
        row.host ?? "",
        row.command ?? "",
        row.detail ?? "",
      ]
        .map((value) => escapeCsv(value))
        .join(",")
    );
    return [header.join(","), ...lines].join("\n");
  };

  const exportRows = (format: "csv" | "json") => {
    if (!rows.length || exporting) return;
    setExporting(format);
    setExportResult(null);
    try {
      const filename = buildFilename(format);
      const content = format === "csv" ? buildCsvContent() : JSON.stringify(rows, null, 2);
      const contentType = format === "csv" ? "text/csv;charset=utf-8" : "application/json;charset=utf-8";
      downloadTextFile(filename, content, contentType);
      setExportResult({ kind: "success", text: tr("home.auditExportSuccess", { file: filename }) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setExportResult({ kind: "error", text: tr("home.auditExportFailed", { message }) });
    } finally {
      window.setTimeout(() => setExporting(null), 220);
    }
  };

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card audit-modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h4>{tr("home.auditTitle")}</h4>
          <div className="audit-modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onRefresh} disabled={loading}>
              {tr("home.auditRefresh")}
            </button>
            <button type="button" className="modal-close" onClick={onClose} title={tr("modal.close")}>
              ×
            </button>
          </div>
        </div>
        <div className="audit-modal-body">
          <div className="audit-toolbar">
            <select value={filterType} onChange={(event) => setFilterType(event.target.value as FilterType)}>
              <option value="all">{tr("home.auditFilterAll")}</option>
              <option value="connect">{tr("home.auditFilterConnect")}</option>
              <option value="command">{tr("home.auditFilterCommand")}</option>
              <option value="disconnect">{tr("home.auditFilterDisconnect")}</option>
              <option value="control">{tr("home.auditFilterControl" as I18nKey)}</option>
              <option value="zookeeper">{tr("home.auditFilterZookeeper")}</option>
              <option value="redis">{tr("home.auditFilterRedis")}</option>
              <option value="mysql">{tr("home.auditFilterMysql")}</option>
              <option value="failed">{tr("home.auditFilterFailed")}</option>
            </select>
            <input
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value);
                if (exportResult) setExportResult(null);
              }}
              placeholder={tr("home.auditSearchPlaceholder")}
            />
          </div>
          <div className="audit-view-switch">
            <button
              type="button"
              className={`btn btn-ghost ${viewType === "list" ? "is-active" : ""}`}
              onClick={() => setViewType("list")}
            >
              {tr("home.auditViewList")}
            </button>
            <button
              type="button"
              className={`btn btn-ghost ${viewType === "report" ? "is-active" : ""}`}
              onClick={() => setViewType("report")}
            >
              {tr("home.auditViewReport")}
            </button>
          </div>
          <div className="audit-export-actions">
            <div className="audit-export-meta">
              {rows.length === 0 && (filterType !== "all" || keyword.trim()) ? (
                <span className="audit-empty">{tr("home.auditEmptyWithFilter")}</span>
              ) : null}
              {exportResult ? (
                <span className={`audit-export-feedback ${exportResult.kind === "error" ? "is-error" : "is-success"}`}>
                  {exportResult.text}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setFilterType("all");
                setKeyword("");
                setExportResult(null);
              }}
              disabled={filterType === "all" && keyword.trim().length === 0}
            >
              {tr("home.auditClearFilters")}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => exportRows("csv")} disabled={rows.length === 0 || Boolean(exporting)}>
              {exporting === "csv" ? tr("home.auditExporting") : tr("home.auditExportCsv")}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => exportRows("json")}
              disabled={rows.length === 0 || Boolean(exporting)}
            >
              {exporting === "json" ? tr("home.auditExporting") : tr("home.auditExportJson")}
            </button>
          </div>
          {viewType === "list" ? (
            <div className="audit-list">
              {rows.length === 0 ? (
                <div className="audit-empty">{loading ? tr("sftp.loading") : tr("home.auditEmpty")}</div>
              ) : (
                rows.map((record) => (
                  <div key={record.id} className="audit-item">
                    <div className="audit-item-head">
                      <span>{new Date(record.timestamp_ms).toLocaleString()}</span>
                      <span>{record.event_type}</span>
                    </div>
                    <div className="audit-item-main">
                      <span>{record.session_name ?? "-"}</span>
                      <span>{record.host ?? "-"}</span>
                    </div>
                    {record.command ? <div className="audit-command">{maskSensitiveCommand(record.command)}</div> : null}
                    <div className="audit-detail">{record.detail}</div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="audit-report">
              <div className="audit-report-cards">
                <div className="audit-report-card">
                  <div className="audit-report-label">{tr("home.auditReportTotal")}</div>
                  <div className="audit-report-value">{report.total}</div>
                </div>
                <div className="audit-report-card">
                  <div className="audit-report-label">{tr("home.auditReportFailed")}</div>
                  <div className="audit-report-value">{report.failed}</div>
                </div>
                <div className="audit-report-card">
                  <div className="audit-report-label">{tr("home.auditReportZookeeper")}</div>
                  <div className="audit-report-value">{report.zk}</div>
                </div>
                <div className="audit-report-card">
                  <div className="audit-report-label">{tr("home.auditReportRedis")}</div>
                  <div className="audit-report-value">{report.redis}</div>
                </div>
                <div className="audit-report-card">
                  <div className="audit-report-label">{tr("home.auditReportMysql")}</div>
                  <div className="audit-report-value">{report.mysql}</div>
                </div>
              </div>
              <div className="audit-report-grid">
                <section className="audit-report-panel">
                  <h5>{tr("home.auditReportTopEvents")}</h5>
                  {report.topEvents.length === 0 ? (
                    <div className="audit-empty">{tr("home.auditEmpty")}</div>
                  ) : (
                    report.topEvents.map(([name, count]) => (
                      <div className="audit-report-row" key={name}>
                        <span>{name}</span>
                        <span>{count}</span>
                      </div>
                    ))
                  )}
                </section>
                <section className="audit-report-panel">
                  <h5>{tr("home.auditReportTopHosts")}</h5>
                  {report.topHosts.length === 0 ? (
                    <div className="audit-empty">{tr("home.auditEmpty")}</div>
                  ) : (
                    report.topHosts.map(([name, count]) => (
                      <div className="audit-report-row" key={name}>
                        <span>{name}</span>
                        <span>{count}</span>
                      </div>
                    ))
                  )}
                </section>
                <section className="audit-report-panel">
                  <h5>{tr("home.auditReportDailyTrend")}</h5>
                  {report.dailyTrend.length === 0 ? (
                    <div className="audit-empty">{tr("home.auditEmpty")}</div>
                  ) : (
                    report.dailyTrend.map(([date, count]) => (
                      <div className="audit-report-row" key={date}>
                        <span>{date}</span>
                        <span>{count}</span>
                      </div>
                    ))
                  )}
                </section>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
