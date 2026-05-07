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
} from "../../services/bridge";
import { buildRedisKeyTree, normalizeRedisMatchPattern } from "./redisTree";
import { useRedisResizeHandlers } from "./useRedisResizeHandlers";
import { useRedisConnectionForms } from "./useRedisConnectionForms";

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
  const [currentCommand, setCurrentCommand] = useState<string | null>(null);

  const {
    connPanelWidth, setConnPanelWidth,
    resizingConnPanel, setResizingConnPanel,
    commandPanelHeight, setCommandPanelHeight,
    resizingCommandPanel, setResizingCommandPanel,
    zkDataWidth, setZkDataWidth,
    resizingDataPane, setResizingDataPane,
    terminalLayoutRef, redisPageRef, browserBodyRef,
  } = useRedisResizeHandlers();

  const {
    createOpen, setCreateOpen,
    createForm, setCreateForm,
    createSecret, setCreateSecret,
    createHost, setCreateHost,
    createPort, setCreatePort,
    createSecretVisible, setCreateSecretVisible,
    createSaving, createSaveResult,
    createTesting, createTestResult,
    editOpen, setEditOpen,
    editForm, setEditForm,
    editSecret, setEditSecret,
    editHost, setEditHost,
    editPort, setEditPort,
    editSecretVisible, setEditSecretVisible,
    editSaving, editSaveResult,
    editTesting, editTestResult,
    testCreateConnection, testEditConnection,
    saveCreateConnection, saveEditConnection,
  } = useRedisConnectionForms({ selected, tr, onCreate, onUpdate, onGetSecret });

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

  const ensureConnected = async () => {
    if (!selected) throw new Error(tr("redis.error.noConnectionSelected"));
    if (connected) return;
    appendCommandLog("CONNECT");
    setCurrentCommand("CONNECT");
    try {
      await connectRedis(selected.id);
      setConnected(true);
    } finally {
      setCurrentCommand(null);
    }
  };

  const pickKey = async (keyBase64: string) => {
    if (!selected) return;
    try {
      await ensureConnected();
      appendCommandLog(`TYPE ${keyBase64}`);
      appendCommandLog(`TTL ${keyBase64}`);
      setCurrentCommand(`TYPE / TTL ${keyBase64}`);
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
    } finally {
      setCurrentCommand(null);
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
      setCurrentCommand(`SCAN ${reset ? 0 : scanCursor} MATCH ${matchPattern} COUNT 100`);
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
      setCurrentCommand(null);
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
      let cmd = "";
      switch (payload.kind) {
        case "string":
          cmd = `SET ${selectedKeyData.key_base64}`;
          appendCommandLog(cmd);
          break;
        case "hash":
          cmd = `HSET ${selectedKeyData.key_base64} ...`;
          appendCommandLog(`DEL ${selectedKeyData.key_base64}`);
          appendCommandLog(cmd);
          break;
        case "list":
          cmd = `RPUSH ${selectedKeyData.key_base64} ...`;
          appendCommandLog(`DEL ${selectedKeyData.key_base64}`);
          appendCommandLog(cmd);
          break;
        case "set":
          cmd = `SADD ${selectedKeyData.key_base64} ...`;
          appendCommandLog(`DEL ${selectedKeyData.key_base64}`);
          appendCommandLog(cmd);
          break;
        case "zset":
          cmd = `ZADD ${selectedKeyData.key_base64} ...`;
          appendCommandLog(`DEL ${selectedKeyData.key_base64}`);
          appendCommandLog(cmd);
          break;
        default:
          break;
      }
      setCurrentCommand(cmd);
      await redisSetKeyData(selected.id, selectedKeyData.key_base64, payload);
      await pickKey(selectedKeyData.key_base64);
      setSaveResult(tr("redis.page.saveSuccess"));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      appendCommandLog(`SAVE FAILED: ${message}`);
      setSaveResult(tr("modal.testFailed", { message }));
    } finally {
      setCurrentCommand(null);
    }
  };

  const saveTtl = async () => {
    if (!selected || !selectedKeyData) return;
    try {
      await ensureConnected();
      const nextTtl = ttlInput.trim() ? Number(ttlInput) : undefined;
      const ttlCmd = Number.isFinite(nextTtl) ? `EXPIRE ${selectedKeyData.key_base64} ${nextTtl}` : `PERSIST ${selectedKeyData.key_base64}`;
      appendCommandLog(ttlCmd);
      setCurrentCommand(ttlCmd);
      await redisSetTtl(selected.id, selectedKeyData.key_base64, Number.isFinite(nextTtl) ? nextTtl : undefined);
      await pickKey(selectedKeyData.key_base64);
      setSaveResult(tr("redis.page.ttlSaved"));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      appendCommandLog(`TTL FAILED: ${message}`);
      setSaveResult(tr("modal.testFailed", { message }));
    } finally {
      setCurrentCommand(null);
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
      const selectCmd = `SELECT ${nextDb}`;
      appendCommandLog(selectCmd);
      setCurrentCommand(selectCmd);
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
      setCurrentCommand(null);
    }
  };

  useEffect(() => {
    if (!selected || keysLoaded || scanLoading) return;
    void loadKeys(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, keysLoaded, scanLoading]);

  const disconnectActive = async () => {
    if (!selected) return;
    setCurrentCommand("DISCONNECT");
    try {
      await disconnectRedis(selected.id);
      appendCommandLog("DISCONNECT");
      setConnected(false);
    } finally {
      setCurrentCommand(null);
    }
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
    currentCommand,
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

