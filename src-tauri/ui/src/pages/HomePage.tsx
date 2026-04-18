import SessionList from "../components/SessionList";
import AuditLogModal from "../components/AuditLogModal";
import { ErrorBanner } from "../components/ErrorBanner";
import { ThemeControls } from "../components/ThemeControls";
import type { Session, SessionInput } from "../services/types";
import type { AuditRecord } from "../services/types";
import type { I18nKey, Lang } from "../i18n";

interface Props {
  sessions: Session[];
  connectingSessionId?: string | null;
  selectedId?: string;
  onlineMap: Record<string, boolean>;
  pingingIds: string[];
  connected: boolean;
  error: string | null;
  onDismissError: () => void;
  status: string;
  onSelect: (id: string) => void;
  onCreate: (input: SessionInput, secret?: string) => Promise<void>;
  onUpdate: (id: string, input: SessionInput, secret?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onTestConnect: (input: SessionInput) => Promise<boolean>;
  onGetSecret: (id: string) => Promise<string | null>;
  onConnect: (id?: string) => Promise<void>;
  onOnlineUpgrade: () => Promise<void>;
  auditOpen: boolean;
  auditLoading: boolean;
  audits: AuditRecord[];
  onOpenAudit: () => void;
  onCloseAudit: () => void;
  onRefreshAudit: () => void;
  upgradeChecking: boolean;
  lang: Lang;
  onSwitchLang: (lang: Lang) => void;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
}

export default function HomePage({
  sessions,
  connectingSessionId,
  selectedId,
  onlineMap,
  pingingIds,
  connected,
  error,
  onDismissError,
  status,
  onSelect,
  onCreate,
  onUpdate,
  onDelete,
  onTestConnect,
  onGetSecret,
  onConnect,
  onOnlineUpgrade,
  auditOpen,
  auditLoading,
  audits,
  onOpenAudit,
  onCloseAudit,
  onRefreshAudit,
  upgradeChecking,
  lang,
  onSwitchLang,
  tr,
}: Props) {
  const selected = sessions.find((s) => s.id === selectedId);
  const hasSessions = sessions.length > 0;

  return (
    <section className="workspace home-page">
      <header className="topbar">
        <div className="topbar-title">
          <div className="topbar-title-text">
            <div className="topbar-title-line">rshell</div>
            <div className="topbar-subtitle">{tr("top.subtitle")}</div>
          </div>
        </div>
        <div className="actions">
          <div className="lang-switch" role="group" aria-label={tr("top.ariaLanguageSwitch")}>
            <button
              className={`btn btn-ghost ${lang === "zh-CN" ? "lang-active" : ""}`}
              onClick={() => onSwitchLang("zh-CN")}
              title={tr("lang.switchToZh")}
            >
              {tr("lang.zh")}
            </button>
            <button
              className={`btn btn-ghost ${lang === "en-US" ? "lang-active" : ""}`}
              onClick={() => onSwitchLang("en-US")}
              title={tr("lang.switchToEn")}
            >
              {tr("lang.en")}
            </button>
          </div>
          <ThemeControls tr={tr} />
          <button className="btn btn-ghost" onClick={() => void onOnlineUpgrade()} disabled={upgradeChecking}>
            {upgradeChecking ? tr("top.upgradeChecking") : tr("top.upgrade")}
          </button>
          <button className="btn btn-ghost" onClick={onOpenAudit}>
            {tr("home.audit")}
          </button>
          <span className={connected ? "pill pill-ok" : "pill"}>
            {connected ? tr("top.online") : tr("top.offline")}
          </span>
          <span className="pill pill-muted">
            {selected ? tr("top.current", { name: selected.name }) : tr("top.noHostSelected")}
          </span>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onDismiss={onDismissError} /> : null}

      <div className="home-simple">
        <div className="home-panel">
          <div className="home-panel-header">
            <div>
              <div className="card-title">{tr("home.hostList")}</div>
              <div className="card-subtitle">{tr("home.hostListHint")}</div>
            </div>
            <div className="home-header-status">{status}</div>
          </div>
          <div className="home-panel-body">
            <div className="home-list-wrapper">
              <SessionList
                sessions={sessions}
                connectingSessionId={connectingSessionId}
                selectedId={selectedId}
                onlineMap={onlineMap}
                pingingIds={pingingIds}
                onSelect={onSelect}
                onCreate={onCreate}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onTestConnect={onTestConnect}
                onGetSecret={onGetSecret}
                onConnect={(id) => void onConnect(id)}
              />
              {!hasSessions ? (
                <div className="empty-state" role="note" aria-label={tr("home.ariaNoSession")}>
                  <div className="empty-title">{tr("home.emptyTitle")}</div>
                  <div className="empty-subtitle">{tr("home.emptySubtitle")}</div>
                  <ol className="empty-steps">
                    <li>{tr("home.emptyStep1")}</li>
                    <li>{tr("home.emptyStep2")}</li>
                    <li>{tr("home.emptyStep3")}</li>
                  </ol>
                  <p className="empty-doc">{tr("home.emptyDocLink")}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <footer>{status}</footer>
      <AuditLogModal
        open={auditOpen}
        loading={auditLoading}
        records={audits}
        tr={tr}
        onClose={onCloseAudit}
        onRefresh={onRefreshAudit}
      />
    </section>
  );
}
