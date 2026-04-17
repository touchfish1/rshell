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

type FilterType = "all" | "connect" | "command" | "disconnect";

function mapEventType(eventType: string) {
  if (eventType.includes("disconnect")) return "disconnect";
  if (eventType.includes("connect")) return "connect";
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
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(href);
}

export default function AuditLogModal({ open, loading, records, tr, onClose, onRefresh }: Props) {
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [keyword, setKeyword] = useState("");

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

  const exportJson = () => {
    const filename = `audit-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    downloadTextFile(filename, JSON.stringify(rows, null, 2), "application/json;charset=utf-8");
  };

  const exportCsv = () => {
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
    const content = [header.join(","), ...lines].join("\n");
    const filename = `audit-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
    downloadTextFile(filename, content, "text/csv;charset=utf-8");
  };

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card audit-modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h4>{tr("home.auditTitle")}</h4>
          <div className="audit-modal-actions">
            <button className="btn btn-ghost" onClick={onRefresh} disabled={loading}>
              {tr("home.auditRefresh")}
            </button>
            <button className="modal-close" onClick={onClose} title={tr("modal.close")}>
              ×
            </button>
          </div>
        </div>
        <div className="audit-toolbar">
          <select value={filterType} onChange={(event) => setFilterType(event.target.value as FilterType)}>
            <option value="all">{tr("home.auditFilterAll")}</option>
            <option value="connect">{tr("home.auditFilterConnect")}</option>
            <option value="command">{tr("home.auditFilterCommand")}</option>
            <option value="disconnect">{tr("home.auditFilterDisconnect")}</option>
          </select>
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={tr("home.auditSearchPlaceholder")}
          />
        </div>
        <div className="audit-export-actions">
          <button className="btn btn-ghost" onClick={exportCsv} disabled={rows.length === 0}>
            {tr("home.auditExportCsv")}
          </button>
          <button className="btn btn-ghost" onClick={exportJson} disabled={rows.length === 0}>
            {tr("home.auditExportJson")}
          </button>
        </div>
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
      </div>
    </div>
  );
}
