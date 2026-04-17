import type { Session, SessionInput } from "../services/types";
import { HostCreateModal } from "./session/HostCreateModal";
import { HostEditModal } from "./session/HostEditModal";
import { SessionRow } from "./session/SessionRow";
import { SessionTableHead } from "./session/SessionTableHead";
import { useSessionListForms } from "./session/useSessionListForms";
import { useI18n } from "../i18n-context";

interface Props {
  sessions: Session[];
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
    moreOpenId,
    setMoreOpenId,
    hostInputRef,
    moreMenuRef,
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
    <aside className="session-list">
      <div className="session-list-header">
        <h3>{tr("session.management")}</h3>
        <button
          className="btn btn-ghost"
          onClick={() => setShowCreateModal(true)}
          title={tr("session.addHost")}
        >
          {tr("session.addHost")}
        </button>
      </div>
      <SessionTableHead />
      <ul className="session-table-body">
        {sessions.map((session) => {
          const active = selectedId === session.id;
          const pinging = pingingIds.includes(session.id);
          const online = onlineMap[session.id] ?? false;
          return (
            <SessionRow
              key={session.id}
              session={session}
              selected={active}
              pinging={pinging}
              online={online}
              onSelectAndConnect={(id) => {
                onSelect(id);
                onConnect?.(id);
              }}
              onConnect={onConnect}
              onEdit={openEdit}
              onDelete={(id) => void onDelete(id)}
              moreOpenId={moreOpenId}
              onToggleMore={(id) => setMoreOpenId((prev) => (prev === id ? null : id))}
              onCloseMore={() => setMoreOpenId(null)}
              moreMenuRef={moreMenuRef}
            />
          );
        })}
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
