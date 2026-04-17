import SessionList from "../components/SessionList";
import type { Session, SessionInput } from "../services/types";

interface Props {
  sessions: Session[];
  selectedId?: string;
  onlineMap: Record<string, boolean>;
  pingingIds: string[];
  connected: boolean;
  error: string | null;
  status: string;
  onSelect: (id: string) => void;
  onCreate: (input: SessionInput, secret?: string) => Promise<void>;
  onUpdate: (id: string, input: SessionInput, secret?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onTestConnect: (input: SessionInput) => Promise<boolean>;
  onGetSecret: (id: string) => Promise<string | null>;
  onConnect: (id?: string) => Promise<void>;
  onOnlineUpgrade: () => Promise<void>;
  upgradeChecking: boolean;
}

export default function HomePage({
  sessions,
  selectedId,
  onlineMap,
  pingingIds,
  connected,
  error,
  status,
  onSelect,
  onCreate,
  onUpdate,
  onDelete,
  onTestConnect,
  onGetSecret,
  onConnect,
  onOnlineUpgrade,
  upgradeChecking,
}: Props) {
  const selected = sessions.find((s) => s.id === selectedId);
  const hasSessions = sessions.length > 0;

  return (
    <section className="workspace home-page">
      <header className="topbar">
        <div className="topbar-title">
          <div className="topbar-title-text">
            <div className="topbar-title-line">rshell</div>
            <div className="topbar-subtitle">SSH / Telnet 会话管理</div>
          </div>
        </div>
        <div className="actions">
          <button className="btn btn-ghost" onClick={() => void onOnlineUpgrade()} disabled={upgradeChecking}>
            {upgradeChecking ? "检查升级中..." : "在线升级"}
          </button>
          <span className={connected ? "pill pill-ok" : "pill"}>{connected ? "在线" : "离线"}</span>
          <span className="pill pill-muted">{selected ? `当前：${selected.name}` : "未选择主机"}</span>
        </div>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="home-simple">
        <div className="home-panel">
          <div className="home-panel-header">
            <div>
              <div className="card-title">主机列表</div>
              <div className="card-subtitle">点击行内“连接”或主机名即可新建会话标签</div>
            </div>
            <div className="home-header-status">{status}</div>
          </div>
          <div className="home-panel-body">
            <div className="home-list-wrapper">
              <SessionList
                sessions={sessions}
                selectedId={selectedId}
                onlineMap={onlineMap}
                pingingIds={pingingIds}
                onSelect={onSelect}
                onCreate={onCreate}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onTestConnect={onTestConnect}
                onGetSecret={onGetSecret}
                onConnect={(id) => void onConnect(id)}
              />
              {!hasSessions ? (
                <div className="empty-state" role="note" aria-label="暂无会话">
                  <div className="empty-title">还没有会话</div>
                  <div className="empty-subtitle">添加一个会话后即可连接。</div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <footer>{status}</footer>
    </section>
  );
}
