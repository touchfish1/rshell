import TerminalPage from "../pages/TerminalPage";
import TerminalPane from "../components/TerminalPane";
import { getHostMetrics, readSftpTextFile, resizeTerminal, saveSftpTextFile, sendInput } from "../services/bridge";
import type { Session, SessionInput, SftpEntry, WorkspaceTab } from "../services/types";
import type { I18nKey } from "../i18n";
import type { MutableRefObject } from "react";

type TranslateFn = (key: I18nKey, vars?: Record<string, string | number>) => string;

interface AppTerminalSectionProps {
  sessions: Session[];
  connectingSessionId?: string | null;
  selectedId?: string;
  activeTabId?: string;
  tabs: WorkspaceTab[];
  connectedIds: string[];
  error: string | null;
  onDismissError: () => void;
  status: string;
  tr: TranslateFn;
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
  onSftpDownload: (remotePath: string) => void;
  onSftpUpload: (remoteDir: string, fileName: string, contentBase64: string) => Promise<void>;
  onBackToHome: () => void;
  onDisconnect: (id?: string) => void;
  onUpdateHost: (id: string, input: SessionInput, secret?: string) => Promise<void>;
  retryConnect: (tabId: string) => void;
  writerMapRef: MutableRefObject<Map<string, (content: string) => void>>;
  setError: (error: string | null) => void;
  onNavigateZk: () => void;
  onNavigateRedis: () => void;
  onNavigateMysql: () => void;
  onNavigateEtcd: () => void;
  onOpenCreate: () => void;
}

export function AppTerminalSection({
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
  onBackToHome,
  onDisconnect,
  onUpdateHost,
  retryConnect,
  writerMapRef,
  setError,
  onNavigateZk,
  onNavigateRedis,
  onNavigateMysql,
  onNavigateEtcd,
  onOpenCreate,
}: AppTerminalSectionProps) {
  return (
    <TerminalPage
      sessions={sessions}
      connectingSessionId={connectingSessionId}
      selectedId={selectedId}
      activeTabId={activeTabId}
      tabs={tabs}
      connectedIds={connectedIds}
      error={error}
      onDismissError={onDismissError}
      status={status}
      tr={tr}
      sftpEntries={sftpEntries}
      sftpPath={sftpPath}
      sftpLoading={sftpLoading}
      onOpenSession={(id) => onOpenSession(id)}
      onDuplicateTab={(id) => onDuplicateTab(id)}
      onSelectSession={onSelectSession}
      onSwitchTab={onSwitchTab}
      onCloseTab={(id) => onCloseTab(id)}
      onCloseTabsToLeft={(id) => onCloseTabsToLeft(id)}
      onCloseTabsToRight={(id) => onCloseTabsToRight(id)}
      onCloseOtherTabs={(id) => onCloseOtherTabs(id)}
      onSftpOpenDir={onSftpOpenDir}
      onSftpUp={onSftpUp}
      onSftpDownload={onSftpDownload}
      onSftpUpload={onSftpUpload}
      onSftpReadText={async (remotePath: string) => {
        if (!activeTabId) throw new Error("no active terminal tab");
        const tab = tabs.find((item) => item.id === activeTabId);
        if (!tab) throw new Error("active terminal tab not found");
        return readSftpTextFile(tab.sessionId, remotePath);
      }}
      onSftpSaveText={async (remotePath: string, content: string) => {
        if (!activeTabId) throw new Error("no active terminal tab");
        const tab = tabs.find((item) => item.id === activeTabId);
        if (!tab) throw new Error("active terminal tab not found");
        await saveSftpTextFile(tab.sessionId, remotePath, content);
      }}
      onBackToHome={onBackToHome}
      onDisconnect={onDisconnect}
      onUpdateHost={onUpdateHost}
      onGetHostMetrics={(session) => getHostMetrics(session.id)}
      onNavigateZk={onNavigateZk}
      onNavigateRedis={onNavigateRedis}
      onNavigateMysql={onNavigateMysql}
      onNavigateEtcd={onNavigateEtcd}
      onOpenCreate={onOpenCreate}
      terminals={tabs.map((tab) => ({
        id: tab.id,
        node: (
          <TerminalPane
            isActive={activeTabId === tab.id}
            connected={connectedIds.includes(tab.sessionId) && activeTabId === tab.id}
            linkState={tab.linkState}
            linkError={tab.linkError}
            onRetryConnect={() => retryConnect(tab.id)}
            onCloseFailedTab={() => onCloseTab(tab.id)}
            registerWriter={(nextWriter) => {
              writerMapRef.current.set(tab.id, nextWriter);
            }}
            onInput={(text) => {
              if (connectedIds.includes(tab.sessionId) && activeTabId === tab.id) {
                void sendInput(tab.sessionId, text).catch((err) => {
                  const message = err instanceof Error ? err.message : String(err);
                  setError(tr("error.sendFailed", { message }));
                });
              }
            }}
            onResize={(cols, rows) => {
              if (connectedIds.includes(tab.sessionId) && activeTabId === tab.id) {
                void resizeTerminal(tab.sessionId, cols, rows).catch((err) => {
                  const message = err instanceof Error ? err.message : String(err);
                  setError(tr("error.resizeTerminalFailed", { message }));
                });
              }
            }}
          />
        ),
      }))}
    />
  );
}
