import type { Session } from "../../services/types";
import { useI18n } from "../../i18n-context";

interface Props {
  sessions: Session[];
  selectedId?: string;
  activeTabSessionId?: string;
  menu: { x: number; y: number; session: Session } | null;
  onSetMenu: (next: { x: number; y: number; session: Session } | null) => void;
  onSelectSession: (id: string) => void;
  onOpenSession: (id: string) => void;
  onEditHost: (session: Session) => void;
  onRefreshMetrics: () => void;
}

export function HostsPanel({
  sessions,
  selectedId,
  activeTabSessionId,
  menu,
  onSetMenu,
  onSelectSession,
  onOpenSession,
  onEditHost,
  onRefreshMetrics,
}: Props) {
  const { tr } = useI18n();
  return (
    <>
      {menu ? (
        <div className="host-context-menu" style={{ left: menu.x, top: menu.y }}>
          <button
            onClick={() => {
              onEditHost(menu.session);
              onSetMenu(null);
            }}
          >
            {tr("terminal.modifyHostInfo")}
          </button>
          <button
            onClick={() => {
              onRefreshMetrics();
              onSetMenu(null);
            }}
          >
            {tr("terminal.refreshHostMonitor")}
          </button>
        </div>
      ) : null}

      <aside className="terminal-hosts">
        <div className="panel-title">{tr("terminal.hostList")}</div>
        <ul>
          {sessions.map((session) => {
            const hasActiveTab = activeTabSessionId === session.id;
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
                    onSetMenu({ x: e.clientX, y: e.clientY, session });
                  }}
                  title={tr("terminal.hostSingleDoubleClickHint")}
                >
                  {session.name}
                </button>
              </li>
            );
          })}
        </ul>
      </aside>
    </>
  );
}

