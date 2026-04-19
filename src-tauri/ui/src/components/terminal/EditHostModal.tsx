import type { Protocol, Session, SessionInput } from "../../services/types";
import { useI18n } from "../../i18n-context";

interface Props {
  host: Session | null;
  form: SessionInput;
  secret: string;
  onClose: () => void;
  onChangeForm: (next: SessionInput) => void;
  onChangeSecret: (next: string) => void;
  onSave: (id: string, input: SessionInput, secret?: string) => Promise<void>;
}

export function EditHostModal({ host, form, secret, onClose, onChangeForm, onChangeSecret, onSave }: Props) {
  const { tr } = useI18n();
  if (!host) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h4>{tr("modal.modifyHostInfo")}</h4>
          <button type="button" className="modal-close" onClick={onClose} title={tr("modal.close")}>
            ×
          </button>
        </div>
        <div className="modal-form">
          <div className="session-form">
            <input placeholder={tr("form.name")} value={form.name} onChange={(e) => onChangeForm({ ...form, name: e.target.value })} />
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
            <input placeholder={tr("form.host")} value={form.host} onChange={(e) => onChangeForm({ ...form, host: e.target.value })} />
            <input
              placeholder={tr("form.port")}
              type="number"
              value={form.port}
              onChange={(e) => onChangeForm({ ...form, port: Number(e.target.value) })}
            />
            <input
              placeholder={tr("form.username")}
              value={form.username}
              onChange={(e) => onChangeForm({ ...form, username: e.target.value })}
            />
            <input
              placeholder={tr("form.sshPasswordOptional")}
              type="password"
              value={secret}
              onChange={(e) => onChangeSecret(e.target.value)}
            />
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {tr("modal.cancel")}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void onSave(host.id, form, secret.trim() ? secret : undefined).then(onClose)}
          >
            {tr("modal.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
