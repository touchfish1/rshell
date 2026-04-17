import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { HostMetrics, Protocol, Session, SessionInput, SftpEntry } from "../services/types";

interface TerminalTab {
  id: string;
  sessionId: string;
  title: string;
}

interface Props {
  sessions: Session[];
  selectedId?: string;
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
  onDuplicateTab: (id: string) => void;
  onSelectSession: (id: string) => void;
  onSwitchTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onCloseTabsToLeft: (id: string) => void;
  onCloseTabsToRight: (id: string) => void;
  onCloseOtherTabs: (id: string) => void;
  onSftpOpenDir: (path: string) => void;
  onSftpUp: () => void;
  onSftpDownload: (path: string) => void;
  onBackToHome: () => void;
  onDisconnect: (id?: string) => void;
  onUpdateHost: (id: string, input: SessionInput, secret?: string) => Promise<void>;
  onGetHostMetrics: (session: Session) => Promise<HostMetrics>;
}

export default function TerminalPage({
  sessions,
  selectedId,
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
  onDuplicateTab,
  onSelectSession,
  onSwitchTab,
  onCloseTab,
  onCloseTabsToLeft,
  onCloseTabsToRight,
  onCloseOtherTabs,
  onSftpOpenDir,
  onSftpUp,
  onSftpDownload,
  onBackToHome,
  onDisconnect,
  onUpdateHost,
  onGetHostMetrics,
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
  const [menu, setMenu] = useState<{ x: number; y: number; path: string } | null>(null);
  const [tabMenu, setTabMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);
  const [hostMenu, setHostMenu] = useState<{ x: number; y: number; session: Session } | null>(null);
  const [editHost, setEditHost] = useState<Session | null>(null);
  const [editForm, setEditForm] = useState<SessionInput>({
    name: "",
    protocol: "ssh",
    host: "",
    port: 22,
    username: "",
    encoding: "utf-8",
    keepalive_secs: 30,
  });
  const [editSecret, setEditSecret] = useState("");
  const [monitorMetrics, setMonitorMetrics] = useState<HostMetrics | null>(null);
  const [monitorError, setMonitorError] = useState<string | null>(null);
  const [monitorChecking, setMonitorChecking] = useState(false);
  const [monitorCheckedAt, setMonitorCheckedAt] = useState<string>("");
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const activeSession = sessions.find((s) => s.id === activeTab?.sessionId);
  const monitorSupported = activeSession?.protocol === "ssh";
  const menuTabIndex = tabMenu ? tabs.findIndex((tab) => tab.id === tabMenu.tabId) : -1;
  const hasLeftTabs = menuTabIndex > 0;
  const hasRightTabs = menuTabIndex >= 0 && menuTabIndex < tabs.length - 1;
  const hasOtherTabs = tabs.length > 1;
  const normalizedPath = sftpPath === "." ? "/" : sftpPath;
  const canGoUp = normalizedPath !== "/";
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

  useEffect(() => {
    const closeMenu = () => setMenu(null);
    const closeTabMenu = () => setTabMenu(null);
    const closeHostMenu = () => setHostMenu(null);
    window.addEventListener("click", closeMenu);
    window.addEventListener("click", closeTabMenu);
    window.addEventListener("click", closeHostMenu);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("click", closeTabMenu);
      window.removeEventListener("click", closeHostMenu);
    };
  }, []);

  const refreshMetrics = async (session: Session) => {
    setMonitorChecking(true);
    try {
      const metrics = await onGetHostMetrics(session);
      setMonitorMetrics(metrics);
      setMonitorError(null);
      setMonitorCheckedAt(new Date().toLocaleTimeString());
    } catch (err) {
      setMonitorError(err instanceof Error ? err.message : String(err));
      setMonitorMetrics(null);
    } finally {
      setMonitorChecking(false);
    }
  };

  useEffect(() => {
    if (!activeSession || !monitorSupported) {
      setMonitorMetrics(null);
      setMonitorError(activeSession && activeSession.protocol !== "ssh" ? "仅 SSH 会话支持监控指标" : null);
      setMonitorCheckedAt("");
      return;
    }
    let cancelled = false;
    const run = async () => {
      setMonitorChecking(true);
      try {
        const metrics = await onGetHostMetrics(activeSession);
        if (cancelled) return;
        setMonitorMetrics(metrics);
        setMonitorError(null);
        setMonitorCheckedAt(new Date().toLocaleTimeString());
      } catch (err) {
        if (cancelled) return;
        setMonitorError(err instanceof Error ? err.message : String(err));
        setMonitorMetrics(null);
      } finally {
        if (!cancelled) setMonitorChecking(false);
      }
    };
    void run();
    const timer = window.setInterval(() => void run(), 10000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeSession, monitorSupported, onGetHostMetrics]);

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let value = bytes;
    let idx = 0;
    while (value >= 1024 && idx < units.length - 1) {
      value /= 1024;
      idx += 1;
    }
    return `${value.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
  };

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
                <button
                  className="session-tab-main"
                  onClick={() => onSwitchTab(tab.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setTabMenu({ x: e.clientX, y: e.clientY, tabId: tab.id });
                  }}
                >
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
      {tabMenu ? (
        <div className="session-tab-context-menu" style={{ left: tabMenu.x, top: tabMenu.y }}>
          <button
            onClick={() => {
              onDuplicateTab(tabMenu.tabId);
              setTabMenu(null);
            }}
          >
            复制 session
          </button>
          <button
            disabled={!hasRightTabs}
            onClick={() => {
              if (!hasRightTabs) return;
              onCloseTabsToRight(tabMenu.tabId);
              setTabMenu(null);
            }}
          >
            关闭右边
          </button>
          <button
            disabled={!hasLeftTabs}
            onClick={() => {
              if (!hasLeftTabs) return;
              onCloseTabsToLeft(tabMenu.tabId);
              setTabMenu(null);
            }}
          >
            关闭左边
          </button>
          <button
            disabled={!hasOtherTabs}
            onClick={() => {
              if (!hasOtherTabs) return;
              onCloseOtherTabs(tabMenu.tabId);
              setTabMenu(null);
            }}
          >
            关闭其他
          </button>
        </div>
      ) : null}
      {hostMenu ? (
        <div className="host-context-menu" style={{ left: hostMenu.x, top: hostMenu.y }}>
          <button
            onClick={() => {
              const session = hostMenu.session;
              setEditHost(session);
              setEditForm({
                name: session.name,
                protocol: session.protocol,
                host: session.host,
                port: session.port,
                username: session.username,
                encoding: session.encoding,
                keepalive_secs: session.keepalive_secs,
              });
              setEditSecret("");
              setHostMenu(null);
            }}
          >
            修改主机信息
          </button>
          <button
            onClick={() => {
              if (activeSession && monitorSupported) {
                void refreshMetrics(activeSession);
              }
              setHostMenu(null);
            }}
          >
            刷新主机监控
          </button>
        </div>
      ) : null}
      <div className="terminal-error-slot">{error ? <div className="error-banner">{error}</div> : null}</div>
      <div className="terminal-workspace" ref={workspaceRef} style={workspaceStyle}>
        <aside className="terminal-hosts">
          <div className="panel-title">主机列表</div>
          <ul>
            {sessions.map((session) => {
              const hasActiveTab = activeTab?.sessionId === session.id;
              const selected = selectedId === session.id;
              return (
                <li key={session.id}>
                  <button
                    className={`${selected ? "active" : ""} ${hasActiveTab ? "has-tab" : ""}`.trim()}
                    onClick={() => onSelectSession(session.id)}
                    onDoubleClick={() => onOpenSession(session.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setHostMenu({ x: e.clientX, y: e.clientY, session });
                    }}
                    title="单击选中，双击打开新的会话标签"
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
          <div className="sftp-monitor-card">
            <div className="sftp-monitor-head">
              <span>主机监控</span>
              <button
                onClick={() => {
                  if (activeSession && monitorSupported) {
                    void refreshMetrics(activeSession);
                  }
                }}
                disabled={!activeSession || !monitorSupported || monitorChecking}
              >
                {monitorChecking ? "刷新中..." : "刷新"}
              </button>
            </div>
            <div className="sftp-monitor-host">
              {activeSession ? `${activeSession.host}:${activeSession.port}` : "未连接会话"}
            </div>
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
                  ? `${formatBytes(monitorMetrics.memory_used_bytes)} / ${formatBytes(
                      monitorMetrics.memory_total_bytes
                    )}`
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
      </div>
      {editHost ? (
        <div className="modal-backdrop" onClick={() => setEditHost(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h4>修改主机信息</h4>
              <button className="modal-close" onClick={() => setEditHost(null)} title="关闭">
                ×
              </button>
            </div>
            <div className="session-form">
              <input
                placeholder="Name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
              <select
                value={editForm.protocol}
                onChange={(e) => {
                  const protocol = e.target.value as Protocol;
                  setEditForm({ ...editForm, protocol, port: protocol === "ssh" ? 22 : 23 });
                }}
              >
                <option value="ssh">SSH</option>
                <option value="telnet">Telnet</option>
              </select>
              <input
                placeholder="Host"
                value={editForm.host}
                onChange={(e) => setEditForm({ ...editForm, host: e.target.value })}
              />
              <input
                placeholder="Port"
                type="number"
                value={editForm.port}
                onChange={(e) => setEditForm({ ...editForm, port: Number(e.target.value) })}
              />
              <input
                placeholder="Username"
                value={editForm.username}
                onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
              />
              <input
                placeholder="SSH Password (optional)"
                type="password"
                value={editSecret}
                onChange={(e) => setEditSecret(e.target.value)}
              />
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => setEditHost(null)}>
                  取消
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    void onUpdateHost(editHost.id, editForm, editSecret.trim() ? editSecret : undefined).then(
                      () => setEditHost(null)
                    );
                  }}
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <footer>{status}</footer>
    </section>
  );
}
