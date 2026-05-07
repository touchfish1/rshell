import { useEffect, useState } from "react";
import type { I18nKey } from "../../i18n";
import { testRedisConnection } from "../../services/bridge";
import type { RedisConnection, RedisConnectionInput } from "../../services/types";
import { formatRedisAddress, parseRedisAddress } from "./redisTree";

const defaultForm: RedisConnectionInput = {
  name: "",
  address: "127.0.0.1:6379",
  db: 0,
};

interface Params {
  selected: RedisConnection | null;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
  onCreate: (input: RedisConnectionInput, secret?: string) => Promise<RedisConnection | null>;
  onUpdate: (id: string, input: RedisConnectionInput, secret?: string) => Promise<void>;
  onGetSecret: (id: string) => Promise<string | null>;
}

export function useRedisConnectionForms({ selected, tr, onCreate, onUpdate, onGetSecret }: Params) {
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<RedisConnectionInput>(defaultForm);
  const [createSecret, setCreateSecret] = useState("");
  const [createHost, setCreateHost] = useState("");
  const [createPort, setCreatePort] = useState<number | "">(6379);
  const [createSecretVisible, setCreateSecretVisible] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createSaveResult, setCreateSaveResult] = useState<string | null>(null);
  const [createTesting, setCreateTesting] = useState(false);
  const [createTestResult, setCreateTestResult] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<RedisConnectionInput>(defaultForm);
  const [editSecret, setEditSecret] = useState("");
  const [editHost, setEditHost] = useState("");
  const [editPort, setEditPort] = useState<number | "">(6379);
  const [editSecretVisible, setEditSecretVisible] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editSaveResult, setEditSaveResult] = useState<string | null>(null);
  const [editTesting, setEditTesting] = useState(false);
  const [editTestResult, setEditTestResult] = useState<string | null>(null);

  useEffect(() => {
    if (!createOpen) {
      setCreateTesting(false);
      setCreateTestResult(null);
      setCreateSaving(false);
      setCreateSaveResult(null);
      setCreateSecretVisible(false);
    }
  }, [createOpen]);

  useEffect(() => {
    if (!editOpen || !selected) return;
    setEditForm({ name: selected.name, address: selected.address, db: selected.db });
    const parsed = parseRedisAddress(selected.address);
    setEditHost(parsed.host);
    setEditPort(parsed.port ?? 6379);
    void onGetSecret(selected.id).then((secret) => setEditSecret(secret ?? ""));
  }, [editOpen, onGetSecret, selected]);

  useEffect(() => {
    if (!editOpen) {
      setEditTesting(false);
      setEditTestResult(null);
      setEditSaving(false);
      setEditSaveResult(null);
      setEditSecretVisible(false);
    }
  }, [editOpen]);

  const testCreateConnection = async () => {
    setCreateTesting(true);
    setCreateTestResult(null);
    try {
      const address = formatRedisAddress(createHost, createPort === "" ? null : createPort);
      await testRedisConnection(address, createForm.db, createSecret || undefined);
      setCreateTestResult(tr("modal.testSuccess"));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setCreateTestResult(tr("modal.testFailed", { message }));
    } finally {
      setCreateTesting(false);
    }
  };

  const testEditConnection = async () => {
    setEditTesting(true);
    setEditTestResult(null);
    try {
      const address = formatRedisAddress(editHost, editPort === "" ? null : editPort);
      await testRedisConnection(address, editForm.db, editSecret || undefined);
      setEditTestResult(tr("modal.testSuccess"));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setEditTestResult(tr("modal.testFailed", { message }));
    } finally {
      setEditTesting(false);
    }
  };

  const saveCreateConnection = async () => {
    setCreateSaving(true);
    setCreateSaveResult(null);
    try {
      const address = formatRedisAddress(createHost, createPort === "" ? null : createPort);
      const created = await onCreate({ ...createForm, address }, createSecret || undefined);
      if (!created) {
        setCreateSaveResult(tr("error.createRedisFailed", { message: "unknown error" }));
        return;
      }
      setCreateOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setCreateSaveResult(tr("error.createRedisFailed", { message }));
    } finally {
      setCreateSaving(false);
    }
  };

  const saveEditConnection = async () => {
    if (!selected) return;
    setEditSaving(true);
    setEditSaveResult(null);
    try {
      const address = formatRedisAddress(editHost, editPort === "" ? null : editPort);
      await onUpdate(selected.id, { ...editForm, address }, editSecret || undefined);
      setEditOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setEditSaveResult(tr("error.updateRedisFailed", { message }));
    } finally {
      setEditSaving(false);
    }
  };

  return {
    createOpen,
    setCreateOpen,
    createForm,
    setCreateForm,
    createSecret,
    setCreateSecret,
    createHost,
    setCreateHost,
    createPort,
    setCreatePort,
    createSecretVisible,
    setCreateSecretVisible,
    createSaving,
    createSaveResult,
    createTesting,
    createTestResult,
    testCreateConnection,
    editOpen,
    setEditOpen,
    editForm,
    setEditForm,
    editSecret,
    setEditSecret,
    editHost,
    setEditHost,
    editPort,
    setEditPort,
    editSecretVisible,
    setEditSecretVisible,
    editSaving,
    editSaveResult,
    editTesting,
    editTestResult,
    testEditConnection,
    saveCreateConnection,
    saveEditConnection,
  };
}
