import type { Protocol, Session, SessionInput } from "../../services/types";

interface Props {
  host: Session | null;
  form: SessionInput;
  secret: string;
  onClose: () => void;
  onChangeForm: (next: SessionInput) => void;
  onChangeSecret: (next: string) => void;
  onSave: (id: string, input: SessionInput, secret?: string) => Promise<void>;
}

export function EditHostModal({
  host,
  form,
  secret,
  onClose,
  onChangeForm,
  onChangeSecret,
  onSave,
}: Props) {
  if (!host) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h4>修改主机信息</h4>
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
            value={form.port}
            onChange={(e) => onChangeForm({ ...form, port: Number(e.target.value) })}
          />
          <input
            placeholder="Username"
            value={form.username}
            onChange={(e) => onChangeForm({ ...form, username: e.target.value })}
          />
          <input
            placeholder="SSH Password (optional)"
            type="password"
            value={secret}
            onChange={(e) => onChangeSecret(e.target.value)}
          />
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={onClose}>
              取消
            </button>
            <button
              className="btn btn-primary"
              onClick={() => void onSave(host.id, form, secret.trim() ? secret : undefined).then(onClose)}
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

