import type { RefObject } from "react";
import type { Session } from "../../services/types";
import { resolveOs } from "./resolveOs";
import { useI18n } from "../../i18n-context";

interface Props {
  session: Session;
  selected: boolean;
  pinging: boolean;
  online: boolean;
  onSelectAndConnect: (id: string) => void;
  onConnect?: (id: string) => void;
  onEdit: (session: Session) => void;
  onDelete: (id: string) => void;
  moreOpenId: string | null;
  onToggleMore: (id: string) => void;
  onCloseMore: () => void;
  moreMenuRef: RefObject<HTMLDivElement | null>;
}

export function SessionRow({
  session,
  selected,
  pinging,
  online,
  onSelectAndConnect,
  onConnect,
  onEdit,
  onDelete,
  moreOpenId,
  onToggleMore,
  onCloseMore,
  moreMenuRef,
}: Props) {
  const { tr } = useI18n();
  const os = resolveOs(session);

  return (
    <li key={session.id} className={`session-line ${selected ? "active" : ""}`}>
      <button
        className="session-main"
        onClick={() => onSelectAndConnect(session.id)}
        title={tr("session.connectTitle", { name: session.name })}
      >
        <span className="session-col name">
          <span className={`os-icon ${os.cls}`} title={os.label} aria-label={os.label}>
            {os.code}
          </span>
          <span className="session-name-text">{session.name}</span>
        </span>
        <span className="session-col host">{session.host}</span>
        <span className="session-col user">{session.username || "-"}</span>
        <span className="session-col proto">{session.protocol.toUpperCase()}</span>
        <span className="session-col port">{session.port}</span>
        <span className={`session-col status ${online ? "ok" : ""} ${pinging ? "checking" : ""}`}>
          {pinging ? tr("session.statusChecking") : online ? tr("session.statusOnline") : tr("session.statusOffline")}
        </span>
      </button>

      <div className="session-actions">
        {onConnect ? (
          <button className="connect" onClick={() => onConnect(session.id)} title={tr("session.connect")}>
            {tr("session.connect")}
          </button>
        ) : null}
        <button className="edit" onClick={() => onEdit(session)} title={tr("session.editHost")}>
          {tr("session.editHost")}
        </button>
        <div className="session-more-wrap" ref={moreOpenId === session.id ? moreMenuRef : undefined}>
          <button className="more" onClick={() => onToggleMore(session.id)} title={tr("session.more")}>
            {tr("session.more")}
          </button>
          {moreOpenId === session.id ? (
            <div className="session-more-menu">
              <button onClick={onCloseMore}>{tr("session.moreViewDetail")}</button>
              <button onClick={onCloseMore}>{tr("session.moreCopyConfig")}</button>
              <button onClick={onCloseMore}>{tr("session.moreExport")}</button>
            </div>
          ) : null}
        </div>
        <button className="danger" onClick={() => onDelete(session.id)} title={tr("session.delete")}>
          {tr("session.delete")}
        </button>
      </div>
    </li>
  );
}

