import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import type {
  HostReachability,
  RedisConnection,
  RedisConnectionInput,
  Session,
  SessionInput,
  ZookeeperConnection,
  ZookeeperConnectionInput,
} from "../services/types";
import { HostCreateModal } from "./session/HostCreateModal";
import { HostEditModal } from "./session/HostEditModal";
import { SessionListBody } from "./session/SessionListBody";
import { SessionListModals } from "./session/SessionListModals";
import { SessionTableHead } from "./session/SessionTableHead";
import { SessionListToolbar } from "./session/SessionListToolbar";
import { useSessionListForms } from "./session/useSessionListForms";
import { useZkSessionEditor } from "./session/useZkSessionEditor";
import { useRedisConnectionEditor } from "./session/useRedisConnectionEditor";
import { useI18n } from "../i18n-context";
import { getRecentSessionIds } from "../lib/recentSessions";
import { orderSessionsByRecent } from "../lib/orderSessionsByRecent";
import { sessionInputFromSession } from "../lib/sessionInput";
import { useSessionListColumns } from "../hooks/useSessionListColumns";
import { ZkConnectionRow } from "./session/ZkConnectionRow";

interface Props {
  sessions: Session[];
  connectingSessionId?: string | null;
  selectedId?: string;
  reachabilityMap: Record<string, HostReachability>;
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
  onConnect?: (id: string) => void;
  zkConnections: ZookeeperConnection[];
  onConnectZk?: (id: string) => void;
  onUpdateZk: (id: string, input: ZookeeperConnectionInput, secret?: string) => Promise<void>;
  onDeleteZk: (id: string) => Promise<void>;
  redisConnections: RedisConnection[];
  onConnectRedis?: (id: string) => void;
  onUpdateRedis: (id: string, input: RedisConnectionInput, secret?: string) => Promise<void>;
  onDeleteRedis: (id: string) => Promise<void>;
  onGetRedisSecret: (id: string) => Promise<string | null>;
}

