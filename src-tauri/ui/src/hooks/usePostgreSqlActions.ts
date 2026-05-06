import { useEffect, type Dispatch, type SetStateAction } from "react";
import {
  createPostgreSqlConnection,
  deletePostgreSqlConnection,
  disconnectPostgreSql,
  getPostgreSqlSecret,
  listPostgreSqlConnections,
  updatePostgreSqlConnection,
} from "../services/bridge";
import type { PostgreSqlConnection, PostgreSqlConnectionInput } from "../services/types";
import type { I18nKey } from "../i18n";

export function usePostgreSqlActions(opts: {
  connections: PostgreSqlConnection[];
  setConnections: Dispatch<SetStateAction<PostgreSqlConnection[]>>;
  selectedId?: string;
  setSelectedId: Dispatch<SetStateAction<string | undefined>>;
  setStatus: (text: string) => void;
  setError: (text: string | null) => void;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
  reloadKey?: number | string;
}) {
  const { connections, setConnections, selectedId, setSelectedId, setStatus, setError, tr, reloadKey } = opts;

  useEffect(() => {
    void listPostgreSqlConnections()
      .then((data) => setConnections(data))
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        setError(`加载 PostgreSQL 失败: ${message}`);
      });
  }, [setConnections, setError, tr, reloadKey]);

  const create = async (input: PostgreSqlConnectionInput, secret?: string): Promise<PostgreSqlConnection | null> => {
    try {
      const created = await createPostgreSqlConnection(input, secret);
      setConnections([...connections, created]);
      setSelectedId(created.id);
      setStatus(`已创建 PostgreSQL 连接: ${created.name}`);
      setError(null);
      return created;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`创建 PostgreSQL 连接失败: ${message}`);
      return null;
    }
  };

  const update = async (id: string, input: PostgreSqlConnectionInput, secret?: string) => {
    const updated = await updatePostgreSqlConnection(id, input, secret);
    setConnections((prev) => prev.map((c) => (c.id === id ? updated : c)));
    setStatus(`已更新 PostgreSQL 连接: ${updated.name}`);
    setError(null);
  };

  const remove = async (id: string) => {
    await disconnectPostgreSql(id).catch(() => {});
    await deletePostgreSqlConnection(id);
    const next = connections.filter((c) => c.id !== id);
    setConnections(next);
    if (selectedId === id) setSelectedId(undefined);
    setStatus("已删除 PostgreSQL 连接");
    setError(null);
  };

  const getSecret = async (id: string) => getPostgreSqlSecret(id);

  return { create, update, remove, getSecret };
}
