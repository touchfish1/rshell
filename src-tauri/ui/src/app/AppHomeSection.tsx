import HomePage from "../pages/HomePage";
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

type TranslateFn = (key: I18nKey, vars?: Record<string, string | number>) => string;

interface AppHomeSectionProps {
  sessions: Session[];
  zkConnections: ZookeeperConnection[];
  redisConnections: RedisConnection[];
  mysqlConnections: MySqlConnection[];
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
  onConnect: (id?: string) => Promise<void>;
  onConnectZk: (id: string) => void;
  onUpdateZk: (id: string, input: ZookeeperConnectionInput, secret?: string) => Promise<void>;
  onDeleteZk: (id: string) => Promise<void>;
  redisConnections: RedisConnection[];
  onConnectRedis: (id: string) => void;
  onConnectMysql: (id: string) => void;
  onGetRedisSecret: (id: string) => Promise<string | null>;
  onUpdateRedis: (id: string, input: RedisConnectionInput, secret?: string) => Promise<void>;
  onDeleteRedis: (id: string) => Promise<void>;
  onDeleteMysql: (id: string) => Promise<void>;
  onGetMysqlSecret: (id: string) => Promise<string | null>;
  onUpdateMysql: (id: string, input: MySqlConnectionInput, secret?: string) => Promise<void>;
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
  tr: TranslateFn;
}

export function AppHomeSection(props: AppHomeSectionProps) {
  return <HomePage {...props} />;
}
