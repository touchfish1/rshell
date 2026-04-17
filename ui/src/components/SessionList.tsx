import { useEffect, useMemo, useRef, useState } from "react";
import type { Protocol, Session, SessionInput } from "../services/types";

interface Props {
  sessions: Session[];
  selectedId?: string;
  connectedIds: string[];
  onSelect: (id: string) => void;
  onCreate: (input: SessionInput, secret?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onConnect?: (id: string) => void;
}

const defaultForm: SessionInput = {
  name: "",
  protocol: "ssh",
  host: "",
  port: 22,
  username: "",
  encoding: "utf-8",
  keepalive_secs: 30,
};

export default function SessionList({
  sessions,
  selectedId,
  connectedIds,
  onSelect,
  onCreate,
  onDelete,
  onConnect,
}: Props) {
  const [form, setForm] = useState<SessionInput>(defaultForm);
  const [secret, setSecret] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditShell, setShowEditShell] = useState<Session | null>(null);
  const [moreOpenId, setMoreOpenId] = useState<string | null>(null);
  const hostInputRef = useRef<HTMLInputElement | null>(null);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);

  const protocolPort = useMemo(() => (form.protocol === "ssh" ? 22 : 23), [form.protocol]);

  const submit = async () => {
    if (!form.host.trim()) return;
    if (!form.username.trim()) return;
    if (form.protocol === "ssh" && !secret.trim()) return;
    await onCreate(form, secret || undefined);
    setForm(defaultForm);
    setSecret("");
    setShowCreateModal(false);
  };

  useEffect(() => {
    if (showCreateModal) {
      window.requestAnimationFrame(() => hostInputRef.current?.focus());
    }
  }, [showCreateModal]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!moreMenuRef.current) return;
      const target = event.target as Node;
      if (!moreMenuRef.current.contains(target)) {
        setMoreOpenId(null);
      }
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, []);

  const resolveOs = (session: Session) => {
    const text = `${session.name} ${session.host}`.toLowerCase();
    if (text.includes("ubuntu")) return { label: "Ubuntu", code: "U", cls: "ubuntu" };
    if (text.includes("debian")) return { label: "Debian", code: "D", cls: "debian" };
    if (text.includes("centos")) return { label: "CentOS", code: "C", cls: "centos" };
    return { label: "Linux", code: "L", cls: "linux" };
  };

  return (
    <aside className="session-list">
      <div className="session-list-header">
        <h3>主机管理</h3>
        <button
          className="btn btn-ghost"
          onClick={() => setShowCreateModal(true)}
          title="新增主机"
        >
          新增主机
        </button>
      </div>
      <div className="session-table-head">
        <span>名称</span>
        <span>主机</span>
        <span>用户</span>
        <span>协议</span>
        <span>端口</span>
        <span>状态</span>
        <span>操作</span>
      </div>
      <ul className="session-table-body">
        {sessions.map((session) => {
          const active = selectedId === session.id;
          const connected = connectedIds.includes(session.id);
          const os = resolveOs(session);
          return (
            <li key={session.id} className={`session-line ${active ? "active" : ""}`}>
              <button
                className="session-main"
                onClick={() => {
                  onSelect(session.id);
                  onConnect?.(session.id);
                }}
                title={`连接 ${session.name}`}
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
                <span className={`session-col status ${connected ? "ok" : ""}`}>
                  {connected ? "在线" : "离线"}
                </span>
              </button>
              <div className="session-actions">
                {onConnect ? (
                  <button
                    className="connect"
                    onClick={() => onConnect(session.id)}
                    title="连接"
                  >
                    连接
                  </button>
                ) : null}
                <button
                  className="edit"
                  onClick={() => setShowEditShell(session)}
                  title="编辑（占位）"
                >
                  编辑
                </button>
                <div className="session-more-wrap" ref={moreOpenId === session.id ? moreMenuRef : undefined}>
                  <button
                    className="more"
                    onClick={() => setMoreOpenId((prev) => (prev === session.id ? null : session.id))}
                    title="更多"
                  >
                    更多
                  </button>
                  {moreOpenId === session.id ? (
                    <div className="session-more-menu">
                      <button onClick={() => setMoreOpenId(null)}>查看详情（占位）</button>
                      <button onClick={() => setMoreOpenId(null)}>复制配置（占位）</button>
                      <button onClick={() => setMoreOpenId(null)}>导出（占位）</button>
                    </div>
                  ) : null}
                </div>
                <button
                  className="danger"
                  onClick={() => void onDelete(session.id)}
                  title="删除"
                >
                  删除
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {showCreateModal ? (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h4>新增主机</h4>
              <button className="modal-close" onClick={() => setShowCreateModal(false)} title="关闭">
                ×
              </button>
            </div>
            <div className="session-form">
              <input
                placeholder="Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <select
                value={form.protocol}
                onChange={(e) => {
                  const protocol = e.target.value as Protocol;
                  setForm({ ...form, protocol, port: protocol === "ssh" ? 22 : 23 });
                }}
              >
                <option value="ssh">SSH</option>
                <option value="telnet">Telnet</option>
              </select>
              <input
                ref={hostInputRef}
                placeholder="Host"
                value={form.host}
                onChange={(e) => {
                  const host = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    host,
                    name: prev.name || host,
                  }));
                }}
              />
              <input
                placeholder="Port"
                type="number"
                value={form.port || protocolPort}
                onChange={(e) => setForm({ ...form, port: Number(e.target.value) })}
              />
              <input
                placeholder="Username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
              <input
                placeholder={form.protocol === "ssh" ? "SSH Password (saved)" : "Secret (optional)"}
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
              />
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => setShowCreateModal(false)}>
                  取消
                </button>
                <button
                  className="btn btn-primary"
                  onClick={submit}
                  disabled={
                    !form.host.trim() ||
                    !form.username.trim() ||
                    (form.protocol === "ssh" && !secret.trim())
                  }
                >
                  添加
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {showEditShell ? (
        <div className="modal-backdrop" onClick={() => setShowEditShell(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h4>编辑主机（占位）</h4>
              <button className="modal-close" onClick={() => setShowEditShell(null)} title="关闭">
                ×
              </button>
            </div>
            <div className="session-form">
              <div className="placeholder-row">名称：{showEditShell.name}</div>
              <div className="placeholder-row">主机：{showEditShell.host}</div>
              <div className="placeholder-row">用户：{showEditShell.username || "-"}</div>
              <div className="placeholder-row">编辑功能下一步接后端保存接口。</div>
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => setShowEditShell(null)}>
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
