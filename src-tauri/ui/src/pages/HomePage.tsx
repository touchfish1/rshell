import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import SessionList from "../components/SessionList";
import AuditLogModal from "../components/AuditLogModal";
import { ErrorBanner } from "../components/ErrorBanner";
import { EnvironmentModal } from "../components/EnvironmentModal";
import { HomePageTopBar } from "../components/HomePageTopBar";
import type {
  EtcdConnection,
  EtcdConnectionInput,
  HostReachability,
  MySqlConnection,
  MySqlConnectionInput,
  PostgreSqlConnection,
  PostgreSqlConnectionInput,
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
  postgresqlConnections: PostgreSqlConnection[];
  onConnectRedis: (id: string) => void;
  onConnectMysql: (id: string) => void;
  onGetRedisSecret: (id: string) => Promise<string | null>;
  onUpdateRedis: (id: string, input: RedisConnectionInput, secret?: string) => Promise<void>;
  onDeleteRedis: (id: string) => Promise<void>;
  onDeleteMysql: (id: string) => Promise<void>;
  onGetMysqlSecret: (id: string) => Promise<string | null>;
  onUpdateMysql: (id: string, input: MySqlConnectionInput, secret?: string) => Promise<void>;
  onCreatePostgreSql: (input: PostgreSqlConnectionInput, secret?: string) => Promise<PostgreSqlConnection | null>;
  onConnectPostgreSql: (id: string) => void;
  onDeletePostgreSql: (id: string) => Promise<void>;
  onGetPostgreSqlSecret: (id: string) => Promise<string | null>;
  onUpdatePostgreSql: (id: string, input: PostgreSqlConnectionInput, secret?: string) => Promise<void>;
  etcdConnections: EtcdConnection[];
  onConnectEtcd: (id: string) => void;
  onCreateEtcd: (input: EtcdConnectionInput, secret?: string) => Promise<EtcdConnection | null>;
  onDeleteEtcd: (id: string) => Promise<void>;
  onGetEtcdSecret: (id: string) => Promise<string | null>;
  onUpdateEtcd: (id: string, input: EtcdConnectionInput, secret?: string) => Promise<void>;
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
  onOpenUnifiedCreate?: () => void;
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
  postgresqlConnections,
  onConnectRedis,
  onConnectMysql,
  onConnectPostgreSql,
  onGetRedisSecret,
  onUpdateRedis,
  onDeleteRedis,
  onDeleteMysql,
  onGetMysqlSecret,
  onUpdateMysql,
  onCreatePostgreSql,
  onDeletePostgreSql,
  onGetPostgreSqlSecret,
  onUpdatePostgreSql,
  etcdConnections,
  onConnectEtcd,
  onCreateEtcd,
  onDeleteEtcd,
  onGetEtcdSecret,
  onUpdateEtcd,
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
  onOpenUnifiedCreate,
}: Props) {
  const selected = sessions.find((s) => s.id === selectedId);
  const hasSessions = sessions.length > 0;
  const hasAnyConnections = sessions.length > 0 || zkConnections.length > 0 || redisConnections.length > 0 || mysqlConnections.length > 0 || postgresqlConnections.length > 0 || etcdConnections.length > 0;
  const [hostQuery, setHostQuery] = useState("");
  const [appVersion, setAppVersion] = useState("");
  const [environmentModalOpen, setEnvironmentModalOpen] = useState(false);
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

  return (
    <section className="workspace home-page">
      <HomePageTopBar
        lang={lang}
        appVersion={appVersion}
        connectingSessionId={connectingSessionId}
        selectedSearchSession={selectedSearchSession}
        connected={connected}
        upgradeChecking={upgradeChecking}
        environmentBusy={environmentBusy}
        currentEnvironment={currentEnvironment}
        tr={tr}
        onSwitchLang={onSwitchLang}
        onConnect={() => { if (canQuickConnect) void onConnect(selectedSearchSession?.id); }}
        onOnlineUpgrade={onOnlineUpgrade}
        onOpenUnifiedCreate={onOpenUnifiedCreate}
        onOpenAudit={onOpenAudit}
        onOpenEnvironment={() => setEnvironmentModalOpen(true)}
      />

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
                onCreatePostgreSql={onCreatePostgreSql}
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
                onConnectPostgreSql={onConnectPostgreSql}
                onGetRedisSecret={onGetRedisSecret}
                onUpdateRedis={onUpdateRedis}
                onDeleteRedis={onDeleteRedis}
                onDeleteMySql={onDeleteMysql}
                onGetMysqlSecret={onGetMysqlSecret}
                onUpdateMysql={onUpdateMysql}
                postgresqlConnections={postgresqlConnections}
                onDeletePostgreSql={onDeletePostgreSql}
                onGetPostgreSqlSecret={onGetPostgreSqlSecret}
                onUpdatePostgreSql={onUpdatePostgreSql}
                etcdConnections={etcdConnections}
                onConnectEtcd={onConnectEtcd}
                onCreateEtcd={onCreateEtcd}
                onDeleteEtcd={onDeleteEtcd}
                onGetEtcdSecret={onGetEtcdSecret}
                onUpdateEtcd={onUpdateEtcd}
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
      <EnvironmentModal
        open={environmentModalOpen}
        currentEnvironment={currentEnvironment}
        environments={environments}
        environmentBusy={environmentBusy}
        tr={tr}
        onSwitchEnvironment={onSwitchEnvironment}
        onCreateEnvironment={onCreateEnvironment}
        onRenameEnvironment={onRenameEnvironment}
        onClose={() => setEnvironmentModalOpen(false)}
      />
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
