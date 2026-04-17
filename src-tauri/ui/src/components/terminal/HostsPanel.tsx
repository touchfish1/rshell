import type { Session } from "../../services/types";

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
            修改主机信息
          </button>
          <button
            onClick={() => {
              onRefreshMetrics();
              onSetMenu(null);
            }}
          >
            刷新主机监控
          </button>
        </div>
      ) : null}

      <aside className="terminal-hosts">
        <div className="panel-title">主机列表</div>
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
                  title="单击选中，双击打开新的会话标签"
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

