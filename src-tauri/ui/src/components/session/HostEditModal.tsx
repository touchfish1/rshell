import type { Protocol, Session, SessionInput } from "../../services/types";

interface Props {
  session: Session | null;
  form: SessionInput;
  secret: string;
  secretVisible: boolean;
  secretLoading: boolean;
  testResult: string | null;
  testing: boolean;
  protocolPort: number;
  onClose: () => void;
  onChangeForm: (next: SessionInput) => void;
  onChangeSecret: (next: string) => void;
  onChangeSecretVisible: () => void;
  onTest: () => void;
  onSubmit: () => void;
  onMarkSecretDirty: () => void;
}

export function HostEditModal({
  session,
  form,
  secret,
  secretVisible,
  secretLoading,
  testResult,
  testing,
  protocolPort,
  onClose,
  onChangeForm,
  onChangeSecret,
  onChangeSecretVisible,
  onTest,
  onSubmit,
  onMarkSecretDirty,
}: Props) {
  if (!session) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h4>编辑主机</h4>
          <button className="modal-close" onClick={onClose} title="关闭">
            ×
          </button>
        </div>
        <div className="session-form">
          <input placeholder="Name" value={form.name} onChange={(e) => onChangeForm({ ...form, name: e.target.value })} />
          <select
            value={form.protocol}
            onChange={(e) => {
              const protocol = e.target.value as Protocol;
              onChangeForm({ ...form, protocol, port: protocol === "ssh" ? 22 : 23 });
            }}
          >
            <option value="ssh">SSH</option>
            <option value="telnet">Telnet</option>
          </select>
          <input placeholder="Host" value={form.host} onChange={(e) => onChangeForm({ ...form, host: e.target.value })} />
          <input
            placeholder="Port"
            type="number"
            value={form.port || protocolPort}
            onChange={(e) => onChangeForm({ ...form, port: Number(e.target.value) })}
          />
          <input
            placeholder="Username"
            value={form.username}
            onChange={(e) => onChangeForm({ ...form, username: e.target.value })}
          />
          <input
            placeholder="Encoding (utf-8/gbk)"
            value={form.encoding ?? "utf-8"}
            onChange={(e) => onChangeForm({ ...form, encoding: e.target.value })}
          />
          <input
            placeholder="Keepalive Seconds"
            type="number"
            value={form.keepalive_secs ?? 30}
            onChange={(e) => onChangeForm({ ...form, keepalive_secs: Number(e.target.value) })}
          />
          <div className="password-input-wrap">
            <input
              placeholder="SSH Password"
              type={secretVisible ? "text" : "password"}
              value={secretVisible ? secret : "*********"}
              readOnly={!secretVisible}
              onChange={(e) => {
                onChangeSecret(e.target.value);
                onMarkSecretDirty();
              }}
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={onChangeSecretVisible}
              title={secretVisible ? "隐藏密码" : "显示密码"}
              disabled={secretLoading}
            >
              {secretLoading ? "…" : secretVisible ? "🙈" : "👁"}
            </button>
          </div>
          {testResult ? <div className="placeholder-row">{testResult}</div> : null}
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={onClose}>
              取消
            </button>
            <button
              className="btn btn-ghost"
              onClick={onTest}
              disabled={testing || !form.host.trim() || !form.port}
            >
              {testing ? "测试中..." : "测试连接"}
            </button>
            <button className="btn btn-primary" onClick={onSubmit} disabled={!form.host.trim()}>
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

