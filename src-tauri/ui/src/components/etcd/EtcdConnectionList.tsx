import { useEffect, useMemo, useState } from "react";
import type { EtcdConnection, EtcdConnectionInput } from "../../services/types";
import { ConfirmDialog } from "../ConfirmDialog";
import { useI18n } from "../../i18n-context";
import { EtcdConnectionCreateModal } from "./EtcdConnectionCreateModal";
import { EtcdConnectionEditModal } from "./EtcdConnectionEditModal";

interface Props {
  connections: EtcdConnection[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onCreate: (input: EtcdConnectionInput, secret?: string) => Promise<EtcdConnection | null>;
  onUpdate: (id: string, input: EtcdConnectionInput, secret?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onGetSecret: (id: string) => Promise<string | null>;
}

const defaultForm: EtcdConnectionInput = {
  name: "",
  endpoints: "",
};

export function EtcdConnectionList({
  connections,
  selectedId,
  onSelect,
  onCreate,
  onUpdate,
  onDelete,
  onGetSecret,
}: Props) {
  const { tr } = useI18n();
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<EtcdConnectionInput>(defaultForm);
  const [createSecret, setCreateSecret] = useState("");
  const [createSaving, setCreateSaving] = useState(false);

  const [editConn, setEditConn] = useState<EtcdConnection | null>(null);
  const [editForm, setEditForm] = useState<EtcdConnectionInput>(defaultForm);
  const [editSecret, setEditSecret] = useState("");
  const [editSecretVisible, setEditSecretVisible] = useState(false);
  const [editSecretLoading, setEditSecretLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<EtcdConnection | null>(null);

  useEffect(() => {
    if (!showCreate) return;
    setCreateForm(defaultForm);
    setCreateSecret("");
    setCreateSaving(false);
  }, [showCreate]);

  const displayed = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return connections;
    return connections.filter((c) => c.name.toLowerCase().includes(q) || c.endpoints.toLowerCase().includes(q));
  }, [connections, query]);

  const openEdit = async (conn: EtcdConnection) => {
    setEditConn(conn);
    setEditForm({
      name: conn.name,
      endpoints: conn.endpoints,
    });
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
    setEditSaving(false);
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
    <aside className="session-list etcd-connection-list">
      <div className="session-list-header">
        <h3>{tr("etcd.page.title")}</h3>
        <button className="btn btn-ghost" type="button" onClick={() => setShowCreate(true)}>
          {tr("etcd.page.addConnection")}
        </button>
      </div>
      <div className="session-list-search-row">
        <input
          className="session-list-search-input"
          placeholder={tr("etcd.page.searchPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <ul className="etcd-conn-table">
        {displayed.map((conn) => {
          const active = conn.id === selectedId;
          return (
            <li key={conn.id} className={`etcd-conn-line ${active ? "active" : ""}`}>
              <button type="button" className="etcd-conn-main" onClick={() => onSelect(conn.id)}>
                <div className="etcd-conn-name">{conn.name || conn.endpoints}</div>
                <div className="etcd-conn-endpoints">{conn.endpoints}</div>
              </button>
              <div className="etcd-conn-actions">
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

      <EtcdConnectionCreateModal
        open={showCreate}
        form={createForm}
        secret={createSecret}
        saving={createSaving}
        onClose={() => setShowCreate(false)}
        onChangeForm={setCreateForm}
        onChangeSecret={setCreateSecret}
        onSubmit={() => void runCreate()}
        tr={tr}
      />

      <EtcdConnectionEditModal
        connection={editConn}
        form={editForm}
        secret={editSecret}
        secretVisible={editSecretVisible}
        secretLoading={editSecretLoading}
        saving={editSaving}
        onClose={closeEdit}
        onChangeForm={setEditForm}
        onChangeSecret={setEditSecret}
        onToggleSecretVisible={() => setEditSecretVisible((v) => !v)}
        onSubmit={() => void runEdit()}
        tr={tr}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={tr("session.delete")}
        message={pendingDelete ? tr("etcd.page.deleteConfirm", { key: pendingDelete.name }) : ""}
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
