import type { Protocol, SessionInput } from "../../services/types";

interface Props {
  open: boolean;
  form: SessionInput;
  secret: string;
  testing: boolean;
  testResult: string | null;
  hostInputRef: React.RefObject<HTMLInputElement | null>;
  protocolPort: number;
  onClose: () => void;
  onChangeForm: (next: SessionInput) => void;
  onChangeSecret: (next: string) => void;
  onTest: () => void;
  onSubmit: () => void;
}

export function HostCreateModal({
  open,
  form,
  secret,
  testing,
  testResult,
  hostInputRef,
  protocolPort,
  onClose,
  onChangeForm,
  onChangeSecret,
  onTest,
  onSubmit,
}: Props) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h4>新增主机</h4>
          <button className="modal-close" onClick={onClose} title="关闭">
            ×
          </button>
        </div>
        <div className="session-form">
          <input
            placeholder="Name"
            value={form.name}
            onChange={(e) => onChangeForm({ ...form, name: e.target.value })}
          />
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
          <input
            ref={hostInputRef}
            placeholder="Host"
            value={form.host}
            onChange={(e) => {
              const host = e.target.value;
              onChangeForm({
                ...form,
                host,
                name: form.name || host,
              });
            }}
          />
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
            placeholder={form.protocol === "ssh" ? "SSH Password (saved)" : "Secret (optional)"}
            type="password"
            value={secret}
            onChange={(e) => onChangeSecret(e.target.value)}
          />
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
            <button
              className="btn btn-primary"
              onClick={onSubmit}
              disabled={!form.host.trim() || !form.username.trim() || (form.protocol === "ssh" && !secret.trim())}
            >
              添加
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

