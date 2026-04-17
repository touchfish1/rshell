import type { ReactNode } from "react";

interface Props {
  sessionName?: string;
  connected: boolean;
  error: string | null;
  status: string;
  debugLogs: string[];
  terminal: ReactNode;
  onBackToHome: () => void;
  onDisconnect: () => void;
  onClearDebug: () => void;
}

export default function TerminalPage({
  sessionName,
  connected,
  error,
  status,
  debugLogs,
  terminal,
  onBackToHome,
  onDisconnect,
  onClearDebug,
}: Props) {
  return (
    <section className="workspace terminal-page">
      <header>
        <h2>{sessionName ?? "Terminal"}</h2>
        <div className="actions">
          <button onClick={onBackToHome}>Back</button>
          <button disabled={!connected} onClick={onDisconnect}>
            Disconnect
          </button>
        </div>
      </header>
      {error ? <div className="error-banner">{error}</div> : null}
      <div className="debug-panel">
        <div className="debug-panel-header">
          <span>Debug Logs</span>
          <button onClick={onClearDebug}>Clear</button>
        </div>
        <div className="debug-panel-body">{debugLogs.length === 0 ? "暂无日志" : debugLogs.join("\n")}</div>
      </div>
      {terminal}
      <footer>{status}</footer>
    </section>
  );
}
