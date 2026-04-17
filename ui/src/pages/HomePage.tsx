import SessionList from "../components/SessionList";
import type { Session, SessionInput } from "../services/types";

interface Props {
  sessions: Session[];
  selectedId?: string;
  connectedId?: string;
  connected: boolean;
  error: string | null;
  status: string;
  onSelect: (id: string) => void;
  onCreate: (input: SessionInput, secret?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onConnect: (id?: string) => Promise<void>;
}

export default function HomePage({
  sessions,
  selectedId,
  connectedId,
  connected,
  error,
  status,
  onSelect,
  onCreate,
  onDelete,
  onConnect,
}: Props) {
  const selected = sessions.find((s) => s.id === selectedId);
  const canConnect = Boolean(selectedId) && !connected;
  const hasSessions = sessions.length > 0;

  return (
    <section className="workspace home-page">
      <header className="topbar">
        <div className="topbar-title">
          <div className="app-badge" aria-hidden="true">
            RS
          </div>
          <div className="topbar-title-text">
            <div className="topbar-title-line">rshell</div>
            <div className="topbar-subtitle">快速连接 SSH / Telnet，会话本地保存</div>
          </div>
        </div>
        <div className="actions">
          <button
            className="btn btn-primary"
            disabled={!canConnect}
            onClick={() => void onConnect()}
            title={selected ? `连接：${selected.name}` : "请选择一个会话"}
          >
            连接
          </button>
        </div>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="home-hero">
        <div className="home-hero-main">
          <h2 className="home-title">连接到你的主机</h2>
          <p className="home-lead">
            选择一个会话并连接。首次连接如果缺少 SSH 密码，会提示输入并保存到本地配置文件。
          </p>
        </div>
        <div className="home-hero-side">
          <div className="status-card">
            <div className="status-label">当前状态</div>
            <div className="status-value">{status}</div>
            <div className="status-meta">
              <span className={connected ? "pill pill-ok" : "pill"}>{connected ? "已连接" : "未连接"}</span>
              {selected ? (
                <span className="pill pill-muted" title={selected.id}>
                  已选：{selected.name}
                </span>
              ) : (
                <span className="pill pill-muted">未选择会话</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="home-grid">
        <div className="card card-soft">
          <div className="card-header">
            <div>
              <div className="card-title">会话列表</div>
              <div className="card-subtitle">管理、添加并快速连接</div>
            </div>
            <div className="card-actions">
              <button
                className="btn btn-ghost"
                disabled={!selectedId || connectedId === selectedId}
                onClick={() => void onConnect(selectedId)}
                title="连接选中的会话"
              >
                快速连接
              </button>
            </div>
          </div>
          <div className="card-body">
            <div className="home-list-wrapper">
              {hasSessions ? (
                <SessionList
                  sessions={sessions}
                  selectedId={selectedId}
                  connectedId={connectedId}
                  onSelect={onSelect}
                  onCreate={onCreate}
                  onDelete={onDelete}
                  onConnect={(id) => void onConnect(id)}
                />
              ) : (
                <div className="empty-state" role="note" aria-label="暂无会话">
                  <div className="empty-icon" aria-hidden="true">
                    ⦿
                  </div>
                  <div className="empty-title">还没有会话</div>
                  <div className="empty-subtitle">在下方填写主机信息并添加一个会话，然后就可以一键连接。</div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card card-soft">
          <div className="card-header">
            <div>
              <div className="card-title">小贴士</div>
              <div className="card-subtitle">更顺手的使用方式</div>
            </div>
          </div>
          <div className="card-body">
            <ul className="hint-list">
              <li>
                <strong>SSH 密码</strong>：首次连接如果缺少密码，会弹窗提示输入并保存到本地配置。
              </li>
              <li>
                <strong>快捷操作</strong>：会话右侧按钮可一键连接/删除；已连接的会话会被禁用连接按钮。
              </li>
              <li>
                <strong>排错</strong>：连接页底部的 Debug 面板会记录后端阶段日志，便于定位问题。
              </li>
            </ul>
          </div>
        </div>
      </div>

      <footer>{status}</footer>
    </section>
  );
}
