import { useEffect, useMemo, useRef, useState } from "react";
import type { I18nKey } from "../../i18n";
import type {
  RedisConnection,
  RedisConnectionInput,
  RedisDatabaseInfo,
  RedisHashEntry,
  RedisKeyData,
  RedisKeyRef,
  RedisValueUpdate,
  RedisZsetEntry,
} from "../../services/types";
import {
  connectRedis,
  disconnectRedis,
  redisGetKeyData,
  redisListDatabases,
  redisScanKeys,
  redisSetKeyData,
  redisSetTtl,
  testRedisConnection,
} from "../../services/bridge";
import { buildRedisKeyTree, formatRedisAddress, normalizeRedisMatchPattern, parseRedisAddress } from "./redisTree";

const defaultForm: RedisConnectionInput = {
  name: "",
  address: "127.0.0.1:6379",
  db: 0,
};

interface Params {
  connections: RedisConnection[];
  selectedId?: string;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
  onSelect: (id: string) => void;
  onCreate: (input: RedisConnectionInput, secret?: string) => Promise<RedisConnection | null>;
  onUpdate: (id: string, input: RedisConnectionInput, secret?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onGetSecret: (id: string) => Promise<string | null>;
}

export function useRedisPageState({ connections, selectedId, tr, onSelect, onCreate, onUpdate, onDelete, onGetSecret }: Params) {
  const selected = useMemo(() => connections.find((c) => c.id === selectedId) ?? null, [connections, selectedId]);
  const [connected, setConnected] = useState(false);
  const [keys, setKeys] = useState<RedisKeyRef[]>([]);
  const [scanCursor, setScanCursor] = useState(0);
  const [scanLoading, setScanLoading] = useState(false);
  const [keysLoaded, setKeysLoaded] = useState(false);
  const [pattern, setPattern] = useState("*");
  const [groupDelimiter, setGroupDelimiter] = useState(":");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [selectedKeyData, setSelectedKeyData] = useState<RedisKeyData | null>(null);
  const [editorText, setEditorText] = useState("");
  const [hashEntries, setHashEntries] = useState<RedisHashEntry[]>([]);
  const [listItems, setListItems] = useState<string[]>([]);
  const [setMembers, setSetMembers] = useState<string[]>([]);
  const [setEditIndex, setSetEditIndex] = useState<number | null>(null);
  const [setDraft, setSetDraft] = useState("");
  const [zsetEntries, setZsetEntries] = useState<RedisZsetEntry[]>([]);
  const [ttlInput, setTtlInput] = useState("");
  const [saveResult, setSaveResult] = useState<string | null>(null);
  const [commandLogs, setCommandLogs] = useState<string[]>([]);
  const [connPanelWidth, setConnPanelWidth] = useState(320);
  const [resizingConnPanel, setResizingConnPanel] = useState(false);
  const [commandPanelHeight, setCommandPanelHeight] = useState(156);
  const [resizingCommandPanel, setResizingCommandPanel] = useState(false);
  const [zkDataWidth, setZkDataWidth] = useState(460);
  const [resizingDataPane, setResizingDataPane] = useState(false);
  const terminalLayoutRef = useRef<HTMLDivElement | null>(null);
  const redisPageRef = useRef<HTMLElement | null>(null);
  const browserBodyRef = useRef<HTMLDivElement | null>(null);

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

  const [dbSwitchOpen, setDbSwitchOpen] = useState(false);
  const [dbSwitchConn, setDbSwitchConn] = useState<RedisConnection | null>(null);
  const [dbSwitchValue, setDbSwitchValue] = useState("0");
  const [dbSwitchSaving, setDbSwitchSaving] = useState(false);
  const [dbSwitchResult, setDbSwitchResult] = useState<string | null>(null);
  const [dbSwitchOptions, setDbSwitchOptions] = useState<RedisDatabaseInfo[]>([]);
  const [dbSwitchLoading, setDbSwitchLoading] = useState(false);

  const appendCommandLog = (command: string) => {
    const time = new Date().toLocaleTimeString();
    setCommandLogs((prev) => [`[${time}] ${command}`, ...prev].slice(0, 200));
  };

  useEffect(() => {
    setConnected(false);
    setKeys([]);
    setScanCursor(0);
    setKeysLoaded(false);
    setSelectedKeyData(null);
    setEditorText("");
    setHashEntries([]);
    setListItems([]);
    setSetMembers([]);
    setSetEditIndex(null);
    setSetDraft("");
    setZsetEntries([]);
    setTtlInput("");
    setSaveResult(null);
    setExpandedGroups({});
    setCommandLogs([]);
  }, [selectedId]);

  const keyTree = useMemo(() => buildRedisKeyTree(keys, groupDelimiter), [groupDelimiter, keys]);

  const toggleGroup = (id: string) => setExpandedGroups((prev) => ({ ...prev, [id]: !prev[id] }));

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

  const ensureConnected = async () => {
    if (!selected) throw new Error(tr("redis.error.noConnectionSelected"));
    if (connected) return;
    appendCommandLog("CONNECT");
    await connectRedis(selected.id);
    setConnected(true);
  };

  const pickKey = async (keyBase64: string) => {
    if (!selected) return;
    try {
      await ensureConnected();
      appendCommandLog(`TYPE ${keyBase64}`);
      appendCommandLog(`TTL ${keyBase64}`);
      const data = await redisGetKeyData(selected.id, keyBase64);
      setSelectedKeyData(data);
      setTtlInput(data.ttl_seconds >= 0 ? String(data.ttl_seconds) : "");
      switch (data.payload.kind) {
        case "string":
          setEditorText(data.payload.value ?? "");
          setHashEntries([]);
          setListItems([]);
          setSetMembers([]);
          setSetEditIndex(null);
          setSetDraft("");
          setZsetEntries([]);
          break;
        case "hash":
          setEditorText("");
          setHashEntries(data.payload.entries.length > 0 ? data.payload.entries : [{ field: "", value: "" }]);
          setListItems([]);
          setSetMembers([]);
          setSetEditIndex(null);
          setSetDraft("");
          setZsetEntries([]);
          break;
        case "list":
          setEditorText("");
          setHashEntries([]);
          setListItems(data.payload.items.length > 0 ? data.payload.items : [""]);
          setSetMembers([]);
          setSetEditIndex(null);
          setSetDraft("");
          setZsetEntries([]);
          break;
        case "set":
          setEditorText("");
          setHashEntries([]);
          setListItems([]);
          setSetMembers(data.payload.members.length > 0 ? data.payload.members : [""]);
          setSetEditIndex(null);
          setSetDraft("");
          setZsetEntries([]);
          break;
        case "zset":
          setEditorText("");
          setHashEntries([]);
          setListItems([]);
          setSetMembers([]);
          setSetEditIndex(null);
          setSetDraft("");
          setZsetEntries(data.payload.entries.length > 0 ? data.payload.entries : [{ score: 0, member: "" }]);
          break;
        default:
          setEditorText("");
          setHashEntries([]);
          setListItems([]);
          setSetMembers([]);
          setSetEditIndex(null);
          setSetDraft("");
          setZsetEntries([]);
      }
      setSaveResult(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSaveResult(tr("modal.testFailed", { message }));
    }
  };

  const loadKeys = async (reset = true) => {
    if (!selected) return;
    setScanLoading(true);
    if (reset) {
      setScanCursor(0);
      setKeys([]);
    }
    try {
      await ensureConnected();
      const matchPattern = normalizeRedisMatchPattern(pattern);
      appendCommandLog(`SCAN ${reset ? 0 : scanCursor} MATCH ${matchPattern} COUNT 100`);
      const result = await redisScanKeys(selected.id, reset ? 0 : scanCursor, matchPattern, 100);
      setScanCursor(result.next_cursor);
      setKeys((prev) => {
        const combined = reset ? result.keys : [...prev, ...result.keys];
        const uniq = new Map<string, RedisKeyRef>();
        for (const item of combined) uniq.set(item.key_base64, item);
        const arr = Array.from(uniq.values());
        arr.sort((a, b) => (a.key_utf8 ?? a.key_base64).localeCompare(b.key_utf8 ?? b.key_base64));
        return arr;
      });
      setKeysLoaded(true);
      const selectedKey = selectedKeyData?.key_base64;
      if (selectedKey) {
        const stillExists = reset ? result.keys.some((k) => k.key_base64 === selectedKey) : true;
        if (!stillExists) {
          if (result.keys.length > 0) await pickKey(result.keys[0].key_base64);
          else {
            setSelectedKeyData(null);
            setEditorText("");
            setTtlInput("");
          }
        }
      } else if (result.keys.length > 0) {
        await pickKey(result.keys[0].key_base64);
      }
      setSaveResult(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSaveResult(tr("modal.testFailed", { message }));
    } finally {
      setScanLoading(false);
    }
  };

  const buildPayload = (): RedisValueUpdate | null => {
    if (!selectedKeyData) return null;
    switch (selectedKeyData.payload.kind) {
      case "string":
        return { kind: "string", value: editorText };
      case "hash":
        return { kind: "hash", entries: hashEntries.filter((entry) => entry.field.trim().length > 0) };
      case "list":
        return { kind: "list", items: listItems.map((item) => item.trim()).filter(Boolean) };
      case "set":
        return { kind: "set", members: Array.from(new Set(setMembers.map((item) => item.trim()).filter(Boolean))) };
      case "zset":
        return {
          kind: "zset",
          entries: zsetEntries
            .filter((entry) => entry.member.trim().length > 0)
            .map((entry) => ({ member: entry.member, score: Number.isFinite(entry.score) ? entry.score : 0 })),
        };
      default:
        return null;
    }
  };

  const saveValue = async () => {
    if (!selected || !selectedKeyData) return;
    const payload = buildPayload();
    if (!payload) {
      setSaveResult(tr("redis.page.unsupportedType", { type: selectedKeyData.key_type }));
      return;
    }
    try {
      await ensureConnected();
      switch (payload.kind) {
        case "string":
          appendCommandLog(`SET ${selectedKeyData.key_base64}`);
          break;
        case "hash":
          appendCommandLog(`DEL ${selectedKeyData.key_base64}`);
          appendCommandLog(`HSET ${selectedKeyData.key_base64} ...`);
          break;
        case "list":
          appendCommandLog(`DEL ${selectedKeyData.key_base64}`);
          appendCommandLog(`RPUSH ${selectedKeyData.key_base64} ...`);
          break;
        case "set":
          appendCommandLog(`DEL ${selectedKeyData.key_base64}`);
          appendCommandLog(`SADD ${selectedKeyData.key_base64} ...`);
          break;
        case "zset":
          appendCommandLog(`DEL ${selectedKeyData.key_base64}`);
          appendCommandLog(`ZADD ${selectedKeyData.key_base64} ...`);
          break;
        default:
          break;
      }
      await redisSetKeyData(selected.id, selectedKeyData.key_base64, payload);
      await pickKey(selectedKeyData.key_base64);
      setSaveResult(tr("redis.page.saveSuccess"));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      appendCommandLog(`SAVE FAILED: ${message}`);
      setSaveResult(tr("modal.testFailed", { message }));
    }
  };

  const saveTtl = async () => {
    if (!selected || !selectedKeyData) return;
    try {
      await ensureConnected();
      const nextTtl = ttlInput.trim() ? Number(ttlInput) : undefined;
      appendCommandLog(Number.isFinite(nextTtl) ? `EXPIRE ${selectedKeyData.key_base64} ${nextTtl}` : `PERSIST ${selectedKeyData.key_base64}`);
      await redisSetTtl(selected.id, selectedKeyData.key_base64, Number.isFinite(nextTtl) ? nextTtl : undefined);
      await pickKey(selectedKeyData.key_base64);
      setSaveResult(tr("redis.page.ttlSaved"));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      appendCommandLog(`TTL FAILED: ${message}`);
      setSaveResult(tr("modal.testFailed", { message }));
    }
  };

  const openDbSwitchModal = (conn: RedisConnection) => {
    const currentDb = Number.isFinite(conn.db) ? conn.db : 0;
    setDbSwitchConn(conn);
    setDbSwitchValue(String(currentDb));
    setDbSwitchResult(null);
    setDbSwitchSaving(false);
    setDbSwitchLoading(true);
    setDbSwitchOptions([]);
    setDbSwitchOpen(true);
    void (async () => {
      try {
        await connectRedis(conn.id);
        const rows = await redisListDatabases(conn.id);
        const map = new Map<number, RedisDatabaseInfo>();
        for (const row of rows) map.set(row.db, row);
        if (!map.has(currentDb)) map.set(currentDb, { db: currentDb, key_count: 0 });
        setDbSwitchOptions(Array.from(map.values()).sort((a, b) => a.db - b.db));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setDbSwitchResult(tr("redis.form.dbLoadFailed", { message }));
      } finally {
        setDbSwitchLoading(false);
      }
    })();
  };

  const switchConnectionDb = async () => {
    if (!dbSwitchConn) return;
    const currentDb = Number.isFinite(dbSwitchConn.db) ? dbSwitchConn.db : 0;
    const nextDb = Number(dbSwitchValue.trim());
    if (!Number.isInteger(nextDb) || nextDb < 0) {
      setDbSwitchResult(tr("redis.form.dbInvalid"));
      return;
    }
    if (nextDb === currentDb) {
      setDbSwitchOpen(false);
      return;
    }
    setDbSwitchSaving(true);
    setDbSwitchResult(null);
    try {
      const secret = await onGetSecret(dbSwitchConn.id);
      await onUpdate(dbSwitchConn.id, { name: dbSwitchConn.name, address: dbSwitchConn.address, db: nextDb }, secret ?? undefined);
      appendCommandLog(`SELECT ${nextDb}`);
      if (selectedId === dbSwitchConn.id) {
        await disconnectRedis(dbSwitchConn.id).catch(() => undefined);
        setConnected(false);
        setKeys([]);
        setScanCursor(0);
        setKeysLoaded(false);
        setSelectedKeyData(null);
        setEditorText("");
        setTtlInput("");
      }
      setSaveResult(tr("redis.form.dbSwitched", { db: nextDb }));
      setDbSwitchOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setDbSwitchResult(tr("redis.form.dbSwitchFailed", { message }));
    } finally {
      setDbSwitchSaving(false);
    }
  };

  useEffect(() => {
    if (!selected || keysLoaded || scanLoading) return;
    void loadKeys(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, keysLoaded, scanLoading]);

  useEffect(() => {
    if (!resizingDataPane) return;
    const onMouseMove = (event: MouseEvent) => {
      const root = browserBodyRef.current;
      if (!root) return;
      const rect = root.getBoundingClientRect();
      const minTree = 260;
      const minData = 320;
      const nextDataWidth = rect.right - event.clientX;
      const maxData = Math.max(minData, rect.width - minTree - 8);
      const clamped = Math.max(minData, Math.min(nextDataWidth, maxData));
      setZkDataWidth(Math.round(clamped));
    };
    const onMouseUp = () => setResizingDataPane(false);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [resizingDataPane]);

  useEffect(() => {
    if (!resizingConnPanel) return;
    const onMouseMove = (event: MouseEvent) => {
      const root = terminalLayoutRef.current;
      if (!root) return;
      const rect = root.getBoundingClientRect();
      const next = event.clientX - rect.left;
      const min = 240;
      const max = Math.max(360, rect.width * 0.46);
      const clamped = Math.max(min, Math.min(max, next));
      setConnPanelWidth(Math.round(clamped));
    };
    const onMouseUp = () => setResizingConnPanel(false);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [resizingConnPanel]);

  useEffect(() => {
    if (!resizingCommandPanel) return;
    const onMouseMove = (event: MouseEvent) => {
      const root = redisPageRef.current;
      if (!root) return;
      const rect = root.getBoundingClientRect();
      const next = rect.bottom - event.clientY;
      const min = 120;
      const max = Math.max(260, rect.height * 0.45);
      const clamped = Math.max(min, Math.min(max, next));
      setCommandPanelHeight(Math.round(clamped));
    };
    const onMouseUp = () => setResizingCommandPanel(false);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [resizingCommandPanel]);

  const disconnectActive = async () => {
    if (!selected) return;
    await disconnectRedis(selected.id);
    appendCommandLog("DISCONNECT");
    setConnected(false);
  };

  return {
    selected,
    connected,
    setConnected,
    keys,
    scanCursor,
    scanLoading,
    keysLoaded,
    pattern,
    groupDelimiter,
    expandedGroups,
    selectedKeyData,
    editorText,
    hashEntries,
    listItems,
    setMembers,
    setEditIndex,
    setDraft,
    zsetEntries,
    ttlInput,
    saveResult,
    commandLogs,
    connPanelWidth,
    resizingConnPanel,
    commandPanelHeight,
    resizingCommandPanel,
    zkDataWidth,
    resizingDataPane,
    terminalLayoutRef,
    redisPageRef,
    browserBodyRef,
    keyTree,
    toggleGroup,
    setPattern,
    setGroupDelimiter,
    setExpandedGroups,
    setSelectedKeyData,
    setEditorText,
    setHashEntries,
    setListItems,
    setSetMembers,
    setSetEditIndex,
    setSetDraft,
    setZsetEntries,
    setTtlInput,
    setSaveResult,
    setConnPanelWidth,
    setResizingConnPanel,
    setCommandPanelHeight,
    setResizingCommandPanel,
    setZkDataWidth,
    setResizingDataPane,
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
    dbSwitchOpen,
    dbSwitchConn,
    dbSwitchLoading,
    dbSwitchOptions,
    dbSwitchValue,
    dbSwitchSaving,
    dbSwitchResult,
    setDbSwitchOpen,
    setDbSwitchValue,
    testCreateConnection,
    testEditConnection,
    saveCreateConnection,
    saveEditConnection,
    loadKeys,
    pickKey,
    saveValue,
    saveTtl,
    openDbSwitchModal,
    switchConnectionDb,
    disconnectActive,
    onSelect,
    onDelete,
  };
}

