import { useEffect, type Dispatch, type SetStateAction } from "react";
import {
  createEtcdConnection,
  deleteEtcdConnection,
  disconnectEtcd,
  getEtcdSecret,
  listEtcdConnections,
  updateEtcdConnection,
} from "../services/bridge";
import type { EtcdConnection, EtcdConnectionInput } from "../services/types";
import type { I18nKey } from "../i18n";

export function useEtcdActions(opts: {
  connections: EtcdConnection[];
  setConnections: Dispatch<SetStateAction<EtcdConnection[]>>;
  selectedId?: string;
  setSelectedId: Dispatch<SetStateAction<string | undefined>>;
  setStatus: (text: string) => void;
  setError: (text: string | null) => void;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
  reloadKey?: number | string;
}) {
  const { connections, setConnections, selectedId, setSelectedId, setStatus, setError, tr, reloadKey } = opts;

  useEffect(() => {
    void listEtcdConnections()
      .then((data) => {
        setConnections(data);
        if (data.length > 0) setSelectedId(data[0].id);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        setError(tr("etcd.error.loadFailed", { message }));
      });
  }, [setConnections, setSelectedId, setError, tr, reloadKey]);

  const create = async (input: EtcdConnectionInput, secret?: string): Promise<EtcdConnection | null> => {
    try {
      const created = await createEtcdConnection(input, secret);
      const next = [...connections, created];
      setConnections(next);
      setSelectedId(created.id);
      setStatus(tr("status.createdEtcd", { name: created.name }));
      setError(null);
      return created;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(tr("etcd.error.createFailed", { message }));
      return null;
    }
  };

  const update = async (id: string, input: EtcdConnectionInput, secret?: string) => {
    try {
      const updated = await updateEtcdConnection(id, input, secret);
      setConnections((prev) => prev.map((c) => (c.id === id ? updated : c)));
      setStatus(tr("status.updatedEtcd", { name: updated.name }));
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(tr("etcd.error.updateFailed", { message }));
    }
  };

  const remove = async (id: string) => {
    try {
      await disconnectEtcd(id).catch(() => {});
      await deleteEtcdConnection(id);
      const next = connections.filter((c) => c.id !== id);
      setConnections(next);
      if (selectedId === id) setSelectedId(next[0]?.id);
      setStatus(tr("status.deletedEtcd"));
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(tr("etcd.error.deleteFailed", { message }));
    }
  };

  const getSecret = async (id: string) => {
    return getEtcdSecret(id);
  };

  return { create, update, remove, getSecret };
}
