import type { TabLinkState } from "../../services/types";
import type { I18nKey } from "../../i18n";

interface Props {
  linkState: TabLinkState;
  linkError?: string;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
  onRetryConnect?: () => void;
  onCloseFailedTab?: () => void;
}

export function TerminalPaneLinkOverlay({
  linkState,
  linkError,
  tr,
  onRetryConnect,
  onCloseFailedTab,
}: Props) {
  const showOverlay = linkState === "connecting" || linkState === "failed";
  if (!showOverlay) return null;
  return (
    <div className="terminal-pane-overlay" aria-live="polite">
      {linkState === "connecting" ? (
        <div className="terminal-pane-overlay-card">
          <div className="terminal-pane-overlay-spinner" aria-hidden />
          <div>{tr("terminal.connectingOverlay")}</div>
        </div>
      ) : (
        <div className="terminal-pane-overlay-card terminal-pane-overlay-card-error">
          <div className="terminal-pane-overlay-title">
            {tr("terminal.sessionInterrupted", { message: linkError && linkError.trim() ? linkError : "—" })}
          </div>
          <div className="terminal-pane-overlay-actions">
            {onRetryConnect ? (
              <button type="button" className="btn btn-primary" onClick={() => onRetryConnect()}>
                {tr("terminal.retryConnect")}
              </button>
            ) : null}
            {onCloseFailedTab ? (
              <button type="button" className="btn btn-ghost" onClick={() => onCloseFailedTab()}>
                {tr("terminal.closeFailedTab")}
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
