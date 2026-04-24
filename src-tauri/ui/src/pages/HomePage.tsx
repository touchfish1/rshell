import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import SessionList from "../components/SessionList";
import AuditLogModal from "../components/AuditLogModal";
import { ColorThemeToggle } from "../components/ColorThemeToggle";
import { ErrorBanner } from "../components/ErrorBanner";
import type {
  HostReachability,
  MySqlConnection,
  MySqlConnectionInput,
  RedisConnection,
  RedisConnectionInput,
  Session,
  SessionInput,
  ZookeeperConnection,
  ZookeeperConnectionInput,
} from "../services/types";
import type { AuditRecord } from "../services/types";
import type { I18nKey, Lang } from "../i18n";

interface Props {
  sessions: Session[];
  connectingSessionId?: string | null;
  selectedId?: string;
  reachabilityMap: Record<string, HostReachability>;
  refreshBusy: boolean;
  connected: boolean;
  error: string | null;
  onDismissError: () => void;
  status: string;
  onSelect: (id: string) => void;
  onCreate: (input: SessionInput, secret?: string) => Promise<Session | null>;
  onCreateZk: (input: ZookeeperConnectionInput, secret?: string) => Promise<ZookeeperConnection | null>;
  onCreateRedis: (input: RedisConnectionInput, secret?: string) => Promise<RedisConnection | null>;
  onCreateMysql: (input: MySqlConnectionInput, secret?: string) => Promise<MySqlConnection | null>;
  onUpdate: (id: string, input: SessionInput, secret?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onTestConnect: (input: SessionInput) => Promise<HostReachability>;
  onTestZk: (input: ZookeeperConnectionInput, secret?: string) => Promise<void>;
  onGetSecret: (id: string) => Promise<string | null>;
  onGetZkSecret: (id: string) => Promise<string | null>;
  zkConnections: ZookeeperConnection[];
  onConnectZk: (id: string) => void;
  onUpdateZk: (id: string, input: ZookeeperConnectionInput, secret?: string) => Promise<void>;
  onDeleteZk: (id: string) => Promise<void>;
  redisConnections: RedisConnection[];
  mysqlConnections: MySqlConnection[];
  onConnectRedis: (id: string) => void;
  onConnectMysql: (id: string) => void;
  onGetRedisSecret: (id: string) => Promise<string | null>;
  onUpdateRedis: (id: string, input: RedisConnectionInput, secret?: string) => Promise<void>;
  onDeleteRedis: (id: string) => Promise<void>;
  onDeleteMysql: (id: string) => Promise<void>;
  onGetMysqlSecret: (id: string) => Promise<string | null>;
  onUpdateMysql: (id: string, input: MySqlConnectionInput, secret?: string) => Promise<void>;
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
  environments: string[];
  currentEnvironment: string;
  environmentBusy: boolean;
  onSwitchEnvironment: (name: string) => Promise<void>;
  onCreateEnvironment: (name: string) => Promise<void>;
  onRenameEnvironment: (newName: string) => Promise<void>;
  onRefreshHostStatus: () => void;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
}

export default function HomePage({
  sessions,
  connectingSessionId,
  selectedId,
  reachabilityMap,
  refreshBusy,
  connected,
  error,
  onDismissError,
  status,
  onSelect,
  onCreate,
  onCreateZk,
  onCreateRedis,
  onCreateMysql,
  onUpdate,
  onDelete,
  onTestConnect,
  onTestZk,
  onGetSecret,
  onGetZkSecret,
  zkConnections,
  onConnectZk,
  onUpdateZk,
  onDeleteZk,
  redisConnections,
  mysqlConnections,
  onConnectRedis,
  onConnectMysql,
  onGetRedisSecret,
  onUpdateRedis,
  onDeleteRedis,
  onDeleteMysql,
  onGetMysqlSecret,
  onUpdateMysql,
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
  environments,
  currentEnvironment,
  environmentBusy,
  onSwitchEnvironment,
  onCreateEnvironment,
  onRenameEnvironment,
  onRefreshHostStatus,
  tr,
}: Props) {
  const selected = sessions.find((s) => s.id === selectedId);
  const hasSessions = sessions.length > 0;
  const hasAnyConnections = sessions.length > 0 || zkConnections.length > 0 || redisConnections.length > 0 || mysqlConnections.length > 0;
  const [hostQuery, setHostQuery] = useState("");
  const [appVersion, setAppVersion] = useState("");
  const [environmentModalOpen, setEnvironmentModalOpen] = useState(false);
  const [environmentInput, setEnvironmentInput] = useState("");
  const [selectedEnvironment, setSelectedEnvironment] = useState(currentEnvironment);
  const normalizedHostQuery = hostQuery.trim().toLowerCase();
  const filteredSessions = normalizedHostQuery
    ? sessions.filter((session) => {
        const fields = [session.name, session.host, session.username].map((value) => value.toLowerCase());
        return fields.some((field) => field.includes(normalizedHostQuery));
      })
    : sessions;
  const hasSearchResult = filteredSessions.length > 0;
  const showSearchNoResults = hasSessions && !hasSearchResult && normalizedHostQuery.length > 0;
  const selectedSearchSession = selectedId ? sessions.find((session) => session.id === selectedId) : undefined;
  const canQuickConnect = !!selectedSearchSession && connectingSessionId !== selectedSearchSession.id;

  useEffect(() => {
    void getVersion()
      .then((v) => setAppVersion(v))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!environmentModalOpen) return;
    setEnvironmentInput(currentEnvironment);
    setSelectedEnvironment(currentEnvironment);
  }, [environmentModalOpen, currentEnvironment]);

