import { useState } from "react";
import { testRedisConnection } from "../../services/bridge";
import type { RedisConnection, RedisConnectionInput } from "../../services/types";
import type { TrFn } from "../../i18n-context";

interface Params {
  onGetRedisSecret: (id: string) => Promise<string | null>;
  onUpdateRedis: (id: string, input: RedisConnectionInput, secret?: string) => Promise<void>;
  tr: TrFn;
}

export function useRedisConnectionEditor({ onGetRedisSecret, onUpdateRedis, tr }: Params) {
  const [redisEditConnection, setRedisEditConnection] = useState<RedisConnection | null>(null);
  const [redisEditForm, setRedisEditForm] = useState<RedisConnectionInput>({ name: "", address: "", db: 0 });
  const [redisEditSecret, setRedisEditSecret] = useState("");
  const [redisEditSecretVisible, setRedisEditSecretVisible] = useState(false);
  const [redisEditSecretLoading, setRedisEditSecretLoading] = useState(false);
  const [redisEditTesting, setRedisEditTesting] = useState(false);
  const [redisEditSaving, setRedisEditSaving] = useState(false);
  const [redisEditResult, setRedisEditResult] = useState<string | null>(null);

  const openEditRedis = async (conn: RedisConnection) => {
    setRedisEditConnection(conn);
    setRedisEditForm({ name: conn.name, address: conn.address, db: conn.db });
    setRedisEditResult(null);
    setRedisEditSecretVisible(false);
    setRedisEditSecretLoading(true);
    try {
      const secret = await onGetRedisSecret(conn.id);
      setRedisEditSecret(secret ?? "");
    } catch {
      setRedisEditSecret("");
    } finally {
      setRedisEditSecretLoading(false);
    }
  };

  const closeEditRedis = () => {
    setRedisEditConnection(null);
    setRedisEditResult(null);
    setRedisEditTesting(false);
    setRedisEditSaving(false);
    setRedisEditSecretVisible(false);
    setRedisEditSecretLoading(false);
  };

  const testEditRedis = async () => {
    if (!redisEditConnection) return;
    setRedisEditTesting(true);
    setRedisEditResult(null);
    try {
      await testRedisConnection(redisEditForm.address, redisEditForm.db, redisEditSecret || undefined);
      setRedisEditResult(tr("modal.testSuccess"));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setRedisEditResult(tr("modal.testFailed", { message }));
    } finally {
      setRedisEditTesting(false);
    }
  };

  const submitEditRedis = async () => {
    if (!redisEditConnection) return;
    setRedisEditSaving(true);
    try {
      await onUpdateRedis(redisEditConnection.id, redisEditForm, redisEditSecret || undefined);
      closeEditRedis();
    } finally {
      setRedisEditSaving(false);
    }
  };

  return {
    redisEditConnection,
    redisEditForm,
    setRedisEditForm,
    redisEditSecret,
    setRedisEditSecret,
    redisEditSecretVisible,
    redisEditSecretLoading,
    setRedisEditSecretVisible,
    redisEditTesting,
    redisEditSaving,
    redisEditResult,
    openEditRedis,
    closeEditRedis,
    testEditRedis,
    submitEditRedis,
  };
}
