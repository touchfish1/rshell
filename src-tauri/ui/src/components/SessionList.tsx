import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import type { HostReachability, Session, SessionInput } from "../services/types";
import { HostCreateModal } from "./session/HostCreateModal";
import { HostEditModal } from "./session/HostEditModal";
import { SessionRow } from "./session/SessionRow";
import { SessionTableHead } from "./session/SessionTableHead";
import { SessionListToolbar } from "./session/SessionListToolbar";
import { useSessionListForms } from "./session/useSessionListForms";
import { useI18n } from "../i18n-context";
import { getRecentSessionIds } from "../lib/recentSessions";
import { orderSessionsByRecent } from "../lib/orderSessionsByRecent";
import { sessionInputFromSession } from "../lib/sessionInput";
import { useSessionListColumns } from "../hooks/useSessionListColumns";
import { ConfirmDialog } from "./ConfirmDialog";

interface Props {
  sessions: Session[];
  connectingSessionId?: string | null;
  selectedId?: string;
  reachabilityMap: Record<string, HostReachability>;
  onSelect: (id: string) => void;
  onCreate: (input: SessionInput, secret?: string) => Promise<void>;
  onUpdate: (id: string, input: SessionInput, secret?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onTestConnect: (input: SessionInput) => Promise<HostReachability>;
  onGetSecret: (id: string) => Promise<string | null>;
  onConnect?: (id: string) => void;
}

export default function SessionList({
  sessions,
  connectingSessionId,
  selectedId,
  reachabilityMap,
  onSelect,
  onCreate,
  onUpdate,
  onDelete,
  onTestConnect,
  onGetSecret,
  onConnect,
}: Props) {
  const { tr } = useI18n();
  const [hostQuery, setHostQuery] = useState("");
  const [recentIds, setRecentIds] = useState(() => getRecentSessionIds());
  const [pendingDelete, setPendingDelete] = useState<Session | null>(null);

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

  const {
    createForm,
    setCreateForm,
    createSecret,
    setCreateSecret,
    createTesting,
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
    onUpdate,
    onTestConnect,
    onGetSecret,
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
              onEdit={openEdit}
              onDuplicate={(item) => void duplicateHost(item)}
              onDelete={(id) => {
                const target = sessions.find((item) => item.id === id);
                if (!target) return;
                setPendingDelete(target);
              }}
            />
          );
        })}
        {displayedSessions.length === 0 && sessions.length > 0 && hostQuery.trim() ? (
          <li className="session-search-empty" role="status">
            {tr("home.searchNoResults")}
          </li>
        ) : null}
      </ul>
      <HostCreateModal
        open={showCreateModal}
        form={createForm}
        secret={createSecret}
        testing={createTesting}
        testResult={createTestResult}
        hostInputRef={hostInputRef}
        protocolPort={createProtocolPort}
        onClose={() => setShowCreateModal(false)}
        onChangeForm={setCreateForm}
        onChangeSecret={setCreateSecret}
        onTest={() => void testCreateConnect()}
        onSubmit={() => void submitCreate()}
      />
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={tr("session.delete")}
        message={
          pendingDelete ? tr("session.deleteConfirm", { name: pendingDelete.name }) : ""
        }
        cancelLabel={tr("modal.cancel")}
        confirmLabel={tr("session.delete")}
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) void runDelete(pendingDelete);
        }}
      />
      <HostEditModal
        session={editSession}
        form={editForm}
        secret={editSecret}
        secretVisible={editSecretVisible}
        secretLoading={editSecretLoading}
        testResult={editTestResult}
        testing={editTesting}
        protocolPort={editProtocolPort}
        onClose={closeEdit}
        onChangeForm={setEditForm}
        onChangeSecret={setEditSecret}
        onChangeSecretVisible={() => void toggleEditSecretVisible()}
        onTest={() => void testEditConnect()}
        onSubmit={() => void submitEdit()}
        onMarkSecretDirty={markEditSecretDirty}
      />
    </aside>
  );
}
