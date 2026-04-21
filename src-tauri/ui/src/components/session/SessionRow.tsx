import type { Session } from "../../services/types";
import { resolveOs } from "./resolveOs";
import { useI18n } from "../../i18n-context";
import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";

interface Props {
  session: Session;
  selected: boolean;
  online: boolean;
  /** 在线时的探测耗时（毫秒）；未探测或离线为 null */
  latencyMs: number | null;
  /** 该主机正在执行连接握手 */
  isConnecting?: boolean;
  onSelectAndConnect: (id: string) => void;
  onConnect?: (id: string) => void;
  onEdit: (session: Session) => void;
  onDuplicate: (session: Session) => void;
  onDelete: (id: string) => void;
}

export function SessionRow({
  session,
  selected,
  online,
  latencyMs,
  isConnecting = false,
  onSelectAndConnect,
  onConnect,
  onEdit,
  onDuplicate,
  onDelete,
}: Props) {
  const { tr } = useI18n();
  const os = resolveOs(session);
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
    };
  }, []);

  const showCopied = () => {
    setCopied(true);
    if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
    resetTimerRef.current = window.setTimeout(() => {
      setCopied(false);
      resetTimerRef.current = null;
    }, 1500);
  };

  const copyIp = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(session.host);
      showCopied();
    } catch {
      // Silently ignore clipboard failures to avoid interrupting row actions.
    }
  };

  return (
    <li
      key={session.id}
      className={`session-line ${selected ? "active" : ""} ${isConnecting ? "session-line-connecting" : ""}`}
    >
      <button
        className="session-main"
        onClick={() => onSelectAndConnect(session.id)}
        title={
          isConnecting ? tr("session.connectingHint") : tr("session.connectTitle", { name: session.name })
        }
      >
        <span className="session-col name">
          <span className={`os-icon ${os.cls}`} title={os.label} aria-label={os.label}>
            {os.code}
          </span>
          <span className="session-name-text">{session.name}</span>
        </span>
        <span className="session-col host">
          <span className="host-text">{session.host}</span>
          <button
            type="button"
            className="copy-icon-btn"
            title={tr("session.copyIp")}
            aria-label={tr("session.copyIp")}
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={copyIp}
          >
            {copied ? "✅" : "📋"}
          </button>
          {copied ? <span className="copy-success-text">{tr("session.copied")}</span> : null}
        </span>
        <span className="session-col user">{session.username || "-"}</span>
        <span className="session-col proto">{session.protocol.toUpperCase()}</span>
        <span className="session-col port">{session.port}</span>
        <span className={`session-col status ${online ? "ok" : ""}`}>
          {online ? (
            <>
              {tr("session.statusOnline")}
              {latencyMs != null ? (
                <span className="session-latency">{tr("session.latencySuffix", { ms: latencyMs })}</span>
              ) : null}
            </>
          ) : (
            tr("session.statusOffline")
          )}
        </span>
      </button>

      <div className="session-actions">
        {onConnect ? (
          <button
            className="connect"
            disabled={isConnecting}
            onClick={() => {
              if (isConnecting) return;
              onConnect(session.id);
            }}
            title={isConnecting ? tr("session.connectingHint") : tr("session.connect")}
          >
            {isConnecting ? tr("session.connectingAction") : tr("session.connect")}
          </button>
        ) : null}
        <button className="edit" onClick={() => onEdit(session)} title={tr("session.editHost")}>
          {tr("session.editHost")}
        </button>
        <button
          className="more"
          onClick={() => onDuplicate(session)}
          title={tr("session.copy")}
        >
          {tr("session.copy")}
        </button>
        <button className="danger" onClick={() => onDelete(session.id)} title={tr("session.delete")}>
          {tr("session.delete")}
        </button>
      </div>
    </li>
  );
}

