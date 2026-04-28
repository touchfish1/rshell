import { useEffect, useMemo, useState } from "react";
import type { EtcdConnection, EtcdConnectionInput, EtcdKeyValue } from "../services/types";
import {
  connectEtcd,
  disconnectEtcd,
  etcdDeleteKey,
  etcdGetValue,
  etcdListKeys,
  etcdSetValue,
} from "../services/bridge";
import { EtcdConnectionList } from "../components/etcd/EtcdConnectionList";
import { ErrorBanner } from "../components/ErrorBanner";
import { ColorThemeToggle } from "../components/ColorThemeToggle";
import type { I18nKey } from "../i18n";

interface Props {
  connections: EtcdConnection[];
  selectedId?: string;
  status: string;
  error: string | null;
  onDismissError: () => void;
  onSelect: (id: string) => void;
  onCreate: (input: EtcdConnectionInput, secret?: string) => Promise<EtcdConnection | null>;
  onUpdate: (id: string, input: EtcdConnectionInput, secret?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onGetSecret: (id: string) => Promise<string | null>;
  onBack: () => void;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
}

export default function EtcdPage({
  connections,
  selectedId,
  status,
  error,
  onDismissError,
  onSelect,
  onCreate,
  onUpdate,
  onDelete,
  onGetSecret,
  onBack,
  tr,
}: Props) {
  const selected = useMemo(() => connections.find((c) => c.id === selectedId) ?? null, [connections, selectedId]);
  const [connected, setConnected] = useState(false);
  const [prefix, setPrefix] = useState("/");
  const [keys, setKeys] = useState<string[]>([]);
  const [keysLoading, setKeysLoading] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [keyValue, setKeyValue] = useState<EtcdKeyValue | null>(null);
  const [editorText, setEditorText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<string | null>(null);

  useEffect(() => {
    setConnected(false);
    setKeys([]);
    setSelectedKey(null);
    setKeyValue(null);
    setEditorText("");
    setSaveResult(null);
  }, [selectedId]);

  const ensureConnected = async () => {
    if (!selected) throw new Error(tr("etcd.error.noConnectionSelected"));
    if (connected) return;
    await connectEtcd(selected.id);
    setConnected(true);
  };

  const loadKeys = async () => {
    if (!selected) return;
    setKeysLoading(true);
    setSaveResult(null);
    try {
      await ensureConnected();
      const result = await etcdListKeys(selected.id, prefix);
      result.sort((a, b) => a.localeCompare(b));
      setKeys(result);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setSaveResult(tr("etcd.page.saveFailed", { message }));
    } finally {
      setKeysLoading(false);
    }
  };

  const onSelectKey = async (key: string) => {
    if (!selected) return;
    setSelectedKey(key);
    setKeyValue(null);
    setEditorText("");
    setSaveResult(null);
    try {
      await ensureConnected();
      const data = await etcdGetValue(selected.id, key);
      setKeyValue(data);
      setEditorText(data?.value ?? "");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setSaveResult(tr("etcd.page.saveFailed", { message }));
      setKeyValue(null);
    }
  };

  const saveKeyValue = async () => {
    if (!selected || !selectedKey) return;
    setSaving(true);
    setSaveResult(null);
    try {
      await ensureConnected();
      await etcdSetValue(selected.id, selectedKey, editorText);
      const refreshed = await etcdGetValue(selected.id, selectedKey);
      setKeyValue(refreshed);
      setEditorText(refreshed?.value ?? "");
      setSaveResult(tr("etcd.page.saveSuccess"));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setSaveResult(tr("etcd.page.saveFailed", { message }));
    } finally {
      setSaving(false);
    }
  };

  const deleteSelectedKey = async () => {
    if (!selected || !selectedKey) return;
    const confirmed = window.confirm(tr("etcd.page.deleteConfirm", { key: selectedKey }));
    if (!confirmed) return;

    try {
      await ensureConnected();
      await etcdDeleteKey(selected.id, selectedKey);
      setSaveResult(tr("etcd.page.keyDeleted"));
      setSelectedKey(null);
      setKeyValue(null);
      setEditorText("");
      // Refresh key list
      void loadKeys();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setSaveResult(tr("etcd.page.deleteFailed", { message }));
    }
  };

  return (
    <section className="workspace etcd-page">
      <header className="topbar">
        <div className="topbar-title">
          <div className="topbar-title-text">
            <div className="topbar-title-line">{tr("etcd.page.title")}</div>
            <div className="topbar-subtitle">{selected ? selected.name : tr("etcd.page.noSelection")}</div>
          </div>
        </div>
        <div className="actions">
          <ColorThemeToggle tr={tr} />
          <button className="btn btn-ghost" onClick={onBack}>
            {tr("terminal.back")}
          </button>
          <button
            className="btn btn-ghost"
            disabled={!selected || !connected}
            onClick={() => {
              if (!selected) return;
              void disconnectEtcd(selected.id).finally(() => setConnected(false));
            }}
          >
            {tr("etcd.page.disconnect")}
          </button>
          <span className={connected ? "pill pill-ok" : "pill"}>{connected ? tr("top.online") : tr("top.offline")}</span>
          <span className="pill pill-muted">{status}</span>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onDismiss={onDismissError} /> : null}

      <div className="terminal-layout">
        <EtcdConnectionList
          connections={connections}
          selectedId={selectedId}
          onSelect={onSelect}
          onCreate={onCreate}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onGetSecret={onGetSecret}
        />
        <div className="etcd-browser-pane">
          {selected ? (
            <div className="etcd-browser-body">
              {/* Prefix input and load button */}
              <div className="etcd-prefix-row">
                <input
                  className="etcd-prefix-input"
                  type="text"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  placeholder={tr("etcd.page.prefixPlaceholder")}
                />
                <button className="btn" onClick={() => void loadKeys()} disabled={keysLoading}>
                  {keysLoading ? tr("etcd.page.loading") : tr("etcd.page.loadKeys")}
                </button>
              </div>

              {/* Keys list */}
              <div className="etcd-keys-panel">
                <div className="etcd-keys-header">
                  <span>
                    {tr("etcd.page.title")} Keys ({keys.length})
                  </span>
                  <button className="btn btn-ghost" onClick={() => void loadKeys()} disabled={keysLoading}>
                    {tr("etcd.page.refresh")}
                  </button>
                </div>
                <ul className="etcd-keys-list">
                  {keys.map((key) => (
                    <li
                      key={key}
                      className={`etcd-key-item ${selectedKey === key ? "active" : ""}`}
                      onClick={() => void onSelectKey(key)}
                    >
                      {key}
                    </li>
                  ))}
                  {keys.length === 0 && !keysLoading ? (
                    <li className="etcd-empty-hint">{tr("etcd.page.selectKeyHint")}</li>
                  ) : null}
                </ul>
              </div>

              {/* Key value editor */}
              {selectedKey ? (
                <div className="etcd-value-panel">
                  <div className="etcd-value-header">
                    <span className="etcd-value-key">{selectedKey}</span>
                    <div className="etcd-value-actions">
                      <button className="btn btn-ghost" onClick={() => void deleteSelectedKey()}>
                        {tr("etcd.page.deleteKey")}
                      </button>
                    </div>
                  </div>
                  {keyValue ? (
                    <div className="etcd-value-meta">
                      <span>{tr("etcd.page.createRevision", { revision: keyValue.create_revision })}</span>
                      <span> | </span>
                      <span>{tr("etcd.page.modRevision", { revision: keyValue.mod_revision })}</span>
                    </div>
                  ) : null}
                  <div className="etcd-value-editor">
                    <div className="etcd-value-label">{tr("etcd.page.value")}</div>
                    <textarea
                      className="etcd-value-textarea"
                      value={editorText}
                      onChange={(e) => setEditorText(e.target.value)}
                      rows={12}
                    />
                  </div>
                  <div className="etcd-value-save-row">
                    <button className="btn" onClick={() => void saveKeyValue()} disabled={saving}>
                      {saving ? tr("etcd.page.saving") : tr("etcd.page.save")}
                    </button>
                    {saveResult ? <span className="etcd-save-result">{saveResult}</span> : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="etcd-placeholder">
              <p>{tr("etcd.page.hint")}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
