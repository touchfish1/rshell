import { useEffect, useState, type ReactNode } from "react";
import type { HostMetrics, Protocol, Session, SessionInput, SftpEntry, SftpTextReadResult, WorkspaceTab } from "../services/types";
import type { I18nKey } from "../i18n";
import { EditHostModal } from "../components/terminal/EditHostModal";
import { ShortcutHelpModal } from "../components/terminal/ShortcutHelpModal";
import { TerminalFontControls } from "../components/TerminalFontControls";
import { HostsPanel } from "../components/terminal/HostsPanel";
import { SessionTabs } from "../components/terminal/SessionTabs";
import { SftpPanel } from "../components/terminal/SftpPanel";
import { useSplitPanels } from "../hooks/useSplitPanels";
import { ColorThemeToggle } from "../components/ColorThemeToggle";
import { ErrorBanner } from "../components/ErrorBanner";
import { useTerminalMetrics } from "./terminal/useTerminalMetrics";
import { useTerminalShortcuts } from "./terminal/useTerminalShortcuts";

interface Props {
  sessions: Session[];
  connectingSessionId?: string | null;
  selectedId?: string;
  activeTabId?: string;
  tabs: WorkspaceTab[];
  connectedIds: string[];
  error: string | null;
  onDismissError: () => void;
  status: string;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
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
  onSftpUpload: (remoteDir: string, fileName: string, contentBase64: string) => Promise<void>;
  onSftpReadText: (path: string) => Promise<SftpTextReadResult>;
  onSftpSaveText: (path: string, content: string) => Promise<void>;
  onBackToHome: () => void;
  onDisconnect: (id?: string) => void;
  onUpdateHost: (id: string, input: SessionInput, secret?: string) => Promise<void>;
  onGetHostMetrics: (session: Session) => Promise<HostMetrics>;
  onNavigateZk: () => void;
  onNavigateRedis: () => void;
  onNavigateMysql: () => void;
  onNavigateEtcd: () => void;
  onOpenCreate: () => void;
}

export default function TerminalPage({
  sessions,
  connectingSessionId,
  selectedId,
  activeTabId,
  tabs,
  connectedIds,
  error,
  onDismissError,
  status,
  tr,
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
  onSftpUpload,
  onSftpReadText,
  onSftpSaveText,
  onBackToHome,
  onDisconnect,
  onUpdateHost,
  onGetHostMetrics,
  onNavigateZk,
  onNavigateRedis,
  onNavigateMysql,
  onNavigateEtcd,
  onOpenCreate,
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
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const activeSession = sessions.find((s) => s.id === activeTab?.sessionId);
  const { monitorSupported, monitorMetrics, monitorError, monitorChecking, monitorCheckedAt, refreshMetrics } =
    useTerminalMetrics({ activeSession, onGetHostMetrics, tr });

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

  useTerminalShortcuts({
    tabs,
    activeTabId,
    editHostOpen: Boolean(editHost),
    shortcutHelpOpen,
    onSetShortcutHelpOpen: setShortcutHelpOpen,
    onSwitchTab,
    onCloseTab,
  });

  return (
    <section
      className="workspace terminal-page"
      title={`${tr("terminal.workspaceShortcutsHint")} · ${tr("terminal.zoomKeyboardHint")}`}
    >
      <header className="terminal-top">
        <h2>{activeSession?.name ?? tr("terminal.workspace")}</h2>
        <div className="actions">
          <ColorThemeToggle tr={tr} />
          <TerminalFontControls tr={tr} />
          <button type="button" className="btn btn-ghost" title="New connection" onClick={onOpenCreate}>
            + New
          </button>
          <button type="button" className="btn btn-ghost" onClick={onNavigateZk}>
            ZK
          </button>
          <button type="button" className="btn btn-ghost" onClick={onNavigateRedis}>
            Redis
          </button>
          <button type="button" className="btn btn-ghost" onClick={onNavigateMysql}>
            MySQL
          </button>
          <button type="button" className="btn btn-ghost" onClick={onNavigateEtcd}>
            Etcd
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            title={tr("shortcutHelp.openHint")}
            onClick={() => setShortcutHelpOpen(true)}
          >
            {tr("shortcutHelp.openButton")}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onBackToHome}>
            {tr("terminal.back")}
          </button>
          <button type="button" className="btn btn-ghost" disabled={!activeTabId} onClick={() => onDisconnect(activeTabId)}>
            {tr("terminal.disconnect")}
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
      <div className="terminal-error-slot">
        {error ? <ErrorBanner message={error} onDismiss={onDismissError} /> : null}
      </div>
      <div className="terminal-workspace" ref={workspaceRef} style={workspaceStyle}>
        <HostsPanel
          sessions={sessions}
          connectingSessionId={connectingSessionId}
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
          aria-label={tr("terminal.ariaResizeHosts")}
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
          aria-label={tr("terminal.ariaResizeFiles")}
          onMouseDown={(e) => onDragStartSftp(e.clientX)}
        />
        <SftpPanel
          activeHostLabel={activeSession ? `${activeSession.host}:${activeSession.port}` : ""}
          activeHostIp={activeSession?.host}
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
          onSftpUpload={onSftpUpload}
          onSftpReadText={onSftpReadText}
          onSftpSaveText={onSftpSaveText}
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
      <ShortcutHelpModal open={shortcutHelpOpen} onClose={() => setShortcutHelpOpen(false)} tr={tr} />
      <footer>{status}</footer>
    </section>
  );
}
