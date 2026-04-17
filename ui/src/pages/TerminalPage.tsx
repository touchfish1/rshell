import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Session, SftpEntry } from "../services/types";

interface TerminalTab {
  id: string;
  sessionId: string;
  title: string;
}

interface Props {
  sessions: Session[];
  activeTabId?: string;
  tabs: TerminalTab[];
  connectedIds: string[];
  error: string | null;
  status: string;
  terminals: Array<{ id: string; node: ReactNode }>;
  sftpEntries: SftpEntry[];
  sftpPath: string;
  sftpLoading: boolean;
  onOpenSession: (id: string) => void;
  onSwitchTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onSftpOpenDir: (path: string) => void;
  onSftpUp: () => void;
  onBackToHome: () => void;
  onDisconnect: (id?: string) => void;
}

export default function TerminalPage({
  sessions,
  activeTabId,
  tabs,
  connectedIds,
  error,
  status,
  terminals,
  sftpEntries,
  sftpPath,
  sftpLoading,
  onOpenSession,
  onSwitchTab,
  onCloseTab,
  onSftpOpenDir,
  onSftpUp,
  onBackToHome,
  onDisconnect,
}: Props) {
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    type: "hosts" | "sftp";
    startX: number;
    startHosts: number;
    startSftp: number;
  } | null>(null);
  const [hostsWidth, setHostsWidth] = useState(240);
  const [sftpWidth, setSftpWidth] = useState(320);
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const activeSession = sessions.find((s) => s.id === activeTab?.sessionId);
  const getDisplayName = (entry: SftpEntry) => {
    if (entry.name && entry.name.trim()) return entry.name;
    const normalized = entry.path.replace(/\\/g, "/").replace(/\/+$/, "");
    const fallback = normalized.split("/").pop();
    return fallback && fallback.trim() ? fallback : "(unnamed)";
  };
  const clampWidths = (nextHosts: number, nextSftp: number) => {
    const rect = workspaceRef.current?.getBoundingClientRect();
    const total = rect?.width ?? window.innerWidth;
    const minHosts = 170;
    const maxHosts = Math.max(320, total * 0.4);
    const minSftp = 220;
    const maxSftp = Math.max(420, total * 0.55);
    return {
      hosts: Math.max(minHosts, Math.min(maxHosts, nextHosts)),
      sftp: Math.max(minSftp, Math.min(maxSftp, nextSftp)),
    };
  };
  const onDragStart = (type: "hosts" | "sftp", clientX: number) => {
    dragRef.current = {
      type,
      startX: clientX,
      startHosts: hostsWidth,
      startSftp: sftpWidth,
    };
  };

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const delta = event.clientX - drag.startX;
      if (drag.type === "hosts") {
        const next = clampWidths(drag.startHosts + delta, sftpWidth);
        setHostsWidth(next.hosts);
      } else {
        const next = clampWidths(hostsWidth, drag.startSftp - delta);
        setSftpWidth(next.sftp);
      }
    };
    const onMouseUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [hostsWidth, sftpWidth]);

  const workspaceStyle = {
    "--host-width": `${hostsWidth}px`,
    "--sftp-width": `${sftpWidth}px`,
  } as CSSProperties;
  const formatSize = (size: number) => {
    if (!size || size <= 0) return "-";
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };
  const formatMtime = (mtime: number) => {
    if (!mtime) return "-";
    return new Date(mtime * 1000).toLocaleString();
  };

  return (
    <section className="workspace terminal-page">
      <header className="terminal-top">
        <h2>{activeSession?.name ?? "Terminal Workspace"}</h2>
        <div className="actions">
          <button onClick={onBackToHome}>Back</button>
          <button disabled={!activeTabId} onClick={() => onDisconnect(activeTabId)}>
            Disconnect
          </button>
        </div>
      </header>
      <div className="session-tabs">
        {tabs.length === 0 ? (
          <div className="session-tab-empty">暂无打开的会话，点击左侧主机连接</div>
        ) : (
          tabs.map((tab) => {
            const active = tab.id === activeTabId;
            const connected = connectedIds.includes(tab.sessionId);
            return (
              <div key={tab.id} className={`session-tab ${active ? "active" : ""}`}>
                <button className="session-tab-main" onClick={() => onSwitchTab(tab.id)}>
                  {tab.title}
                  <span className={`session-dot ${connected ? "on" : "off"}`} />
                </button>
                <button className="session-tab-close" onClick={() => onCloseTab(tab.id)} title="关闭标签">
                  ×
                </button>
              </div>
            );
          })
        )}
      </div>
      <div className="terminal-error-slot">{error ? <div className="error-banner">{error}</div> : null}</div>
      <div className="terminal-workspace" ref={workspaceRef} style={workspaceStyle}>
        <aside className="terminal-hosts">
          <div className="panel-title">主机列表</div>
          <ul>
            {sessions.map((session) => {
              const hasActiveTab = activeTab?.sessionId === session.id;
              return (
                <li key={session.id}>
                  <button
                    className={hasActiveTab ? "active" : ""}
                    onClick={() => onOpenSession(session.id)}
                    title="打开或切换到该会话"
                  >
                    {session.name}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
        <div
          className="terminal-splitter"
          role="separator"
          aria-label="调整主机列表宽度"
          onMouseDown={(e) => onDragStart("hosts", e.clientX)}
        />

        <div className="terminal-main">
          {terminals.map((pane) => (
            <div
              key={pane.id}
              className={`terminal-pane-slot ${pane.id === activeTabId ? "active" : ""}`}
              aria-hidden={pane.id !== activeTabId}
            >
              {pane.node}
            </div>
          ))}
        </div>
        <div
          className="terminal-splitter"
          role="separator"
          aria-label="调整文件列表宽度"
          onMouseDown={(e) => onDragStart("sftp", e.clientX)}
        />

        <aside className="terminal-sftp">
          <div className="panel-title">SFTP 文件列表</div>
          <div className="sftp-toolbar">
            <button onClick={onSftpUp} disabled={sftpPath === "."}>
              上级
            </button>
            <span className="sftp-path" title={sftpPath}>
              {sftpPath}
            </span>
          </div>
          <div className="sftp-head">
            <span>名称</span>
            <span>类型</span>
            <span>大小</span>
            <span>修改时间</span>
          </div>
          <ul>
            {sftpLoading ? (
              <li className="sftp-empty">加载中...</li>
            ) : sftpEntries.length === 0 ? (
              <li className="sftp-empty">目录为空或无权限</li>
            ) : (
              sftpEntries.map((entry) => (
                <li key={`${entry.path}:${entry.name}`} className="sftp-row">
                  <button
                    className={entry.is_dir ? "sftp-dir" : "sftp-file"}
                    onClick={() => entry.is_dir && onSftpOpenDir(entry.path)}
                    disabled={!entry.is_dir}
                    title={entry.path}
                  >
                    <span className="sftp-col-name">
                      <span className="sftp-kind-icon">{entry.is_dir ? "▸" : "•"}</span>
                      <span className="sftp-name-text">{getDisplayName(entry)}</span>
                    </span>
                    <span className="sftp-col-type">{entry.is_dir ? "目录" : "文件"}</span>
                    <span className="sftp-col-size">{entry.is_dir ? "-" : formatSize(entry.size)}</span>
                    <span className="sftp-col-time">{formatMtime(entry.mtime)}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </aside>
      </div>
      <footer>{status}</footer>
    </section>
  );
}
