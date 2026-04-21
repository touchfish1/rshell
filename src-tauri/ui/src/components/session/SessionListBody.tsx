import type { KeyboardEvent } from "react";
import type { HostReachability, MySqlConnection, RedisConnection, Session, ZookeeperConnection } from "../../services/types";
import { MySqlConnectionRow } from "./MySqlConnectionRow";
import type { TrFn } from "../../i18n-context";
import { RedisConnectionRow } from "./RedisConnectionRow";
import { SessionRow } from "./SessionRow";
import { ZkConnectionRow } from "./ZkConnectionRow";

interface Props {
  tr: TrFn;
  sessions: Session[];
  displayedSessions: Session[];
  displayedZkConnections: ZookeeperConnection[];
  displayedRedisConnections: RedisConnection[];
  displayedMySqlConnections: MySqlConnection[];
  selectedId?: string;
  connectingSessionId?: string | null;
  hostQuery: string;
  reachabilityMap: Record<string, HostReachability>;
  onListKeyDown: (e: KeyboardEvent<HTMLUListElement>) => void;
  onSelect: (id: string) => void;
  onConnect?: (id: string) => void;
  onConnectZk?: (id: string) => void;
  onConnectRedis?: (id: string) => void;
  onConnectMySql?: (id: string) => void;
  onOpenEditSession: (session: Session) => void;
  onDuplicateHost: (session: Session) => void;
  onAskDeleteSession: (id: string) => void;
  onOpenEditZk: (conn: ZookeeperConnection) => void;
  onAskDeleteZk: (conn: ZookeeperConnection) => void;
  onOpenEditRedis: (conn: RedisConnection) => void;
  onAskDeleteRedis: (conn: RedisConnection) => void;
  onOpenEditMySql: (conn: MySqlConnection) => void;
  onAskDeleteMySql: (conn: MySqlConnection) => void;
}

export function SessionListBody({
  tr,
  sessions,
  displayedSessions,
  displayedZkConnections,
  displayedRedisConnections,
  displayedMySqlConnections,
  selectedId,
  connectingSessionId,
  hostQuery,
  reachabilityMap,
  onListKeyDown,
  onSelect,
  onConnect,
  onConnectZk,
  onConnectRedis,
  onConnectMySql,
  onOpenEditSession,
  onDuplicateHost,
  onAskDeleteSession,
  onOpenEditZk,
  onAskDeleteZk,
  onOpenEditRedis,
  onAskDeleteRedis,
  onOpenEditMySql,
  onAskDeleteMySql,
}: Props) {
  return (
    <ul className="session-table-body" tabIndex={0} aria-label={tr("session.listKeyboardHint")} onKeyDown={onListKeyDown}>
      {displayedSessions.map((session) => {
        const active = selectedId === session.id;
        const reach = reachabilityMap[session.id];
        const online = reach?.online ?? false;
        const latencyMs = online && reach?.latency_ms != null ? reach.latency_ms : null;
        const isConnectingHost = connectingSessionId === session.id;
        return (
          <SessionRow
            key={session.id}
            session={session}
            selected={active}
            online={online}
            latencyMs={latencyMs}
            isConnecting={isConnectingHost}
            onSelectAndConnect={(id) => {
              onSelect(id);
              if (connectingSessionId !== id) {
                onConnect?.(id);
              }
            }}
            onConnect={onConnect}
            onEdit={onOpenEditSession}
            onDuplicate={(item) => onDuplicateHost(item)}
            onDelete={onAskDeleteSession}
          />
        );
      })}
      {displayedSessions.length === 0 && sessions.length > 0 && hostQuery.trim() ? (
        <li className="session-search-empty" role="status">
          {tr("home.searchNoResults")}
        </li>
      ) : null}
      {displayedZkConnections.map((conn) => (
        <ZkConnectionRow key={`zk-${conn.id}`} conn={conn} tr={tr} onConnect={onConnectZk} onEdit={onOpenEditZk} onDelete={onAskDeleteZk} />
      ))}
      {displayedRedisConnections.map((conn) => (
        <RedisConnectionRow
          key={`redis-${conn.id}`}
          conn={conn}
          tr={tr}
          onConnect={onConnectRedis}
          onEdit={onOpenEditRedis}
          onDelete={onAskDeleteRedis}
        />
      ))}
      {displayedMySqlConnections.map((conn) => (
        <MySqlConnectionRow
          key={`mysql-${conn.id}`}
          conn={conn}
          tr={tr}
          onConnect={onConnectMySql}
          onEdit={onOpenEditMySql}
          onDelete={onAskDeleteMySql}
        />
      ))}
    </ul>
  );
}
