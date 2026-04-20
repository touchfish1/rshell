import { useEffect, useMemo, useRef, useState } from "react";
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

  const buildPayload = (): RedisValueUpdate | null => {
    if (!selectedKeyData) return null;
    switch (selectedKeyData.payload.kind) {
      case "string":
        return { kind: "string", value: editorText };
      case "hash":
        return {
          kind: "hash",
          entries: hashEntries.filter((entry) => entry.field.trim().length > 0),
        };
      case "list":
        return {
          kind: "list",
          items: listItems.map((item) => item.trim()).filter(Boolean),
        };
      case "set":
        return {
          kind: "set",
          members: Array.from(new Set(setMembers.map((item) => item.trim()).filter(Boolean))),
        };
      case "zset":
        return {
          kind: "zset",
          entries: zsetEntries
            .filter((entry) => entry.member.trim().length > 0)
            .map((entry) => ({
              member: entry.member,
              score: Number.isFinite(entry.score) ? entry.score : 0,
            })),
        };
      default:
        return null;
    }
  };

  const renderTypedEditor = () => {
    if (!selectedKeyData) return null;
    switch (selectedKeyData.payload.kind) {
      case "string":
        return (
          <textarea
            className="zk-data-textarea"
            value={editorText}
            onChange={(e) => setEditorText(e.target.value)}
            placeholder={tr("redis.page.valuePlaceholder")}
          />
        );
      case "hash":
        return (
          <div className="redis-typed-editor">
            {hashEntries.map((entry, index) => (
              <div className="redis-typed-row" key={`hash-${index}`}>
                <input
                  value={entry.field}
                  placeholder="field"
                  onChange={(e) =>
                    setHashEntries((prev) =>
                      prev.map((item, i) => (i === index ? { ...item, field: e.target.value } : item))
                    )
                  }
                />
                <input
                  value={entry.value}
                  placeholder="value"
                  onChange={(e) =>
                    setHashEntries((prev) =>
                      prev.map((item, i) => (i === index ? { ...item, value: e.target.value } : item))
                    )
                  }
                />
                <button
                  className="btn btn-ghost"
                  onClick={() => setHashEntries((prev) => prev.filter((_, i) => i !== index))}
                >
                  删除
                </button>
              </div>
            ))}
            <button className="btn btn-ghost" onClick={() => setHashEntries((prev) => [...prev, { field: "", value: "" }])}>
              新增 field
            </button>
          </div>
        );
      case "list":
        return (
          <div className="redis-typed-editor">
            {listItems.map((item, index) => (
              <div className="redis-typed-row" key={`list-${index}`}>
                <input
                  value={item}
                  placeholder={`index ${index}`}
                  onChange={(e) =>
                    setListItems((prev) => prev.map((v, i) => (i === index ? e.target.value : v)))
                  }
                />
                <button className="btn btn-ghost" onClick={() => setListItems((prev) => prev.filter((_, i) => i !== index))}>
                  删除
                </button>
              </div>
            ))}
            <button className="btn btn-ghost" onClick={() => setListItems((prev) => [...prev, ""])}>
              新增 item
            </button>
          </div>
        );
      case "set":
        return (
          <div className="redis-typed-editor redis-typed-editor-set">
            <div className="redis-set-chip-list">
              {setMembers.map((item, index) => (
                <div key={`set-chip-${index}`} className={`redis-set-chip ${setEditIndex === index ? "active" : ""}`}>
                  <button
                    className="redis-set-chip-main"
                    title={item}
                    onClick={() => {
                      setSetEditIndex(index);
                      setSetDraft(item);
                    }}
                  >
                    {item}
                  </button>
                  <button
                    className="redis-set-chip-remove"
                    title="删除 member"
                    onClick={() =>
                      setSetMembers((prev) => {
                        const next = prev.filter((_, i) => i !== index);
                        if (setEditIndex === index) {
                          setSetEditIndex(null);
                          setSetDraft("");
                        } else if (setEditIndex != null && setEditIndex > index) {
                          setSetEditIndex(setEditIndex - 1);
                        }
                        return next;
                      })
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="redis-set-editor-bar">
              <input
                value={setDraft}
                placeholder={setEditIndex == null ? "输入 member 后新增" : "编辑当前 member"}
                onChange={(e) => setSetDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  const next = setDraft.trim();
                  if (!next) return;
                  setSetMembers((prev) => {
                    if (setEditIndex == null) return Array.from(new Set([...prev, next]));
                    const updated = prev.map((item, i) => (i === setEditIndex ? next : item));
                    return Array.from(new Set(updated));
                  });
                  setSetEditIndex(null);
                  setSetDraft("");
                }}
              />
              <button
                className="btn btn-primary redis-set-apply-btn"
                onClick={() => {
                  const next = setDraft.trim();
                  if (!next) return;
                  setSetMembers((prev) => {
                    if (setEditIndex == null) return Array.from(new Set([...prev, next]));
                    const updated = prev.map((item, i) => (i === setEditIndex ? next : item));
                    return Array.from(new Set(updated));
                  });
                  setSetEditIndex(null);
                  setSetDraft("");
                }}
              >
                {setEditIndex == null ? "新增 member" : "应用修改"}
              </button>
              {setEditIndex != null ? (
                <button
                  className="btn btn-ghost redis-set-cancel-btn"
                  onClick={() => {
                    setSetEditIndex(null);
                    setSetDraft("");
                  }}
                >
                  取消
                </button>
              ) : null}
            </div>
          </div>
        );
      case "zset":
        return (
          <div className="redis-typed-editor">
            {zsetEntries.map((entry, index) => (
              <div className="redis-typed-row" key={`zset-${index}`}>
                <input
                  type="number"
                  value={entry.score}
                  placeholder="score"
                  onChange={(e) =>
                    setZsetEntries((prev) =>
                      prev.map((item, i) => (i === index ? { ...item, score: Number(e.target.value) } : item))
                    )
                  }
                />
                <input
                  value={entry.member}
                  placeholder="member"
                  onChange={(e) =>
                    setZsetEntries((prev) =>
                      prev.map((item, i) => (i === index ? { ...item, member: e.target.value } : item))
                    )
                  }
                />
                <button className="btn btn-ghost" onClick={() => setZsetEntries((prev) => prev.filter((_, i) => i !== index))}>
                  删除
                </button>
              </div>
            ))}
            <button className="btn btn-ghost" onClick={() => setZsetEntries((prev) => [...prev, { score: 0, member: "" }])}>
              新增 member
            </button>
          </div>
        );
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
      appendCommandLog(
        Number.isFinite(nextTtl) ? `EXPIRE ${selectedKeyData.key_base64} ${nextTtl}` : `PERSIST ${selectedKeyData.key_base64}`
      );
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

  return (
    <section className="workspace zk-page redis-page" ref={redisPageRef}>
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

      <div
        className="terminal-layout"
        ref={terminalLayoutRef}
        style={{ gridTemplateColumns: `${connPanelWidth}px 8px minmax(0, 1fr)` }}
      >
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
        <div
          className="terminal-splitter redis-layout-splitter"
          onMouseDown={() => setResizingConnPanel(true)}
          title="拖动调整连接列表宽度"
        />
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
              <div
                className={`zk-browser-body ${resizingDataPane ? "resizing" : ""}`}
                ref={browserBodyRef}
                style={{ ["--zk-data-width" as string]: `${zkDataWidth}px` }}
              >
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
                <div className="zk-pane-splitter" onMouseDown={() => setResizingDataPane(true)} title="拖动调整详情宽度" />
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
                    renderTypedEditor()
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="redis-log-splitter" onMouseDown={() => setResizingCommandPanel(true)} title="拖动调整日志面板高度" />
      <section className="redis-command-panel" style={{ flex: `0 0 ${commandPanelHeight}px` }}>
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
