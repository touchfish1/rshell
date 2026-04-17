import { useEffect, useState } from "react";
import type { HostMetrics, SftpEntry } from "../../services/types";
import { formatBytes, formatMtime, formatSize } from "./formatters";
import { useI18n } from "../../i18n-context";

interface Props {
  activeHostLabel: string;
  activeHostIp?: string;
  monitorSupported: boolean;
  monitorMetrics: HostMetrics | null;
  monitorError: string | null;
  monitorChecking: boolean;
  monitorCheckedAt: string;
  onRefreshMetrics: () => void;

  sftpEntries: SftpEntry[];
  sftpPath: string;
  sftpLoading: boolean;
  onSftpUp: () => void;
  onSftpOpenDir: (path: string) => void;
  onSftpDownload: (path: string) => void;
}

export function SftpPanel({
  activeHostLabel,
  activeHostIp,
  monitorSupported,
  monitorMetrics,
  monitorError,
  monitorChecking,
  monitorCheckedAt,
  onRefreshMetrics,
  sftpEntries,
  sftpPath,
  sftpLoading,
  onSftpUp,
  onSftpOpenDir,
  onSftpDownload,
}: Props) {
  const { tr } = useI18n();
  const [menu, setMenu] = useState<{ x: number; y: number; path: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyTimer, setCopyTimer] = useState<number | null>(null);
  const copyHostIp = async () => {
    if (!activeHostIp) return;
    try {
      await navigator.clipboard.writeText(activeHostIp);
      setCopied(true);
      if (copyTimer) window.clearTimeout(copyTimer);
      const timer = window.setTimeout(() => {
        setCopied(false);
        setCopyTimer(null);
      }, 1500);
      setCopyTimer(timer);
    } catch {
      // Ignore clipboard failures to keep monitor interactions lightweight.
    }
  };

  useEffect(() => {
    const closeMenu = () => setMenu(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  useEffect(() => {
    return () => {
      if (copyTimer) window.clearTimeout(copyTimer);
    };
  }, [copyTimer]);

  const normalizedPath = sftpPath === "." ? "/" : sftpPath;
  const canGoUp = normalizedPath !== "/";

  const getDisplayName = (entry: SftpEntry) => {
    if (entry.name && entry.name.trim()) return entry.name;
    const normalized = entry.path.replace(/\\/g, "/").replace(/\/+$/, "");
    const fallback = normalized.split("/").pop();
    return fallback && fallback.trim() ? fallback : tr("sftp.unnamed");
  };

  return (
    <aside className="terminal-sftp">
      <div className="sftp-monitor-card">
        <div className="sftp-monitor-head">
          <span>{tr("sftp.hostMonitor")}</span>
          <button onClick={onRefreshMetrics} disabled={!monitorSupported || monitorChecking}>
            {monitorChecking ? tr("sftp.refreshing") : tr("sftp.refresh")}
          </button>
        </div>
        <div className="sftp-monitor-host">
          <span>{activeHostLabel || tr("sftp.notConnected")}</span>
          {activeHostIp ? (
            <button
              className="copy-icon-btn"
              type="button"
              title={tr("sftp.copyIp")}
              aria-label={tr("sftp.copyIp")}
              onClick={copyHostIp}
            >
              {copied ? "✅" : "📋"}
            </button>
          ) : null}
          {copied ? <span className="copy-success-text">{tr("sftp.copied")}</span> : null}
        </div>
        {monitorError ? <div className="sftp-monitor-error">{monitorError}</div> : null}
        <div className="sftp-monitor-row">
          <span>{tr("sftp.cpu")}</span>
          <span>{monitorMetrics ? `${monitorMetrics.cpu_percent.toFixed(1)}%` : "-"}</span>
        </div>
        <div className="sftp-monitor-bar">
          <i style={{ width: `${monitorMetrics ? monitorMetrics.cpu_percent.toFixed(1) : 0}%` }} />
        </div>
        <div className="sftp-monitor-row">
          <span>{tr("sftp.memory")}</span>
          <span>
            {monitorMetrics
              ? `${formatBytes(monitorMetrics.memory_used_bytes)} / ${formatBytes(monitorMetrics.memory_total_bytes)}`
              : "-"}
          </span>
        </div>
        <div className="sftp-monitor-bar">
          <i style={{ width: `${monitorMetrics ? monitorMetrics.memory_percent.toFixed(1) : 0}%` }} />
        </div>
        <div className="sftp-monitor-row">
          <span>{tr("sftp.disk")}</span>
          <span>
            {monitorMetrics
              ? `${formatBytes(monitorMetrics.disk_used_bytes)} / ${formatBytes(monitorMetrics.disk_total_bytes)}`
              : "-"}
          </span>
        </div>
        <div className="sftp-monitor-bar">
          <i style={{ width: `${monitorMetrics ? monitorMetrics.disk_percent.toFixed(1) : 0}%` }} />
        </div>
        <div className="sftp-monitor-time">{tr("sftp.lastUpdated", { time: monitorCheckedAt || "-" })}</div>
      </div>

      <div className="sftp-file-list">
        <div className="panel-title">{tr("sftp.fileList")}</div>
        <div className="sftp-toolbar">
          <button onClick={onSftpUp} disabled={!canGoUp}>
            {tr("sftp.up")}
          </button>
          <span className="sftp-path" title={normalizedPath}>
            {normalizedPath}
          </span>
        </div>
        <div className="sftp-head">
          <span>{tr("sftp.fileName")}</span>
          <span>{tr("sftp.fileSize")}</span>
          <span>{tr("sftp.modifiedAt")}</span>
        </div>
        <ul>
          {sftpLoading ? (
            <li className="sftp-empty">{tr("sftp.loading")}</li>
          ) : sftpEntries.length === 0 ? (
            <li className="sftp-empty">{tr("sftp.emptyOrNoPermission")}</li>
          ) : (
            <>
              {canGoUp ? (
                <li className="sftp-row">
                  <button className="sftp-dir sftp-parent" onClick={onSftpUp} title={tr("sftp.backToParent")}>
                    <span className="sftp-col-name">
                      <span className="sftp-kind-icon folder">📁</span>
                      <span className="sftp-name-text">..</span>
                    </span>
                    <span className="sftp-col-size">-</span>
                    <span className="sftp-col-time">{tr("sftp.parent")}</span>
                  </button>
                </li>
              ) : null}
              {sftpEntries.map((entry) => (
                <li key={`${entry.path}:${entry.name}`} className="sftp-row">
                  <button
                    className={entry.is_dir ? "sftp-dir" : "sftp-file"}
                    onClick={() => entry.is_dir && onSftpOpenDir(entry.path)}
                    onContextMenu={(e) => {
                      if (entry.is_dir) return;
                      e.preventDefault();
                      e.stopPropagation();
                      setMenu({ x: e.clientX, y: e.clientY, path: entry.path });
                    }}
                    title={entry.path}
                  >
                    <span className="sftp-col-name">
                      <span className={`sftp-kind-icon ${entry.is_dir ? "folder" : "file"}`}>
                        {entry.is_dir ? "📁" : "📄"}
                      </span>
                      <span className="sftp-name-text">{getDisplayName(entry)}</span>
                    </span>
                    <span className="sftp-col-size">{entry.is_dir ? "-" : formatSize(entry.size)}</span>
                    <span className="sftp-col-time">{formatMtime(entry.mtime)}</span>
                  </button>
                </li>
              ))}
            </>
          )}
        </ul>
      </div>

      {menu ? (
        <div className="sftp-context-menu" style={{ left: menu.x, top: menu.y }}>
          <button
            onClick={() => {
              onSftpDownload(menu.path);
              setMenu(null);
            }}
          >
            {tr("sftp.downloadFile")}
          </button>
        </div>
      ) : null}
    </aside>
  );
}

