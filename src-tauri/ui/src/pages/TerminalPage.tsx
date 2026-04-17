import { useEffect, useState, type ReactNode } from "react";
import type { HostMetrics, Protocol, Session, SessionInput, SftpEntry } from "../services/types";
import { EditHostModal } from "../components/terminal/EditHostModal";
import { HostsPanel } from "../components/terminal/HostsPanel";
import { SessionTabs } from "../components/terminal/SessionTabs";
import { SftpPanel } from "../components/terminal/SftpPanel";
import { useSplitPanels } from "../hooks/useSplitPanels";

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
  const { workspaceRef, workspaceStyle, onDragStartHosts, onDragStartSftp } = useSplitPanels();
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

  useEffect(() => {
    const closeTabMenu = () => setTabMenu(null);
    const closeHostMenu = () => setHostMenu(null);
    window.addEventListener("click", closeTabMenu);
    window.addEventListener("click", closeHostMenu);
    return () => {
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
      <SessionTabs
        tabs={tabs}
        activeTabId={activeTabId}
        connectedIds={connectedIds}
        menu={tabMenu}
        onSetMenu={setTabMenu}
        onSwitchTab={onSwitchTab}
        onCloseTab={onCloseTab}
        onDuplicateTab={onDuplicateTab}
        onCloseTabsToLeft={onCloseTabsToLeft}
        onCloseTabsToRight={onCloseTabsToRight}
        onCloseOtherTabs={onCloseOtherTabs}
      />
      <div className="terminal-error-slot">{error ? <div className="error-banner">{error}</div> : null}</div>
      <div className="terminal-workspace" ref={workspaceRef} style={workspaceStyle}>
        <HostsPanel
          sessions={sessions}
          selectedId={selectedId}
          activeTabSessionId={activeTab?.sessionId}
          menu={hostMenu}
          onSetMenu={setHostMenu}
          onSelectSession={onSelectSession}
          onOpenSession={onOpenSession}
          onEditHost={(session) => {
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
          }}
          onRefreshMetrics={() => {
            if (activeSession && monitorSupported) {
              void refreshMetrics(activeSession);
            }
          }}
        />
        <div
          className="terminal-splitter"
          role="separator"
          aria-label="调整主机列表宽度"
          onMouseDown={(e) => onDragStartHosts(e.clientX)}
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
          onMouseDown={(e) => onDragStartSftp(e.clientX)}
        />
        <SftpPanel
          activeHostLabel={activeSession ? `${activeSession.host}:${activeSession.port}` : ""}
          monitorSupported={Boolean(activeSession && monitorSupported)}
          monitorMetrics={monitorMetrics}
          monitorError={monitorError}
          monitorChecking={monitorChecking}
          monitorCheckedAt={monitorCheckedAt}
          onRefreshMetrics={() => {
            if (activeSession && monitorSupported) {
              void refreshMetrics(activeSession);
            }
          }}
          sftpEntries={sftpEntries}
          sftpPath={sftpPath}
          sftpLoading={sftpLoading}
          onSftpUp={onSftpUp}
          onSftpOpenDir={onSftpOpenDir}
          onSftpDownload={onSftpDownload}
        />
      </div>
      <EditHostModal
        host={editHost}
        form={editForm}
        secret={editSecret}
        onClose={() => setEditHost(null)}
        onChangeForm={setEditForm}
        onChangeSecret={setEditSecret}
        onSave={onUpdateHost}
      />
      <footer>{status}</footer>
    </section>
  );
}
