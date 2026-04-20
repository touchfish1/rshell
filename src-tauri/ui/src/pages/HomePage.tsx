import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import SessionList from "../components/SessionList";
import AuditLogModal from "../components/AuditLogModal";
import { ColorThemeToggle } from "../components/ColorThemeToggle";
import { ErrorBanner } from "../components/ErrorBanner";
import type {
  HostReachability,
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
  onConnectRedis: (id: string) => void;
  onGetRedisSecret: (id: string) => Promise<string | null>;
  onUpdateRedis: (id: string, input: RedisConnectionInput, secret?: string) => Promise<void>;
  onDeleteRedis: (id: string) => Promise<void>;
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
  onRefreshHostStatus: () => void;
  onOpenZookeeper: () => void;
  onOpenRedis: () => void;
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
  onConnectRedis,
  onGetRedisSecret,
  onUpdateRedis,
  onDeleteRedis,
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
  onRefreshHostStatus,
  onOpenZookeeper,
  onOpenRedis,
  tr,
}: Props) {
  const selected = sessions.find((s) => s.id === selectedId);
  const hasSessions = sessions.length > 0;
  const hasAnyConnections = sessions.length > 0 || zkConnections.length > 0 || redisConnections.length > 0;
  const [appVersion, setAppVersion] = useState("");

  useEffect(() => {
    void getVersion()
      .then((v) => setAppVersion(v))
      .catch(() => undefined);
  }, []);

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
          <button className="btn btn-ghost" onClick={() => void onOnlineUpgrade()} disabled={upgradeChecking}>
            {upgradeChecking ? tr("top.upgradeChecking") : tr("top.upgrade")}
          </button>
          <button className="btn btn-ghost" onClick={onOpenAudit}>
            {tr("home.audit")}
          </button>
          <button className="btn btn-ghost" onClick={onOpenZookeeper}>
            {tr("home.zookeeper")}
          </button>
          <button className="btn btn-ghost" onClick={onOpenRedis}>
            {tr("home.redis")}
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
              <div className="home-header-status">{status}</div>
            </div>
          </div>
          <div className="home-panel-body">
            <div className="home-list-wrapper">
              <SessionList
                sessions={sessions}
                connectingSessionId={connectingSessionId}
                selectedId={selectedId}
                reachabilityMap={reachabilityMap}
                onSelect={onSelect}
                onCreate={onCreate}
                onCreateZk={onCreateZk}
                onCreateRedis={onCreateRedis}
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
                onConnectRedis={onConnectRedis}
                onGetRedisSecret={onGetRedisSecret}
                onUpdateRedis={onUpdateRedis}
                onDeleteRedis={onDeleteRedis}
              />
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
