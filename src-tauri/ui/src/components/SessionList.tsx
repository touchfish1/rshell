import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Session, SessionInput } from "../services/types";
import { HostCreateModal } from "./session/HostCreateModal";
import { HostEditModal } from "./session/HostEditModal";
import { SessionRow } from "./session/SessionRow";
import { SessionTableHead } from "./session/SessionTableHead";
import { useSessionListForms } from "./session/useSessionListForms";
import { useI18n } from "../i18n-context";

const NAME_COL_MIN = 100;
const NAME_COL_MAX = 420;
const HOST_COL_MIN = 140;
const HOST_COL_MAX = 560;
const NAME_COL_STORAGE_KEY = "rshell.sessionList.nameColWidth";
const HOST_COL_STORAGE_KEY = "rshell.sessionList.hostColWidth";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function loadStoredWidth(key: string, fallback: number, min: number, max: number) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return clamp(parsed, min, max);
}

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
  const { tr, lang } = useI18n();
  const [nameColWidth, setNameColWidth] = useState(() =>
    loadStoredWidth(NAME_COL_STORAGE_KEY, 140, NAME_COL_MIN, NAME_COL_MAX)
  );
  const [hostColWidth, setHostColWidth] = useState(() =>
    loadStoredWidth(HOST_COL_STORAGE_KEY, 220, HOST_COL_MIN, HOST_COL_MAX)
  );
  const dragRef = useRef<{
    col: "name" | "host";
    startX: number;
    startWidth: number;
  } | null>(null);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = event.clientX - dragRef.current.startX;
      const next = dragRef.current.startWidth + delta;
      if (dragRef.current.col === "name") {
        setNameColWidth(clamp(next, NAME_COL_MIN, NAME_COL_MAX));
      } else {
        setHostColWidth(clamp(next, HOST_COL_MIN, HOST_COL_MAX));
      }
    };
    const onMouseUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(NAME_COL_STORAGE_KEY, String(nameColWidth));
  }, [nameColWidth]);

  useEffect(() => {
    localStorage.setItem(HOST_COL_STORAGE_KEY, String(hostColWidth));
  }, [hostColWidth]);
  const duplicateHost = async (session: Session) => {
    const copyName = `${session.name}-${lang === "zh-CN" ? "副本" : "copy"}`;
    const input: SessionInput = {
      name: copyName,
      protocol: session.protocol,
      host: session.host,
      port: session.port,
      username: session.username,
      encoding: session.encoding,
      keepalive_secs: session.keepalive_secs,
    };
    const secret = await onGetSecret(session.id);
    await onCreate(input, secret ?? undefined);
  };

  const confirmDelete = async (session: Session) => {
    const ok = window.confirm(
      lang === "zh-CN"
        ? `确定删除主机“${session.name}”吗？`
        : `Are you sure you want to delete host "${session.name}"?`
    );
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
    <aside
      className="session-list"
      style={
        {
          "--session-col-name": `${nameColWidth}px`,
          "--session-col-host": `${hostColWidth}px`,
        } as CSSProperties
      }
    >
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
      <SessionTableHead
        onResizeNameStart={(clientX) => {
          dragRef.current = { col: "name", startX: clientX, startWidth: nameColWidth };
        }}
        onResizeHostStart={(clientX) => {
          dragRef.current = { col: "host", startX: clientX, startWidth: hostColWidth };
        }}
      />
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
              onDuplicate={(item) => void duplicateHost(item)}
              onDelete={(id) => {
                const target = sessions.find((item) => item.id === id);
                if (!target) return;
                void confirmDelete(target);
              }}
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
