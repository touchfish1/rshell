import { useEffect, useMemo, useState } from "react";
import type { I18nKey } from "../i18n";
import type {
  RedisConnection,
  RedisConnectionInput,
  RedisDatabaseInfo,
  RedisHashEntry,
  RedisKeyRef,
  RedisKeyData,
  RedisValueUpdate,
  RedisZsetEntry,
} from "../services/types";
import {
  connectRedis,
  disconnectRedis,
  redisGetKeyData,
  redisListDatabases,
  redisScanKeys,
  redisSetKeyData,
  redisSetTtl,
  testRedisConnection,
} from "../services/bridge";
import { ErrorBanner } from "../components/ErrorBanner";

interface Props {
  connections: RedisConnection[];
  selectedId?: string;
  status: string;
  error: string | null;
  onDismissError: () => void;
  onSelect: (id: string) => void;
  onCreate: (input: RedisConnectionInput, secret?: string) => Promise<RedisConnection | null>;
  onUpdate: (id: string, input: RedisConnectionInput, secret?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onGetSecret: (id: string) => Promise<string | null>;
  onBack: () => void;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
}

interface RedisKeyTreeNode {
  id: string;
  label: string;
  keyBase64?: string;
  children: RedisKeyTreeNode[];
}

function insertKeyNode(
  nodes: RedisKeyTreeNode[],
  parts: string[],
  keyBase64: string,
  fullDisplay: string,
  pathPrefix: string[] = []
) {
  if (parts.length === 0) {
    return;
  }
  const [head, ...rest] = parts;
  const nextPath = [...pathPrefix, head];
  const isLeaf = rest.length === 0;
  const nodeId = isLeaf ? `leaf:${keyBase64}` : `group:${nextPath.join("\u0001")}`;
  let node = nodes.find((item) => item.id === nodeId);
  if (!node) {
    node = {
      id: nodeId,
      label: isLeaf ? (parts.length === 1 && pathPrefix.length === 0 ? fullDisplay : head) : head,
      keyBase64: isLeaf ? keyBase64 : undefined,
      children: [],
    };
    nodes.push(node);
  }
  if (!isLeaf) {
    insertKeyNode(node.children, rest, keyBase64, fullDisplay, nextPath);
  }
}

function sortTreeNodes(nodes: RedisKeyTreeNode[]): RedisKeyTreeNode[] {
  return nodes
    .map((node) => ({ ...node, children: sortTreeNodes(node.children) }))
    .sort((a, b) => {
      const aGroup = a.keyBase64 ? 1 : 0;
      const bGroup = b.keyBase64 ? 1 : 0;
      if (aGroup !== bGroup) return aGroup - bGroup; // group first, then leaf
      return a.label.localeCompare(b.label);
    });
}

function normalizeRedisMatchPattern(input: string): string {
  const raw = input.trim();
  if (!raw) return "*";
  // Redis MATCH uses glob; if user didn't provide wildcard, default to fuzzy contains.
  if (!/[*?\[\]]/.test(raw)) {
    return `*${raw}*`;
  }
  return raw;
}

const defaultForm: RedisConnectionInput = {
  name: "",
  address: "127.0.0.1:6379",
  db: 0,
};

function KeyTreeNode({
  node,
  level,
  expandedGroups,
  onToggle,
  onPick,
  selectedKeyBase64,
}: {
  node: RedisKeyTreeNode;
  level: number;
  expandedGroups: Record<string, boolean>;
  onToggle: (id: string) => void;
  onPick: (keyBase64: string) => void;
  selectedKeyBase64?: string;
}) {
  const isLeaf = Boolean(node.keyBase64);
  const expanded = expandedGroups[node.id] ?? level < 1;
  return (
    <div style={{ paddingLeft: `${level * 12}px` }}>
      <div className={`zk-node ${node.keyBase64 && selectedKeyBase64 === node.keyBase64 ? "zk-node-selected" : ""}`}>
        {isLeaf ? (
          <button
            className="btn btn-ghost zk-node-name"
            title={node.label}
            onClick={() => node.keyBase64 && onPick(node.keyBase64)}
          >
            {node.label}
          </button>
        ) : (
          <button className="btn btn-ghost zk-node-name" title={node.label} onClick={() => onToggle(node.id)}>
            {expanded ? "▾" : "▸"} {node.label}
          </button>
        )}
      </div>
      {!isLeaf && expanded ? node.children.map((child) => (
        <KeyTreeNode
          key={child.id}
          node={child}
          level={level + 1}
          expandedGroups={expandedGroups}
          onToggle={onToggle}
          onPick={onPick}
          selectedKeyBase64={selectedKeyBase64}
        />
      )) : null}
    </div>
  );
}

export default function RedisPage({
  connections,
  selectedId,
  status,
  error,
  onDismissError,
  onSelect,
  onCreate,
  onUpdate,
  onDelete,
  onGetSecret,
  onBack,
  tr,
}: Props) {
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
  const [ttlInput, setTtlInput] = useState("");
  const [saveResult, setSaveResult] = useState<string | null>(null);
  const [commandLogs, setCommandLogs] = useState<string[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<RedisConnectionInput>(defaultForm);
  const [createSecret, setCreateSecret] = useState("");
  const [createSaving, setCreateSaving] = useState(false);
  const [createSaveResult, setCreateSaveResult] = useState<string | null>(null);
  const [createTesting, setCreateTesting] = useState(false);
  const [createTestResult, setCreateTestResult] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<RedisConnectionInput>(defaultForm);
  const [editSecret, setEditSecret] = useState("");
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
    setTtlInput("");
    setSaveResult(null);
    setExpandedGroups({});
    setCommandLogs([]);
  }, [selectedId]);