  useEffect(() => {
    if (!environmentModalOpen) return;
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setEnvironmentModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, [environmentModalOpen]);

  return (
    <section className="workspace home-page">
      <header className="topbar">
        <div className="topbar-title">
          <div className="topbar-title-text">
            <div className="topbar-title-line">
              rshell
              {appVersion ? (
                <span className="topbar-app-version" title={tr("home.appVersionTitle")}>
                  v{appVersion}
                </span>
              ) : null}
            </div>
            <div className="topbar-subtitle">{tr("top.subtitle")}</div>
          </div>
        </div>
        <div className="actions">
          <ColorThemeToggle tr={tr} />
          <div className="lang-switch" role="group" aria-label={tr("top.ariaLanguageSwitch")}>
            <button
              className={`btn btn-ghost ${lang === "zh-CN" ? "lang-active" : ""}`}
              onClick={() => onSwitchLang("zh-CN")}
              title={tr("lang.switchToZh")}
              aria-pressed={lang === "zh-CN"}
            >
              {tr("lang.zh")}
            </button>
            <button
              className={`btn btn-ghost ${lang === "en-US" ? "lang-active" : ""}`}
              onClick={() => onSwitchLang("en-US")}
              title={tr("lang.switchToEn")}
              aria-pressed={lang === "en-US"}
            >
              {tr("lang.en")}
            </button>
          </div>
          <button
            className="btn"
            onClick={() => void onConnect(selectedSearchSession?.id)}
            disabled={!canQuickConnect}
            title={selectedSearchSession ? tr("session.connectTitle", { name: selectedSearchSession.name }) : tr("top.noHostSelected")}
          >
            {connectingSessionId === selectedSearchSession?.id ? tr("session.connectingAction") : tr("session.connect")}
          </button>
          <button className="btn btn-ghost" onClick={() => void onOnlineUpgrade()} disabled={upgradeChecking}>
            {upgradeChecking ? tr("top.upgradeChecking") : tr("top.upgrade")}
          </button>
          <button className="btn btn-ghost" onClick={onOpenAudit}>
            {tr("home.audit")}
          </button>
          <span className={connected ? "pill pill-ok" : "pill"} aria-live="polite">
            {connected ? tr("top.online") : tr("top.offline")}
          </span>
          <button
            className="btn btn-ghost"
            disabled={environmentBusy}
            onClick={() => setEnvironmentModalOpen(true)}
            title={tr("top.environment")}
          >
            {tr("top.environmentCurrent", { name: currentEnvironment })}
          </button>
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
            <div className="home-panel-header-actions">
              <button
                type="button"
                className="btn btn-ghost home-refresh-status"
                onClick={() => onRefreshHostStatus()}
                disabled={!hasSessions || refreshBusy}
                title={tr("home.refreshStatusHint")}
              >
                {refreshBusy ? tr("home.refreshStatusRunning") : tr("home.refreshStatus")}
              </button>
              <div className="home-header-status" role="status" aria-live="polite">
                {status}
              </div>
            </div>
          </div>
          <div className="home-panel-body">
            <div className="home-list-wrapper">
              <div className="home-search-row">
                <input
                  className="home-search-input"
                  type="search"
                  value={hostQuery}
                  onChange={(event) => setHostQuery(event.target.value)}
                  placeholder={tr("home.searchHostsPlaceholder")}
                  aria-label={tr("home.searchHostsPlaceholder")}
                />
              </div>
              <SessionList
                sessions={filteredSessions}
                connectingSessionId={connectingSessionId}
                selectedId={selectedId}
                reachabilityMap={reachabilityMap}
                onSelect={onSelect}
                onCreate={onCreate}
                onCreateZk={onCreateZk}
                onCreateRedis={onCreateRedis}
                onCreateMySql={onCreateMysql}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onTestConnect={onTestConnect}
                onTestZk={onTestZk}
                onGetSecret={onGetSecret}
                onGetZkSecret={onGetZkSecret}
                onConnect={(id) => void onConnect(id)}
                zkConnections={zkConnections}
                onConnectZk={onConnectZk}
                onUpdateZk={onUpdateZk}
                onDeleteZk={onDeleteZk}
                redisConnections={redisConnections}
                mysqlConnections={mysqlConnections}
                onConnectRedis={onConnectRedis}
                onConnectMySql={onConnectMysql}
                onGetRedisSecret={onGetRedisSecret}
                onUpdateRedis={onUpdateRedis}
                onDeleteRedis={onDeleteRedis}
                onDeleteMySql={onDeleteMysql}
                onGetMysqlSecret={onGetMysqlSecret}
                onUpdateMysql={onUpdateMysql}
              />
              {showSearchNoResults ? <div className="home-search-empty">{tr("home.searchNoResults")}</div> : null}
              {!hasAnyConnections ? (
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
      {environmentModalOpen ? (
        <div className="modal-backdrop" onClick={() => setEnvironmentModalOpen(false)}>
          <div className="modal-card env-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h4>{tr("top.environment")}</h4>
              <button
                type="button"
                className="modal-close"
                onClick={() => setEnvironmentModalOpen(false)}
                title={tr("modal.close")}
              >
                ×
              </button>
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
              <button className="btn btn-ghost" onClick={() => setEnvironmentModalOpen(false)} disabled={environmentBusy}>
                {tr("modal.cancel")}
              </button>
              <button
                className="btn btn-ghost"
                disabled={environmentBusy || !selectedEnvironment}
                onClick={async () => {
                  await onSwitchEnvironment(selectedEnvironment);
                  setEnvironmentModalOpen(false);
                }}
              >
                {tr("top.environmentSwitch")}
              </button>
              <button
                className="btn btn-ghost"
                disabled={environmentBusy || !environmentInput.trim()}
                onClick={async () => {
                  await onCreateEnvironment(environmentInput.trim());
                  setEnvironmentModalOpen(false);
                }}
              >
                {tr("top.environmentCreate")}
              </button>
              <button
                className="btn"
                disabled={environmentBusy || !environmentInput.trim()}
                onClick={async () => {
                  await onRenameEnvironment(environmentInput.trim());
                  setEnvironmentModalOpen(false);
                }}
              >
                {tr("top.environmentRename")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
