import type { Protocol, Session, SessionInput } from "../../services/types";
import { useI18n } from "../../i18n-context";
import { PasswordVisibilityToggle } from "./PasswordVisibilityToggle";
import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "../ConfirmDialog";

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
  const { tr } = useI18n();
  const [initialSecret, setInitialSecret] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  useEffect(() => {
    if (!session) return;
    setInitialSecret(secret);
  }, [session?.id, secret, session]);
  const hasDirty = useMemo(() => {
    if (!session) return false;
    return (
      form.name !== session.name ||
      form.protocol !== session.protocol ||
      form.host !== session.host ||
      form.port !== session.port ||
      form.username !== session.username ||
      (form.encoding ?? "utf-8") !== (session.encoding ?? "utf-8") ||
      (form.keepalive_secs ?? 30) !== (session.keepalive_secs ?? 30) ||
      secret !== initialSecret
    );
  }, [form, session, secret, initialSecret]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { onClose(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!session) return null;
  const requestClose = () => {
    if (!hasDirty || testing) {
      onClose();
      return;
    }
    setConfirmClose(true);
  };

  return (
    <>
    <div className="modal-backdrop" onClick={requestClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={tr("modal.editHost")}>
        <div className="modal-header">
          <h4>{tr("modal.editHost")}</h4>
          <button type="button" className="modal-close" onClick={requestClose} title={tr("modal.close")}>
            ×
          </button>
        </div>
        <div className="modal-form" onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (form.host.trim()) onSubmit();
          }
        }}>
          <div className="session-form">
            <input placeholder={tr("form.name")} value={form.name} onChange={(e) => onChangeForm({ ...form, name: e.target.value })} />
            <select
              value={form.protocol}
              onChange={(e) => {
                const protocol = e.target.value as Protocol;
                onChangeForm({ ...form, protocol, port: protocol === "ssh" ? 22 : 23 });
              }}
            >
              <option value="ssh">{tr("protocol.ssh")}</option>
              <option value="telnet">{tr("protocol.telnet")}</option>
            </select>
            <input placeholder={tr("form.host")} value={form.host} onChange={(e) => onChangeForm({ ...form, host: e.target.value })} />
            <input
              placeholder={tr("form.port")}
              type="number"
              value={form.port || protocolPort}
              onChange={(e) => onChangeForm({ ...form, port: Number(e.target.value) })}
            />
            <input
              placeholder={tr("form.username")}
              value={form.username}
              onChange={(e) => onChangeForm({ ...form, username: e.target.value })}
            />
            <input
              placeholder={tr("form.encoding")}
              value={form.encoding ?? "utf-8"}
              onChange={(e) => onChangeForm({ ...form, encoding: e.target.value })}
            />
            <input
              placeholder={tr("form.keepaliveSeconds")}
              type="number"
              value={form.keepalive_secs ?? 30}
              onChange={(e) => onChangeForm({ ...form, keepalive_secs: Number(e.target.value) })}
            />
            <div className="password-input-wrap">
              <input
                placeholder={tr("form.sshPassword")}
                type={secretVisible ? "text" : "password"}
                value={secretVisible ? secret : "*********"}
                readOnly={!secretVisible}
                onChange={(e) => {
                  onChangeSecret(e.target.value);
                  onMarkSecretDirty();
                }}
              />
              <PasswordVisibilityToggle
                visible={secretVisible}
                loading={secretLoading}
                showTitle={tr("form.toggleShowPassword")}
                hideTitle={tr("form.toggleHidePassword")}
                onClick={onChangeSecretVisible}
              />
            </div>
            {testResult ? <div className="modal-inline-notice">{testResult}</div> : null}
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={requestClose}>
            {tr("modal.cancel")}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onTest}
            disabled={testing || !form.host.trim() || !form.port}
          >
            {testing ? tr("modal.testing") : tr("modal.testConnection")}
          </button>
          <button type="button" className="btn btn-primary" onClick={onSubmit} disabled={!form.host.trim()}>
            {tr("modal.save")}
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={confirmClose}
        title={tr("modal.unsavedCloseTitle")}
        message={tr("modal.unsavedCloseMessage")}
        confirmLabel={tr("modal.confirmClose")}
        cancelLabel={tr("modal.cancel")}
        onConfirm={() => { setConfirmClose(false); onClose(); }}
        onCancel={() => setConfirmClose(false)}
      />
    </div>
    </>
  );
}
