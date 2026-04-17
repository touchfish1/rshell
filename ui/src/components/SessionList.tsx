import { useEffect, useMemo, useRef, useState } from "react";
import type { Protocol, Session, SessionInput } from "../services/types";

interface Props {
  sessions: Session[];
  selectedId?: string;
  onlineMap: Record<string, boolean>;
  pingingIds: string[];
  onSelect: (id: string) => void;
  onCreate: (input: SessionInput, secret?: string) => Promise<void>;
  onUpdate: (id: string, input: SessionInput, secret?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onTestConnect: (input: SessionInput) => Promise<boolean>;
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
  onlineMap,
  pingingIds,
  onSelect,
  onCreate,
  onUpdate,
  onDelete,
  onTestConnect,
  onConnect,
}: Props) {
  const [createForm, setCreateForm] = useState<SessionInput>(defaultForm);
  const [createSecret, setCreateSecret] = useState("");
  const [createTesting, setCreateTesting] = useState(false);
  const [createTestResult, setCreateTestResult] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editSession, setEditSession] = useState<Session | null>(null);
  const [editForm, setEditForm] = useState<SessionInput>(defaultForm);
  const [editSecret, setEditSecret] = useState("");
  const [editTesting, setEditTesting] = useState(false);
  const [editTestResult, setEditTestResult] = useState<string | null>(null);
  const [moreOpenId, setMoreOpenId] = useState<string | null>(null);
  const hostInputRef = useRef<HTMLInputElement | null>(null);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);

  const createProtocolPort = useMemo(
    () => (createForm.protocol === "ssh" ? 22 : 23),
    [createForm.protocol]
  );
  const editProtocolPort = useMemo(() => (editForm.protocol === "ssh" ? 22 : 23), [editForm.protocol]);

  const submitCreate = async () => {
    if (!createForm.host.trim()) return;
    if (!createForm.username.trim()) return;
    if (createForm.protocol === "ssh" && !createSecret.trim()) return;
    await onCreate(createForm, createSecret || undefined);
    setCreateForm(defaultForm);
    setCreateSecret("");
    setCreateTestResult(null);
    setShowCreateModal(false);
  };

  const openEdit = (session: Session) => {
    setEditSession(session);
    setEditForm({
      name: session.name,
      protocol: session.protocol,
      host: session.host,
      port: session.port,
      username: session.username,
      encoding: session.encoding,
      keepalive_secs: session.keepalive_secs,
    });
    setEditSecret("");
    setEditTestResult(null);
  };

  const submitEdit = async () => {
    if (!editSession) return;
    if (!editForm.host.trim()) return;
    if (!editForm.username.trim()) return;
    await onUpdate(editSession.id, editForm, editSecret.trim() ? editSecret : undefined);
    setEditSession(null);
    setEditTestResult(null);
    setEditSecret("");
  };

  const testCreateConnect = async () => {
    setCreateTesting(true);
    setCreateTestResult(null);
    try {
      const ok = await onTestConnect(createForm);
      setCreateTestResult(ok ? "连接测试成功" : "连接测试失败");
    } catch (err) {
      setCreateTestResult(`连接测试失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCreateTesting(false);
    }
  };

  const testEditConnect = async () => {
    setEditTesting(true);
    setEditTestResult(null);
    try {
      const ok = await onTestConnect(editForm);
      setEditTestResult(ok ? "连接测试成功" : "连接测试失败");
    } catch (err) {
      setEditTestResult(`连接测试失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setEditTesting(false);
    }
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
          const pinging = pingingIds.includes(session.id);
          const online = onlineMap[session.id] ?? false;
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
                <span className={`session-col status ${online ? "ok" : ""} ${pinging ? "checking" : ""}`}>
                  {pinging ? "检测中" : online ? "在线" : "离线"}
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
                  onClick={() => openEdit(session)}
                  title="编辑主机"
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
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              />
              <select
                value={createForm.protocol}
                onChange={(e) => {
                  const protocol = e.target.value as Protocol;
                  setCreateForm({ ...createForm, protocol, port: protocol === "ssh" ? 22 : 23 });
                }}
              >
                <option value="ssh">SSH</option>
                <option value="telnet">Telnet</option>
              </select>
              <input
                ref={hostInputRef}
                placeholder="Host"
                value={createForm.host}
                onChange={(e) => {
                  const host = e.target.value;
                  setCreateForm((prev) => ({
                    ...prev,
                    host,
                    name: prev.name || host,
                  }));
                }}
              />
              <input
                placeholder="Port"
                type="number"
                value={createForm.port || createProtocolPort}
                onChange={(e) => setCreateForm({ ...createForm, port: Number(e.target.value) })}
              />
              <input
                placeholder="Username"
                value={createForm.username}
                onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
              />
              <input
                placeholder={createForm.protocol === "ssh" ? "SSH Password (saved)" : "Secret (optional)"}
                type="password"
                value={createSecret}
                onChange={(e) => setCreateSecret(e.target.value)}
              />
              {createTestResult ? <div className="placeholder-row">{createTestResult}</div> : null}
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => setShowCreateModal(false)}>
                  取消
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => void testCreateConnect()}
                  disabled={createTesting || !createForm.host.trim() || !createForm.port}
                >
                  {createTesting ? "测试中..." : "测试连接"}
                </button>
                <button
                  className="btn btn-primary"
                  onClick={submitCreate}
                  disabled={
                    !createForm.host.trim() ||
                    !createForm.username.trim() ||
                    (createForm.protocol === "ssh" && !createSecret.trim())
                  }
                >
                  添加
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {editSession ? (
        <div className="modal-backdrop" onClick={() => setEditSession(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h4>编辑主机</h4>
              <button className="modal-close" onClick={() => setEditSession(null)} title="关闭">
                ×
              </button>
            </div>
            <div className="session-form">
              <input
                placeholder="Name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
              <select
                value={editForm.protocol}
                onChange={(e) => {
                  const protocol = e.target.value as Protocol;
                  setEditForm({ ...editForm, protocol, port: protocol === "ssh" ? 22 : 23 });
                }}
              >
                <option value="ssh">SSH</option>
                <option value="telnet">Telnet</option>
              </select>
              <input
                placeholder="Host"
                value={editForm.host}
                onChange={(e) => setEditForm({ ...editForm, host: e.target.value })}
              />
              <input
                placeholder="Port"
                type="number"
                value={editForm.port || editProtocolPort}
                onChange={(e) => setEditForm({ ...editForm, port: Number(e.target.value) })}
              />
              <input
                placeholder="Username"
                value={editForm.username}
                onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
              />
              <input
                placeholder="Encoding (utf-8/gbk)"
                value={editForm.encoding ?? "utf-8"}
                onChange={(e) => setEditForm({ ...editForm, encoding: e.target.value })}
              />
              <input
                placeholder="Keepalive Seconds"
                type="number"
                value={editForm.keepalive_secs ?? 30}
                onChange={(e) => setEditForm({ ...editForm, keepalive_secs: Number(e.target.value) })}
              />
              <input
                placeholder="SSH Password (optional, keep unchanged if empty)"
                type="password"
                value={editSecret}
                onChange={(e) => setEditSecret(e.target.value)}
              />
              {editTestResult ? <div className="placeholder-row">{editTestResult}</div> : null}
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => setEditSession(null)}>
                  取消
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => void testEditConnect()}
                  disabled={editTesting || !editForm.host.trim() || !editForm.port}
                >
                  {editTesting ? "测试中..." : "测试连接"}
                </button>
                <button className="btn btn-primary" onClick={submitEdit} disabled={!editForm.host.trim()}>
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
