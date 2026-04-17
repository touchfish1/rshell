import type { ReactNode } from "react";
import type { Session } from "../services/types";

interface Props {
  sessions: Session[];
  activeTabId?: string;
  tabs: string[];
  connectedIds: string[];
  error: string | null;
  status: string;
  terminals: Array<{ id: string; node: ReactNode }>;
  sftpFiles: string[];
  onOpenSession: (id: string) => void;
  onSwitchTab: (id: string) => void;
  onCloseTab: (id: string) => void;
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
  sftpFiles,
  onOpenSession,
  onSwitchTab,
  onCloseTab,
  onBackToHome,
  onDisconnect,
}: Props) {
  const activeSession = sessions.find((s) => s.id === activeTabId);

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
          tabs.map((id) => {
            const session = sessions.find((s) => s.id === id);
            const active = id === activeTabId;
            const connected = connectedIds.includes(id);
            return (
              <div key={id} className={`session-tab ${active ? "active" : ""}`}>
                <button className="session-tab-main" onClick={() => onSwitchTab(id)}>
                  {session?.name ?? id}
                  <span className={`session-dot ${connected ? "on" : "off"}`} />
                </button>
                <button className="session-tab-close" onClick={() => onCloseTab(id)} title="关闭标签">
                  ×
                </button>
              </div>
            );
          })
        )}
      </div>
      <div className="terminal-error-slot">{error ? <div className="error-banner">{error}</div> : null}</div>
      <div className="terminal-workspace">
        <aside className="terminal-hosts">
          <div className="panel-title">主机列表</div>
          <ul>
            {sessions.map((session) => (
              <li key={session.id}>
                <button
                  className={activeTabId === session.id ? "active" : ""}
                  onClick={() => onOpenSession(session.id)}
                  title="打开或切换到该会话"
                >
                  {session.name}
                </button>
              </li>
            ))}
          </ul>
        </aside>

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

        <aside className="terminal-sftp">
          <div className="panel-title">SFTP 文件列表</div>
          <ul>
            {sftpFiles.length === 0 ? (
              <li className="sftp-empty">暂无数据（待后端 SFTP 接口）</li>
            ) : (
              sftpFiles.map((name) => <li key={name}>{name}</li>)
            )}
          </ul>
        </aside>
      </div>
      <footer>{status}</footer>
    </section>
  );
}
