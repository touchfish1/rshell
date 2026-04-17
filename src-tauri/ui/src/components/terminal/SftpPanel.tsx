import { useEffect, useState } from "react";
import type { HostMetrics, SftpEntry } from "../../services/types";
import { formatBytes, formatMtime, formatSize } from "./formatters";

interface Props {
  activeHostLabel: string;
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
  const [menu, setMenu] = useState<{ x: number; y: number; path: string } | null>(null);

  useEffect(() => {
    const closeMenu = () => setMenu(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  const normalizedPath = sftpPath === "." ? "/" : sftpPath;
  const canGoUp = normalizedPath !== "/";

  const getDisplayName = (entry: SftpEntry) => {
    if (entry.name && entry.name.trim()) return entry.name;
    const normalized = entry.path.replace(/\\/g, "/").replace(/\/+$/, "");
    const fallback = normalized.split("/").pop();
    return fallback && fallback.trim() ? fallback : "(unnamed)";
  };

  return (
    <aside className="terminal-sftp">
      <div className="sftp-monitor-card">
        <div className="sftp-monitor-head">
          <span>主机监控</span>
          <button onClick={onRefreshMetrics} disabled={!monitorSupported || monitorChecking}>
            {monitorChecking ? "刷新中..." : "刷新"}
          </button>
        </div>
        <div className="sftp-monitor-host">{activeHostLabel || "未连接会话"}</div>
        {monitorError ? <div className="sftp-monitor-error">{monitorError}</div> : null}
        <div className="sftp-monitor-row">
          <span>CPU</span>
          <span>{monitorMetrics ? `${monitorMetrics.cpu_percent.toFixed(1)}%` : "-"}</span>
        </div>
        <div className="sftp-monitor-bar">
          <i style={{ width: `${monitorMetrics ? monitorMetrics.cpu_percent.toFixed(1) : 0}%` }} />
        </div>
        <div className="sftp-monitor-row">
          <span>内存</span>
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
          <span>磁盘</span>
          <span>
            {monitorMetrics
              ? `${formatBytes(monitorMetrics.disk_used_bytes)} / ${formatBytes(monitorMetrics.disk_total_bytes)}`
              : "-"}
          </span>
        </div>
        <div className="sftp-monitor-bar">
          <i style={{ width: `${monitorMetrics ? monitorMetrics.disk_percent.toFixed(1) : 0}%` }} />
        </div>
        <div className="sftp-monitor-time">最近更新：{monitorCheckedAt || "-"}</div>
      </div>

      <div className="sftp-file-list">
        <div className="panel-title">SFTP 文件列表</div>
        <div className="sftp-toolbar">
          <button onClick={onSftpUp} disabled={!canGoUp}>
            上级
          </button>
          <span className="sftp-path" title={normalizedPath}>
            {normalizedPath}
          </span>
        </div>
        <div className="sftp-head">
          <span>名称</span>
          <span>大小</span>
          <span>修改时间</span>
        </div>
        <ul>
          {sftpLoading ? (
            <li className="sftp-empty">加载中...</li>
          ) : sftpEntries.length === 0 ? (
            <li className="sftp-empty">目录为空或无权限</li>
          ) : (
            <>
              {canGoUp ? (
                <li className="sftp-row">
                  <button className="sftp-dir sftp-parent" onClick={onSftpUp} title="返回上一级目录">
                    <span className="sftp-col-name">
                      <span className="sftp-kind-icon folder">📁</span>
                      <span className="sftp-name-text">..</span>
                    </span>
                    <span className="sftp-col-size">-</span>
                    <span className="sftp-col-time">上一级</span>
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
            下载文件
          </button>
        </div>
      ) : null}
    </aside>
  );
}

