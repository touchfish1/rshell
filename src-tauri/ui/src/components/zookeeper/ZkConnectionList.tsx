import { useEffect, useMemo, useState } from "react";
import type { ZookeeperConnection, ZookeeperConnectionInput } from "../../services/types";
import { ConfirmDialog } from "../ConfirmDialog";
import { useI18n } from "../../i18n-context";
import { ZkConnectionCreateModal } from "./ZkConnectionCreateModal";
import { ZkConnectionEditModal } from "./ZkConnectionEditModal";

interface Props {
  connections: ZookeeperConnection[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onCreate: (input: ZookeeperConnectionInput, secret?: string) => Promise<ZookeeperConnection | null>;
  onUpdate: (id: string, input: ZookeeperConnectionInput, secret?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onTest: (input: ZookeeperConnectionInput, secret?: string) => Promise<void>;
  onGetSecret: (id: string) => Promise<string | null>;
}

const defaultForm: ZookeeperConnectionInput = {
  name: "",
  connect_string: "",
  session_timeout_ms: 10000,
};

export function ZkConnectionList({
  connections,
  selectedId,
  onSelect,
  onCreate,
  onUpdate,
  onDelete,
  onTest,
  onGetSecret,
}: Props) {
  const { tr } = useI18n();
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<ZookeeperConnectionInput>(defaultForm);
  const [createSecret, setCreateSecret] = useState("");
  const [createTesting, setCreateTesting] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createTestResult, setCreateTestResult] = useState<string | null>(null);

  const [editConn, setEditConn] = useState<ZookeeperConnection | null>(null);
  const [editForm, setEditForm] = useState<ZookeeperConnectionInput>(defaultForm);
  const [editSecret, setEditSecret] = useState("");
  const [editSecretVisible, setEditSecretVisible] = useState(false);
  const [editSecretLoading, setEditSecretLoading] = useState(false);
  const [editTesting, setEditTesting] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editTestResult, setEditTestResult] = useState<string | null>(null);

  const [pendingDelete, setPendingDelete] = useState<ZookeeperConnection | null>(null);

  useEffect(() => {
    if (!showCreate) return;
    setCreateForm(defaultForm);
    setCreateSecret("");
    setCreateTesting(false);
    setCreateSaving(false);
    setCreateTestResult(null);
  }, [showCreate]);

  const displayed = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return connections;
    return connections.filter((c) => c.name.toLowerCase().includes(q) || c.connect_string.toLowerCase().includes(q));
  }, [connections, query]);

  const openEdit = async (conn: ZookeeperConnection) => {
    setEditConn(conn);
    setEditForm({
      name: conn.name,
      connect_string: conn.connect_string,
      session_timeout_ms: conn.session_timeout_ms,
    });
    setEditTestResult(null);
    setEditSecretVisible(false);
    setEditSecretLoading(true);
    try {
      const secret = await onGetSecret(conn.id);
      setEditSecret(secret ?? "");
    } finally {
      setEditSecretLoading(false);
    }
  };

  const closeEdit = () => {
    setEditConn(null);
    setEditTestResult(null);
    setEditTesting(false);
    setEditSaving(false);
  };

  const runCreateTest = async () => {
    setCreateTesting(true);
    setCreateTestResult(null);
    try {
      await onTest(createForm, createSecret);
      setCreateTestResult(tr("modal.testSuccess"));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setCreateTestResult(tr("modal.testFailed", { message }));
    } finally {
      setCreateTesting(false);
    }
  };

  const runEditTest = async () => {
    if (!editConn) return;
    setEditTesting(true);
    setEditTestResult(null);
    try {
      await onTest(editForm, editSecret);
      setEditTestResult(tr("modal.testSuccess"));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setEditTestResult(tr("modal.testFailed", { message }));
    } finally {
      setEditTesting(false);
    }
  };

  const runCreate = async () => {
    setCreateSaving(true);
    try {
      const created = await onCreate(createForm, createSecret);
      if (created) {
        setShowCreate(false);
        onSelect(created.id);
      }
    } finally {
      setCreateSaving(false);
    }
  };

  const runEdit = async () => {
    if (!editConn) return;
    setEditSaving(true);
    try {
      await onUpdate(editConn.id, editForm, editSecret);
      closeEdit();
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <aside className="session-list zk-connection-list">
      <div className="session-list-header">
        <h3>{tr("zk.page.title")}</h3>
        <button className="btn btn-ghost" type="button" onClick={() => setShowCreate(true)}>
          {tr("zk.page.addConnection")}
        </button>
      </div>
      <div className="session-list-search-row">
        <input
          className="session-list-search-input"
          placeholder={tr("zk.page.searchPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <ul className="zk-conn-table" aria-label={tr("zk.page.listAria")}>
        {displayed.map((conn) => {
          const active = conn.id === selectedId;
          return (
            <li
              key={conn.id}
              className={`zk-conn-line ${active ? "active" : ""}`}
            >
              <button type="button" className="zk-conn-main" onClick={() => onSelect(conn.id)}>
                <div className="zk-conn-name">{conn.name || conn.connect_string}</div>
                <div className="zk-conn-host">{conn.connect_string}</div>
              </button>
              <div className="zk-conn-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    void openEdit(conn);
                  }}
                >
                  {tr("session.editHost")}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingDelete(conn);
                  }}
                >
                  {tr("session.delete")}
                </button>
              </div>
            </li>
          );
        })}
        {displayed.length === 0 ? (
          <li className="session-search-empty" role="status">
            {tr("home.searchNoResults")}
          </li>
        ) : null}
      </ul>

      <ZkConnectionCreateModal
        open={showCreate}
        form={createForm}
        secret={createSecret}
        testing={createTesting}
        saving={createSaving}
        testResult={createTestResult}
        onClose={() => setShowCreate(false)}
        onChangeForm={setCreateForm}
        onChangeSecret={setCreateSecret}
        onTest={() => void runCreateTest()}
        onSubmit={() => void runCreate()}
      />

      <ZkConnectionEditModal
        connection={editConn}
        form={editForm}
        secret={editSecret}
        secretVisible={editSecretVisible}
        secretLoading={editSecretLoading}
        testing={editTesting}
        saving={editSaving}
        testResult={editTestResult}
        onClose={closeEdit}
        onChangeForm={setEditForm}
        onChangeSecret={setEditSecret}
        onToggleSecretVisible={() => setEditSecretVisible((v) => !v)}
        onTest={() => void runEditTest()}
        onSubmit={() => void runEdit()}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={tr("zk.page.deleteTitle")}
        message={pendingDelete ? tr("zk.page.deleteConfirm", { name: pendingDelete.name }) : ""}
        cancelLabel={tr("modal.cancel")}
        confirmLabel={tr("session.delete")}
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (!pendingDelete) return;
          await onDelete(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </aside>
  );
}