export default function SessionList({
  sessions,
  connectingSessionId,
  selectedId,
  reachabilityMap,
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
  onConnect,
  zkConnections,
  onConnectZk,
  onUpdateZk,
  onDeleteZk,
  redisConnections,
  onConnectRedis,
  onUpdateRedis,
  onDeleteRedis,
  onGetRedisSecret,
}: Props) {
  const { tr } = useI18n();
  const [hostQuery, setHostQuery] = useState("");
  const [recentIds, setRecentIds] = useState(() => getRecentSessionIds());
  const [pendingDelete, setPendingDelete] = useState<Session | null>(null);
  const [pendingDeleteRedis, setPendingDeleteRedis] = useState<RedisConnection | null>(null);

  const { gridStyle, onResizeNameStart, onResizeHostStart } = useSessionListColumns();

  useEffect(() => {
    const onBump = () => setRecentIds(getRecentSessionIds());
    window.addEventListener("rshell-recent-bumped", onBump);
    return () => window.removeEventListener("rshell-recent-bumped", onBump);
  }, []);

  const displayedSessions = useMemo(() => {
    const q = hostQuery.trim().toLowerCase();
    const matches = (s: Session) => {
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.host.toLowerCase().includes(q) ||
        s.username.toLowerCase().includes(q) ||
        s.protocol.toLowerCase().includes(q) ||
        String(s.port).includes(q)
      );
    };
    const filtered = sessions.filter(matches);
    return orderSessionsByRecent(filtered, recentIds);
  }, [sessions, recentIds, hostQuery]);

  const displayedZkConnections = useMemo(() => {
    const q = hostQuery.trim().toLowerCase();
    if (!q) return zkConnections;
    return zkConnections.filter((conn) => {
      return (
        conn.name.toLowerCase().includes(q) ||
        conn.connect_string.toLowerCase().includes(q) ||
        "zookeeper".includes(q)
      );
    });
  }, [hostQuery, zkConnections]);
  const displayedRedisConnections = useMemo(() => {
    const q = hostQuery.trim().toLowerCase();
    if (!q) return redisConnections;
    return redisConnections.filter((conn) => {
      return (
        conn.name.toLowerCase().includes(q) ||
        conn.address.toLowerCase().includes(q) ||
        "redis".includes(q) ||
        `db${conn.db}`.includes(q)
      );
    });
  }, [hostQuery, redisConnections]);

  const duplicateHost = async (session: Session) => {
    const copyName = `${session.name}-${tr("session.copySuffix")}`;
    const input = sessionInputFromSession(session, copyName);
    const secret = await onGetSecret(session.id);
    await onCreate(input, secret ?? undefined);
  };

  const runDelete = async (session: Session) => {
    await onDelete(session.id);
    setPendingDelete(null);
  };
  const runDeleteZk = async (conn: ZookeeperConnection) => {
    await onDeleteZk(conn.id);
    setPendingDeleteZk(null);
  };
  const runDeleteRedis = async (conn: RedisConnection) => {
    await onDeleteRedis(conn.id);
    setPendingDeleteRedis(null);
  };
  const {
    redisEditConnection,
    redisEditForm,
    setRedisEditForm,
    redisEditSecret,
    setRedisEditSecret,
    redisEditTesting,
    redisEditSaving,
    redisEditResult,
    openEditRedis,
    closeEditRedis,
    testEditRedis,
    submitEditRedis,
  } = useRedisConnectionEditor({
    onGetRedisSecret,
    onUpdateRedis,
    tr,
  });

  const {
    pendingDeleteZk,
    setPendingDeleteZk,
    zkEditConnection,
    zkEditForm,
    setZkEditForm,
    zkEditSecret,
    setZkEditSecret,
    zkEditSecretVisible,
    setZkEditSecretVisible,
    zkEditSecretLoading,
    zkEditTesting,
    zkEditSaving,
    zkEditTestResult,
    openEditZk,
    closeEditZk,
    submitEditZk,
    testEditZk,
  } = useZkSessionEditor({
    onGetZkSecret,
    onUpdateZk,
    onTestZk,
    tr,
  });

  const {
    createForm,
    setCreateForm,
    createSecret,
    setCreateSecret,
    createTesting,
    createSubmitting,
    createTestResult,
    showCreateModal,
    setShowCreateModal,
    editSession,
    editForm,
    setEditForm,
    editSecret,
    setEditSecret,
    editSecretVisible,
    editSecretLoading,
    editTesting,
    editTestResult,
    hostInputRef,
    createProtocolPort,
    editProtocolPort,
    submitCreate,
    openEdit,
    closeEdit,
    submitEdit,
    toggleEditSecretVisible,
    testCreateConnect,
    testEditConnect,
    markEditSecretDirty,
  } = useSessionListForms({
    onCreate,
    onCreateZk,
    onCreateRedis,
    onUpdate,
    onTestConnect,
    onTestZk,
    onGetSecret,
    onConnect,
    onConnectZk,
    onConnectRedis,
    tr,
  });

  const moveListSelection = useCallback(
    (delta: number) => {
      if (displayedSessions.length === 0) return;
      const cur = displayedSessions.findIndex((s) => s.id === selectedId);
      const base = cur < 0 ? 0 : cur;
      const next = Math.max(0, Math.min(displayedSessions.length - 1, base + delta));
      onSelect(displayedSessions[next].id);
    },
    [displayedSessions, onSelect, selectedId]
  );

  const onListKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (showCreateModal || editSession || pendingDelete) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveListSelection(1);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      moveListSelection(-1);
      return;
    }
    if (e.key === "Home" && displayedSessions.length > 0) {
      e.preventDefault();
      onSelect(displayedSessions[0].id);
      return;
    }
    if (e.key === "End" && displayedSessions.length > 0) {
      e.preventDefault();
      onSelect(displayedSessions[displayedSessions.length - 1].id);
      return;
    }
    if ((e.key === "j" || e.key === "J") && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      moveListSelection(1);
      return;
    }
    if ((e.key === "k" || e.key === "K") && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      moveListSelection(-1);
      return;
    }
    if (e.key === "Enter" && selectedId) {
      e.preventDefault();
      if (connectingSessionId !== selectedId) {
        onConnect?.(selectedId);
      }
      return;
    }
    if (e.key === "F2" && selectedId) {
      const row = sessions.find((s) => s.id === selectedId);
      if (row) {
        e.preventDefault();
        openEdit(row);
      }
    }
  };

  return (
    <aside className="session-list" style={gridStyle}>
      <SessionListToolbar
        hostQuery={hostQuery}
        onHostQueryChange={setHostQuery}
        tr={tr}
        onOpenCreate={() => setShowCreateModal(true)}
      />
      <SessionTableHead onResizeNameStart={onResizeNameStart} onResizeHostStart={onResizeHostStart} />
      <SessionListBody
        tr={tr}
        sessions={sessions}
        displayedSessions={displayedSessions}
        displayedZkConnections={displayedZkConnections}
        displayedRedisConnections={displayedRedisConnections}
        selectedId={selectedId}
        connectingSessionId={connectingSessionId}
        hostQuery={hostQuery}
        reachabilityMap={reachabilityMap}
        onListKeyDown={onListKeyDown}
        onSelect={onSelect}
        onConnect={onConnect}
        onConnectZk={onConnectZk}
        onConnectRedis={onConnectRedis}
        onOpenEditSession={openEdit}
        onDuplicateHost={(item) => void duplicateHost(item)}
        onAskDeleteSession={(id) => {
          const target = sessions.find((item) => item.id === id);
          if (!target) return;
          setPendingDelete(target);
        }}
        onOpenEditZk={openEditZk}
        onAskDeleteZk={setPendingDeleteZk}
        onOpenEditRedis={openEditRedis}
        onAskDeleteRedis={setPendingDeleteRedis}
      />
      <SessionListModals
        tr={tr}
        pendingDelete={pendingDelete}
        pendingDeleteRedis={pendingDeleteRedis}
        pendingDeleteZk={pendingDeleteZk}
        onCancelDeleteSession={() => setPendingDelete(null)}
        onCancelDeleteRedis={() => setPendingDeleteRedis(null)}
        onCancelDeleteZk={() => setPendingDeleteZk(null)}
        onConfirmDeleteSession={() => {
          if (pendingDelete) void runDelete(pendingDelete);
        }}
        onConfirmDeleteRedis={() => {
          if (pendingDeleteRedis) void runDeleteRedis(pendingDeleteRedis);
        }}
        onConfirmDeleteZk={() => {
          if (pendingDeleteZk) void runDeleteZk(pendingDeleteZk);
        }}
        showCreateModal={showCreateModal}
        createForm={createForm}
        createSecret={createSecret}
        createTesting={createTesting}
        createSubmitting={createSubmitting}
        createTestResult={createTestResult}
        hostInputRef={hostInputRef}
        createProtocolPort={createProtocolPort}
        onCloseCreate={() => setShowCreateModal(false)}
        onChangeCreateForm={setCreateForm}
        onChangeCreateSecret={setCreateSecret}
        onTestCreate={() => void testCreateConnect()}
        onSubmitCreate={(connect) => void submitCreate(connect)}
        editSession={editSession}
        editForm={editForm}
        editSecret={editSecret}
        editSecretVisible={editSecretVisible}
        editSecretLoading={editSecretLoading}
        editTesting={editTesting}
        editTestResult={editTestResult}
        editProtocolPort={editProtocolPort}
        onCloseEdit={closeEdit}
        onChangeEditForm={setEditForm}
        onChangeEditSecret={setEditSecret}
        onToggleEditSecretVisible={() => void toggleEditSecretVisible()}
        onTestEdit={() => void testEditConnect()}
        onSubmitEdit={() => void submitEdit()}
        onMarkEditSecretDirty={markEditSecretDirty}
        zkEditConnection={zkEditConnection}
        zkEditForm={zkEditForm}
        zkEditSecret={zkEditSecret}
        zkEditSecretVisible={zkEditSecretVisible}
        zkEditSecretLoading={zkEditSecretLoading}
        zkEditTesting={zkEditTesting}
        zkEditSaving={zkEditSaving}
        zkEditTestResult={zkEditTestResult}
        onCloseEditZk={closeEditZk}
        onChangeZkEditForm={setZkEditForm}
        onChangeZkEditSecret={setZkEditSecret}
        onToggleZkEditSecretVisible={() => setZkEditSecretVisible((prev) => !prev)}
        onTestEditZk={() => void testEditZk()}
        onSubmitEditZk={() => void submitEditZk()}
        redisEditConnection={redisEditConnection}
        redisEditForm={redisEditForm}
        redisEditSecret={redisEditSecret}
        redisEditTesting={redisEditTesting}
        redisEditSaving={redisEditSaving}
        redisEditResult={redisEditResult}
        onCloseEditRedis={closeEditRedis}
        onChangeRedisEditForm={setRedisEditForm}
        onChangeRedisEditSecret={setRedisEditSecret}
        onTestEditRedis={() => void testEditRedis()}
        onSubmitEditRedis={() => void submitEditRedis()}
      />
    </aside>
  );
}
