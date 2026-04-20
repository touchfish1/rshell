import { useEffect, type Dispatch, type SetStateAction } from "react";
import {
  createZookeeperConnection,
  deleteZookeeperConnection,
  disconnectZookeeper,
  getZookeeperSecret,
  listZookeeperConnections,
  updateZookeeperConnection,
} from "../services/bridge";
import type { ZookeeperConnection, ZookeeperConnectionInput } from "../services/types";
import type { I18nKey } from "../i18n";

export function useZookeeperActions(opts: {
  connections: ZookeeperConnection[];
  setConnections: Dispatch<SetStateAction<ZookeeperConnection[]>>;
  selectedId?: string;
  setSelectedId: Dispatch<SetStateAction<string | undefined>>;
  setStatus: (text: string) => void;
  setError: (text: string | null) => void;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
}) {
  const { connections, setConnections, selectedId, setSelectedId, setStatus, setError, tr } = opts;

  useEffect(() => {
    void listZookeeperConnections()
      .then((data) => {
        setConnections(data);
        if (data.length > 0) setSelectedId(data[0].id);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        setError(tr("error.loadZookeeperFailed", { message }));
      });
  }, [setConnections, setSelectedId, setError, tr]);

  const create = async (input: ZookeeperConnectionInput, secret?: string): Promise<ZookeeperConnection | null> => {
    try {
      const created = await createZookeeperConnection(input, secret);
      const next = [...connections, created];
      setConnections(next);
      setSelectedId(created.id);
      setStatus(tr("status.createdZookeeper", { name: created.name }));
      setError(null);
      return created;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(tr("error.createZookeeperFailed", { message }));
      return null;
    }
  };

  const update = async (id: string, input: ZookeeperConnectionInput, secret?: string) => {
    try {
      const updated = await updateZookeeperConnection(id, input, secret);
      setConnections((prev) => prev.map((c) => (c.id === id ? updated : c)));
      setStatus(tr("status.updatedZookeeper", { name: updated.name }));
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(tr("error.updateZookeeperFailed", { message }));
    }
  };

  const remove = async (id: string) => {
    try {
      await disconnectZookeeper(id).catch(() => {});
      await deleteZookeeperConnection(id);
      const next = connections.filter((c) => c.id !== id);
      setConnections(next);
      if (selectedId === id) setSelectedId(next[0]?.id);
      setStatus(tr("status.deletedZookeeper"));
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(tr("error.deleteZookeeperFailed", { message }));
    }
  };

  const getSecret = async (id: string) => {
    return getZookeeperSecret(id);
  };

  return { create, update, remove, getSecret };
}

