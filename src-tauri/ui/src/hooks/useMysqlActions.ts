import { useEffect, type Dispatch, type SetStateAction } from "react";
import {
  createMySqlConnection,
  deleteMySqlConnection,
  disconnectMySql,
  getMySqlSecret,
  listMySqlConnections,
  updateMySqlConnection,
} from "../services/bridge";
import type { MySqlConnection, MySqlConnectionInput } from "../services/types";
import type { I18nKey } from "../i18n";

export function useMysqlActions(opts: {
  connections: MySqlConnection[];
  setConnections: Dispatch<SetStateAction<MySqlConnection[]>>;
  selectedId?: string;
  setSelectedId: Dispatch<SetStateAction<string | undefined>>;
  setStatus: (text: string) => void;
  setError: (text: string | null) => void;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
  reloadKey?: number | string;
}) {
  const { connections, setConnections, selectedId, setSelectedId, setStatus, setError, tr, reloadKey } = opts;

  useEffect(() => {
    void listMySqlConnections()
      .then((data) => {
        setConnections(data);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        setError(tr("error.loadMysqlFailed", { message }));
      });
  }, [setConnections, setError, setSelectedId, tr, reloadKey]);

  const create = async (input: MySqlConnectionInput, secret?: string): Promise<MySqlConnection | null> => {
    try {
      const created = await createMySqlConnection(input, secret);
      setConnections([...connections, created]);
      setSelectedId(created.id);
      setStatus(tr("status.createdMysql", { name: created.name }));
      setError(null);
      return created;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(tr("error.createMysqlFailed", { message }));
      return null;
    }
  };

  const update = async (id: string, input: MySqlConnectionInput, secret?: string) => {
    try {
      const updated = await updateMySqlConnection(id, input, secret);
      setConnections((prev) => prev.map((c) => (c.id === id ? updated : c)));
      setStatus(tr("status.updatedMysql", { name: updated.name }));
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(tr("error.updateMysqlFailed", { message }));
      throw err;
    }
  };

  const remove = async (id: string) => {
    try {
      await disconnectMySql(id).catch(() => {});
      await deleteMySqlConnection(id);
      const next = connections.filter((c) => c.id !== id);
      setConnections(next);
      if (selectedId === id) setSelectedId(undefined);
      setStatus(tr("status.deletedMysql"));
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(tr("error.deleteMysqlFailed", { message }));
    }
  };

  const getSecret = async (id: string) => getMySqlSecret(id);

  return { create, update, remove, getSecret };
}
