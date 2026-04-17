import { useEffect, useMemo, useRef, useState } from "react";
import type { Protocol, Session, SessionInput } from "../services/types";
import { HostCreateModal } from "./session/HostCreateModal";
import { HostEditModal } from "./session/HostEditModal";
import { resolveOs } from "./session/resolveOs";

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
  onGetSecret: (id: string) => Promise<string | null>;
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
  onGetSecret,
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
  const [editSecretVisible, setEditSecretVisible] = useState(false);
  const [editSecretLoaded, setEditSecretLoaded] = useState(false);
  const [editSecretLoading, setEditSecretLoading] = useState(false);
  const [editSecretDirty, setEditSecretDirty] = useState(false);
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
    setEditSecretVisible(false);
    setEditSecretLoaded(false);
    setEditSecretLoading(false);
    setEditSecretDirty(false);
    setEditTestResult(null);
  };

  const submitEdit = async () => {
    if (!editSession) return;
    if (!editForm.host.trim()) return;
    if (!editForm.username.trim()) return;
    await onUpdate(editSession.id, editForm, editSecretDirty ? editSecret : undefined);
    setEditSession(null);
    setEditTestResult(null);
    setEditSecret("");
    setEditSecretVisible(false);
    setEditSecretLoaded(false);
    setEditSecretLoading(false);
    setEditSecretDirty(false);
  };

  const toggleEditSecretVisible = async () => {
    if (!editSession) return;
    if (editSecretVisible) {
      setEditSecretVisible(false);
      return;
    }
    if (!editSecretLoaded) {
      setEditSecretLoading(true);
      try {
        const secret = await onGetSecret(editSession.id);
        setEditSecret(secret ?? "");
        setEditSecretLoaded(true);
        setEditSecretDirty(false);
      } catch (err) {
        setEditTestResult(`读取密码失败: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setEditSecretLoading(false);
      }
    }
    setEditSecretVisible(true);
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
      <HostCreateModal
        open={showCreateModal}
        form={createForm}
        secret={createSecret}
        testing={createTesting}
        testResult={createTestResult}
        hostInputRef={hostInputRef}
        protocolPort={createProtocolPort}
        onClose={() => setShowCreateModal(false)}
        onChangeForm={setCreateForm}
        onChangeSecret={setCreateSecret}
        onTest={() => void testCreateConnect()}
        onSubmit={() => void submitCreate()}
      />
      <HostEditModal
        session={editSession}
        form={editForm}
        secret={editSecret}
        secretVisible={editSecretVisible}
        secretLoading={editSecretLoading}
        testResult={editTestResult}
        testing={editTesting}
        protocolPort={editProtocolPort}
        onClose={() => setEditSession(null)}
        onChangeForm={setEditForm}
        onChangeSecret={setEditSecret}
        onChangeSecretVisible={() => void toggleEditSecretVisible()}
        onTest={() => void testEditConnect()}
        onSubmit={() => void submitEdit()}
        onMarkSecretDirty={() => setEditSecretDirty(true)}
      />
    </aside>
  );
}
