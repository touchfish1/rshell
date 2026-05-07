import { useEffect, useState } from "react";
import type { I18nKey } from "../i18n";

interface Props {
  open: boolean;
  currentEnvironment: string;
  environments: string[];
  environmentBusy: boolean;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
  onSwitchEnvironment: (name: string) => Promise<void>;
  onCreateEnvironment: (name: string) => Promise<void>;
  onRenameEnvironment: (newName: string) => Promise<void>;
  onClose: () => void;
}

export function EnvironmentModal({
  open,
  currentEnvironment,
  environments,
  environmentBusy,
  tr,
  onSwitchEnvironment,
  onCreateEnvironment,
  onRenameEnvironment,
  onClose,
}: Props) {
  const [environmentInput, setEnvironmentInput] = useState("");
  const [selectedEnvironment, setSelectedEnvironment] = useState(currentEnvironment);

  useEffect(() => {
    if (!open) return;
    setEnvironmentInput(currentEnvironment);
    setSelectedEnvironment(currentEnvironment);
  }, [open, currentEnvironment]);

  useEffect(() => {
    if (!open) return;
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-card env-modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h4>{tr("top.environment")}</h4>
          <button type="button" className="modal-close" onClick={onClose} title={tr("modal.close")}>×</button>
        </div>
        <div className="modal-form env-modal-form">
          <div className="modal-inline-notice">
            {tr("top.environmentCurrent", { name: currentEnvironment })}
          </div>
          <select
            className="env-modal-select"
            value={selectedEnvironment}
            onChange={(event) => setSelectedEnvironment(event.target.value)}
            disabled={environmentBusy}
          >
            {environments.map((environment) => (
              <option key={environment} value={environment}>
                {environment}
              </option>
            ))}
          </select>
          <input
            className="env-modal-input"
            value={environmentInput}
            onChange={(event) => setEnvironmentInput(event.target.value)}
            placeholder={tr("top.environmentInputPlaceholder")}
            disabled={environmentBusy}
          />
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose} disabled={environmentBusy}>
            {tr("modal.cancel")}
          </button>
          <button
            className="btn btn-ghost"
            disabled={environmentBusy || !selectedEnvironment}
            onClick={async () => {
              await onSwitchEnvironment(selectedEnvironment);
              onClose();
            }}
          >
            {tr("top.environmentSwitch")}
          </button>
          <button
            className="btn btn-ghost"
            disabled={environmentBusy || !environmentInput.trim()}
            onClick={async () => {
              await onCreateEnvironment(environmentInput.trim());
              onClose();
            }}
          >
            {tr("top.environmentCreate")}
          </button>
          <button
            className="btn"
            disabled={environmentBusy || !environmentInput.trim()}
            onClick={async () => {
              await onRenameEnvironment(environmentInput.trim());
              onClose();
            }}
          >
            {tr("top.environmentRename")}
          </button>
        </div>
      </div>
    </div>
  );
}