  const keyTree = useMemo<RedisKeyTreeNode[]>(() => {
    const roots: RedisKeyTreeNode[] = [];
    const delim = groupDelimiter.trim();
    for (const item of keys) {
      const display = item.key_utf8 ?? item.key_base64;
      const rawParts = delim ? display.split(delim) : [display];
      const parts = rawParts.filter((part) => part.length > 0);
      const normalized = parts.length > 0 ? parts : [display];
      const finalParts = normalized.length > 1 ? normalized : ["未分组", normalized[0]];
      insertKeyNode(roots, finalParts, item.key_base64, display);
    }
    return sortTreeNodes(roots);
  }, [groupDelimiter, keys]);

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    if (!createOpen) {
      setCreateTesting(false);
      setCreateTestResult(null);
      setCreateSaving(false);
      setCreateSaveResult(null);
    }
  }, [createOpen]);

  useEffect(() => {
    if (!editOpen || !selected) return;
    setEditForm({
      name: selected.name,
      address: selected.address,
      db: selected.db,
    });
    void onGetSecret(selected.id).then((secret) => setEditSecret(secret ?? ""));
  }, [editOpen, onGetSecret, selected]);

  useEffect(() => {
    if (!editOpen) {
      setEditTesting(false);
      setEditTestResult(null);
      setEditSaving(false);
      setEditSaveResult(null);
    }
  }, [editOpen]);

  const testCreateConnection = async () => {
    setCreateTesting(true);
    setCreateTestResult(null);
    try {
      await testRedisConnection(createForm.address, createForm.db, createSecret || undefined);
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
      await testRedisConnection(editForm.address, editForm.db, editSecret || undefined);
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
      const created = await onCreate(createForm, createSecret || undefined);
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
      await onUpdate(selected.id, editForm, editSecret || undefined);
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
          if (result.keys.length > 0) {
            await pickKey(result.keys[0].key_base64);
          } else {
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
          break;
        case "hash":
          setEditorText(data.payload.entries.map((entry) => `${entry.field}\t${entry.value}`).join("\n"));
          break;
        case "list":
          setEditorText(data.payload.items.join("\n"));
          break;
        case "set":
          setEditorText(data.payload.members.join("\n"));
          break;
        case "zset":
          setEditorText(data.payload.entries.map((entry) => `${entry.score}\t${entry.member}`).join("\n"));
          break;
        default:
          setEditorText("");
      }
      setSaveResult(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSaveResult(tr("modal.testFailed", { message }));
    }
  };

  const toHashEntries = (text: string): RedisHashEntry[] =>
    text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [field, ...rest] = line.split("\t");
        return { field, value: rest.join("\t") };
      });

  const toZsetEntries = (text: string): RedisZsetEntry[] =>
    text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [score, ...rest] = line.split("\t");
        return { score: Number(score), member: rest.join("\t") };
      });

  const buildPayload = (): RedisValueUpdate | null => {
    if (!selectedKeyData) return null;
    switch (selectedKeyData.payload.kind) {
      case "string":
        return { kind: "string", value: editorText };
      case "hash":
        return { kind: "hash", entries: toHashEntries(editorText) };
      case "list":
        return {
          kind: "list",
          items: editorText
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
        };
      case "set":
        return {
          kind: "set",
          members: Array.from(
            new Set(
              editorText
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean)
            )
          ),
        };
      case "zset":
        return { kind: "zset", entries: toZsetEntries(editorText) };
      default:
        return null;
    }
  };

  const saveValue = async () => {
    if (!selected || !selectedKeyData) return;
    const payload = buildPayload();
    if (!payload) return;
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
  };

  const saveTtl = async () => {
    if (!selected || !selectedKeyData) return;
    await ensureConnected();
    const nextTtl = ttlInput.trim() ? Number(ttlInput) : undefined;
    appendCommandLog(
      Number.isFinite(nextTtl) ? `EXPIRE ${selectedKeyData.key_base64} ${nextTtl}` : `PERSIST ${selectedKeyData.key_base64}`
    );
    await redisSetTtl(selected.id, selectedKeyData.key_base64, Number.isFinite(nextTtl) ? nextTtl : undefined);
    await pickKey(selectedKeyData.key_base64);
    setSaveResult(tr("redis.page.ttlSaved"));
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
        if (!map.has(currentDb)) {
          map.set(currentDb, { db: currentDb, key_count: 0 });
        }
        setDbSwitchOptions(Array.from(map.values()).sort((a, b) => a.db - b.db));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setDbSwitchResult(`加载 DB 列表失败: ${message}`);
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
      setDbSwitchResult("DB 必须是非负整数。");
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
      await onUpdate(
        dbSwitchConn.id,
        {
          name: dbSwitchConn.name,
          address: dbSwitchConn.address,
          db: nextDb,
        },
        secret ?? undefined
      );
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
      setSaveResult(`已切换到 DB ${nextDb}`);
      setDbSwitchOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setDbSwitchResult(`切换 DB 失败: ${message}`);
    } finally {
      setDbSwitchSaving(false);
    }
  };

  useEffect(() => {
    if (!selected || keysLoaded || scanLoading) return;
    void loadKeys(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, keysLoaded, scanLoading]);

  return (
    <section className="workspace zk-page redis-page">
      <header className="topbar">
        <div className="topbar-title">
          <div className="topbar-title-text">
            <div className="topbar-title-line">{tr("redis.page.title")}</div>
            <div className="topbar-subtitle">{selected ? selected.name : tr("redis.page.noSelection")}</div>
          </div>
        </div>
        <div className="actions">
          <button className="btn btn-ghost" onClick={onBack}>
            {tr("terminal.back")}
          </button>
          <button className="btn btn-ghost" onClick={() => setCreateOpen(true)}>
            {tr("redis.page.addConnection")}
          </button>
          <button className="btn btn-ghost" disabled={!selected} onClick={() => setEditOpen(true)}>
            {tr("modal.editHost")}
          </button>
          <button className="btn btn-ghost" disabled={!selected} onClick={() => selected && void onDelete(selected.id)}>
            {tr("session.delete")}
          </button>
          <button
            className="btn btn-ghost"
            disabled={!selected || !connected}
            onClick={() =>
              selected &&
              void disconnectRedis(selected.id).finally(() => {
                appendCommandLog("DISCONNECT");
                setConnected(false);
              })
            }
          >
            {tr("zk.page.disconnect")}
          </button>
          <span className={connected ? "pill pill-ok" : "pill"}>{connected ? tr("top.online") : tr("top.offline")}</span>
          <span className="pill pill-muted">{status}</span>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onDismiss={onDismissError} /> : null}

      <div className="terminal-layout">
        <aside className="session-list">
          <div className="session-list-header">{tr("redis.page.connectionList")}</div>
          <ul className="session-table-body">
            {connections.map((conn) => (
              <li key={conn.id} className={`session-line redis-conn-line ${selectedId === conn.id ? "active" : ""}`}>
                <button className="session-main redis-conn-main" onClick={() => onSelect(conn.id)}>
                  <span className="session-col name redis-conn-name">{conn.name}</span>
                  <span className="session-col host redis-conn-host">{conn.address}</span>
                  <span className="redis-db-badge">DB {conn.db}</span>
                </button>
                <div className="session-actions redis-conn-actions">
                  <button className="btn btn-ghost" onClick={() => openDbSwitchModal(conn)}>
                    切换 DB
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </aside>
        <div className="terminal-main">
          {!selected ? (
            <div className="empty-state">
              <div className="empty-title">{tr("redis.page.noSelection")}</div>
              <div className="empty-subtitle">{tr("redis.page.hint")}</div>
            </div>
          ) : (
            <div className="zk-browser">
              <div className="zk-browser-header">
                <input
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  placeholder={tr("redis.page.patternPlaceholder")}
                />
                <input value={groupDelimiter} onChange={(e) => setGroupDelimiter(e.target.value)} placeholder="分组分隔符，默认 :" />
                <button className="btn btn-ghost" onClick={() => void loadKeys()}>
                  {scanLoading ? tr("modal.testing") : tr("redis.page.loadKeys")}
                </button>
              </div>
              <div className="zk-browser-body" style={{ ["--zk-data-width" as string]: "460px" }}>
                <div className="zk-tree redis-key-tree">
                  {keyTree.map((node) => (
                    <KeyTreeNode
                      key={node.id}
                      node={node}
                      level={0}
                      expandedGroups={expandedGroups}
                      onToggle={toggleGroup}
                      onPick={(key) => void pickKey(key)}
                      selectedKeyBase64={selectedKeyData?.key_base64}
                    />
                  ))}
                  <div className="zk-node">
                    <button
                      className="btn btn-ghost zk-node-name"
                      disabled={scanLoading || scanCursor === 0}
                      onClick={() => void loadKeys(false)}
                    >
                      {tr("redis.page.loadMore")}
                    </button>
                  </div>
                  {keysLoaded && !scanLoading && keys.length === 0 ? (
                    <div className="card-subtitle">{tr("home.searchNoResults")}</div>
                  ) : null}
                </div>
                <div className="zk-pane-splitter" />
                <div className="zk-data">
                  <div className="zk-data-head">
                    <div className="card-title">
                      {selectedKeyData
                        ? (selectedKeyData.key_utf8 ?? selectedKeyData.key_base64)
                        : tr("redis.page.selectKeyHint")}
                    </div>
                    <button
                      className="btn btn-primary"
                      disabled={!selectedKeyData || selectedKeyData.payload.kind === "unsupported"}
                      onClick={() => void saveValue()}
                    >
                      {tr("zk.page.save")}
                    </button>
                  </div>
                  {selectedKeyData ? (
                    <div className="card-subtitle">
                      {tr("redis.page.keyType", { type: selectedKeyData.key_type })}
                    </div>
                  ) : null}
                  {selectedKeyData ? (
                    <div className="zk-browser-header">
                      <input
                        placeholder={tr("redis.page.ttlPlaceholder")}
                        value={ttlInput}
                        onChange={(e) => setTtlInput(e.target.value)}
                      />
                      <button className="btn btn-ghost" onClick={() => void saveTtl()}>
                        {tr("redis.page.saveTtl")}
                      </button>
                    </div>
                  ) : null}
                  {saveResult ? <div className="zk-save-result">{saveResult}</div> : null}
                  {selectedKeyData?.payload.kind === "unsupported" ? (
                    <div className="card-subtitle">
                      {tr("redis.page.unsupportedType", { type: selectedKeyData.payload.raw_type })}
                    </div>
                  ) : (
                    <textarea
                      className="zk-data-textarea"
                      value={editorText}
                      onChange={(e) => setEditorText(e.target.value)}
                      placeholder={tr("redis.page.valuePlaceholder")}
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <section className="redis-command-panel">
        <div className="redis-command-panel-header">Redis Commands</div>
        <div className="redis-command-panel-body">
          {commandLogs.length === 0 ? (
            <div className="card-subtitle">暂无命令记录。</div>
          ) : (
            commandLogs.map((line, index) => (
              <div key={`${line}-${index}`} className="redis-command-line" title={line}>
                {line}
              </div>
            ))
          )}
        </div>
      </section>

      {createOpen ? (
        <div className="modal-backdrop" onClick={() => setCreateOpen(false)}>
          <div className="modal-card redis-resizable-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h4>{tr("redis.page.addConnection")}</h4>
            </div>
            <div className="session-form">
              <input placeholder={tr("form.name")} value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} />
              <input placeholder={tr("redis.form.address")} value={createForm.address} onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })} />
              <input placeholder={tr("redis.form.db")} type="number" value={createForm.db ?? 0} onChange={(e) => setCreateForm({ ...createForm, db: Number(e.target.value) })} />
              <input placeholder={tr("form.secretOptional")} type="password" value={createSecret} onChange={(e) => setCreateSecret(e.target.value)} />
              {createTestResult ? <div className="modal-inline-notice">{createTestResult}</div> : null}
              {createSaveResult ? <div className="modal-inline-notice modal-inline-notice-error">{createSaveResult}</div> : null}
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" disabled={createSaving} onClick={() => setCreateOpen(false)}>{tr("modal.cancel")}</button>
              <button className="btn btn-ghost" disabled={createTesting || createSaving} onClick={() => void testCreateConnection()}>
                {createTesting ? tr("modal.testing") : tr("modal.testConnection")}
              </button>
              <button className="btn btn-primary" disabled={createSaving} onClick={() => void saveCreateConnection()}>
                {createSaving ? tr("modal.saving") : tr("modal.add")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editOpen && selected ? (
        <div className="modal-backdrop" onClick={() => setEditOpen(false)}>
          <div className="modal-card redis-resizable-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h4>{tr("modal.editHost")}</h4>
            </div>
            <div className="session-form">
              <input placeholder={tr("form.name")} value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              <input placeholder={tr("redis.form.address")} value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
              <input placeholder={tr("redis.form.db")} type="number" value={editForm.db ?? 0} onChange={(e) => setEditForm({ ...editForm, db: Number(e.target.value) })} />
              <input placeholder={tr("form.secretOptional")} type="password" value={editSecret} onChange={(e) => setEditSecret(e.target.value)} />
              {editTestResult ? <div className="modal-inline-notice">{editTestResult}</div> : null}
              {editSaveResult ? <div className="modal-inline-notice modal-inline-notice-error">{editSaveResult}</div> : null}
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" disabled={editSaving} onClick={() => setEditOpen(false)}>{tr("modal.cancel")}</button>
              <button className="btn btn-ghost" disabled={editTesting || editSaving} onClick={() => void testEditConnection()}>
                {editTesting ? tr("modal.testing") : tr("modal.testConnection")}
              </button>
              <button className="btn btn-primary" disabled={editSaving} onClick={() => void saveEditConnection()}>
                {editSaving ? tr("modal.saving") : tr("modal.save")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {dbSwitchOpen && dbSwitchConn ? (
        <div className="modal-backdrop" onClick={() => setDbSwitchOpen(false)}>
          <div className="modal-card redis-resizable-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h4>切换 Redis DB</h4>
            </div>
            <div className="session-form">
              <input value={dbSwitchConn.name} disabled />
              {dbSwitchLoading ? <div className="modal-inline-notice">正在查询 Redis DB 列表...</div> : null}
              {!dbSwitchLoading ? (
                <div className="redis-db-options">
                  {dbSwitchOptions.map((row) => (
                    <button
                      key={`db-opt-${row.db}`}
                      className={`btn btn-ghost redis-db-option ${dbSwitchValue === String(row.db) ? "active" : ""}`}
                      onClick={() => setDbSwitchValue(String(row.db))}
                    >
                      DB {row.db} ({row.key_count} keys)
                    </button>
                  ))}
                </div>
              ) : null}
              <input placeholder="请输入 DB（非负整数）" type="number" min={0} value={dbSwitchValue} onChange={(e) => setDbSwitchValue(e.target.value)} />
              {dbSwitchResult ? <div className="modal-inline-notice modal-inline-notice-error">{dbSwitchResult}</div> : null}
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" disabled={dbSwitchSaving} onClick={() => setDbSwitchOpen(false)}>
                {tr("modal.cancel")}
              </button>
              <button className="btn btn-primary" disabled={dbSwitchSaving} onClick={() => void switchConnectionDb()}>
                {dbSwitchSaving ? tr("modal.saving") : "切换 DB"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
