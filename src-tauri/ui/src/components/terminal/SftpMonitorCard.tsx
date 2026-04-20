import type { HostMetrics } from "../../services/types";
import type { I18nKey } from "../../i18n";
import { formatBytes } from "./formatters";

interface Props {
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
  activeHostLabel: string;
  activeHostIp?: string;
  monitorSupported: boolean;
  monitorMetrics: HostMetrics | null;
  monitorError: string | null;
  monitorChecking: boolean;
  monitorCheckedAt: string;
  copied: boolean;
  onCopyHostIp: () => void;
  onRefreshMetrics: () => void;
}

export function SftpMonitorCard({
  tr,
  activeHostLabel,
  activeHostIp,
  monitorSupported,
  monitorMetrics,
  monitorError,
  monitorChecking,
  monitorCheckedAt,
  copied,
  onCopyHostIp,
  onRefreshMetrics,
}: Props) {
  return (
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
            onClick={onCopyHostIp}
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
          {monitorMetrics ? `${formatBytes(monitorMetrics.memory_used_bytes)} / ${formatBytes(monitorMetrics.memory_total_bytes)}` : "-"}
        </span>
      </div>
      <div className="sftp-monitor-bar">
        <i style={{ width: `${monitorMetrics ? monitorMetrics.memory_percent.toFixed(1) : 0}%` }} />
      </div>
      <div className="sftp-monitor-row">
        <span>{tr("sftp.disk")}</span>
        <span>
          {monitorMetrics ? `${formatBytes(monitorMetrics.disk_used_bytes)} / ${formatBytes(monitorMetrics.disk_total_bytes)}` : "-"}
        </span>
      </div>
      <div className="sftp-monitor-bar">
        <i style={{ width: `${monitorMetrics ? monitorMetrics.disk_percent.toFixed(1) : 0}%` }} />
      </div>
      <div className="sftp-monitor-time">{tr("sftp.lastUpdated", { time: monitorCheckedAt || "-" })}</div>
    </div>
  );
}
