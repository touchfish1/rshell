import { useEffect, type Dispatch, type SetStateAction } from "react";
import {
  createRedisConnection,
  deleteRedisConnection,
  disconnectRedis,
  getRedisSecret,
  listRedisConnections,
  updateRedisConnection,
} from "../services/bridge";
import type { RedisConnection, RedisConnectionInput } from "../services/types";
import type { I18nKey } from "../i18n";

export function useRedisActions(opts: {
  connections: RedisConnection[];
  setConnections: Dispatch<SetStateAction<RedisConnection[]>>;
  selectedId?: string;
  setSelectedId: Dispatch<SetStateAction<string | undefined>>;
  setStatus: (text: string) => void;
  setError: (text: string | null) => void;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
}) {
  const { connections, setConnections, selectedId, setSelectedId, setStatus, setError, tr } = opts;

  useEffect(() => {
    void listRedisConnections()
      .then((data) => {
        setConnections(data);
        if (data.length > 0) setSelectedId(data[0].id);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        setError(tr("error.loadRedisFailed", { message }));
      });
  }, [setConnections, setSelectedId, setError, tr]);

  const create = async (input: RedisConnectionInput, secret?: string): Promise<RedisConnection | null> => {
    try {
      const created = await createRedisConnection(input, secret);
      const next = [...connections, created];
      setConnections(next);
      setSelectedId(created.id);
      setStatus(tr("status.createdRedis", { name: created.name }));
      setError(null);
      return created;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(tr("error.createRedisFailed", { message }));
      return null;
    }
  };

  const update = async (id: string, input: RedisConnectionInput, secret?: string) => {
    try {
      const updated = await updateRedisConnection(id, input, secret);
      setConnections((prev) => prev.map((c) => (c.id === id ? updated : c)));
      setStatus(tr("status.updatedRedis", { name: updated.name }));
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(tr("error.updateRedisFailed", { message }));
      throw err;
    }
  };

  const remove = async (id: string) => {
    try {
      await disconnectRedis(id).catch(() => {});
      await deleteRedisConnection(id);
      const next = connections.filter((c) => c.id !== id);
      setConnections(next);
      if (selectedId === id) setSelectedId(next[0]?.id);
      setStatus(tr("status.deletedRedis"));
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(tr("error.deleteRedisFailed", { message }));
    }
  };

  const getSecret = async (id: string) => getRedisSecret(id);

  return { create, update, remove, getSecret };
}
