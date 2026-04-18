import { useEffect, useMemo, useState } from "react";
import type { Session, SessionInput } from "../services/types";
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

interface Props {
  sessions: Session[];
  connectingSessionId?: string | null;
  selectedId?: string;
  onlineMap: Record<string, boolean>;
  pingingIds: string[];
  onSelect: (id: string) => void;
  onCreate: (input: SessionInput, secret?: string) => Promise<void>;
  onUpdate: (id: string, input: SessionInput, secret?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onTestConnect: (input: SessionInput) => Promise<boolean>;
  onGetSecret: (id: string) => Promise<string | null>;
  onConnect?: (id: string) => void;
}

export default function SessionList({
  sessions,
  connectingSessionId,
  selectedId,
  onlineMap,
  pingingIds,
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

  const confirmDelete = async (session: Session) => {
    const ok = window.confirm(tr("session.deleteConfirm", { name: session.name }));
    if (!ok) return;
    await onDelete(session.id);
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

  return (
    <aside className="session-list" style={gridStyle}>
      <SessionListToolbar
        hostQuery={hostQuery}
        onHostQueryChange={setHostQuery}
        tr={tr}
        onOpenCreate={() => setShowCreateModal(true)}
      />
      <SessionTableHead onResizeNameStart={onResizeNameStart} onResizeHostStart={onResizeHostStart} />
      <ul className="session-table-body">
        {displayedSessions.map((session) => {
          const active = selectedId === session.id;
          const pinging = pingingIds.includes(session.id);
          const online = onlineMap[session.id] ?? false;
          const isConnectingHost = connectingSessionId === session.id;
          return (
            <SessionRow
              key={session.id}
              session={session}
              selected={active}
              pinging={pinging}
              online={online}
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
                void confirmDelete(target);
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
