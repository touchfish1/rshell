import { useEffect, useMemo, useRef, useState } from "react";
import type {
  HostReachability,
  RedisConnection,
  RedisConnectionInput,
  Session,
  SessionInput,
  ZookeeperConnection,
  ZookeeperConnectionInput,
} from "../../services/types";
import { testRedisConnection } from "../../services/bridge";
import type { I18nKey } from "../../i18n";

const defaultForm: SessionInput = {
  name: "",
  protocol: "ssh",
  host: "",
  port: 22,
  username: "",
  encoding: "utf-8",
  keepalive_secs: 30,
};

interface Options {
  onCreate: (input: SessionInput, secret?: string) => Promise<Session | null>;
  onCreateZk: (input: ZookeeperConnectionInput, secret?: string) => Promise<ZookeeperConnection | null>;
  onCreateRedis: (input: RedisConnectionInput, secret?: string) => Promise<RedisConnection | null>;
  onUpdate: (id: string, input: SessionInput, secret?: string) => Promise<void>;
  onTestConnect: (input: SessionInput) => Promise<HostReachability>;
  onTestZk: (input: ZookeeperConnectionInput, secret?: string) => Promise<void>;
  onGetSecret: (id: string) => Promise<string | null>;
  onConnect?: (id: string) => void;
  onConnectZk?: (id: string) => void;
  onConnectRedis?: (id: string) => void;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
}

function mapConnectErrorToMessage(tr: Options["tr"], err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  const isAuthError =
    lower.includes("auth") ||
    lower.includes("authentication") ||
    lower.includes("permission denied") ||
    lower.includes("invalid credentials") ||
    lower.includes("password");
  if (isAuthError) {
    return tr("error.connectAuthFailed", { message });
  }

  const isTimeoutError =
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("deadline exceeded");
  if (isTimeoutError) {
    return tr("error.connectTimeout", { message });
  }

  const isUnreachableError =
    lower.includes("unreachable") ||
    lower.includes("refused") ||
    lower.includes("no route") ||
    lower.includes("could not resolve") ||
    lower.includes("name or service not known") ||
    lower.includes("network is unreachable");
  if (isUnreachableError) {
    return tr("error.connectHostUnreachable", { message });
  }

  return tr("error.connectUnknown", { message });
}

export function useSessionListForms({
  onCreate,
  onCreateZk,
  onCreateRedis,
  onUpdate,
  onTestConnect,
  onTestZk,
  onGetSecret,
  onConnect,
  onConnectZk,
  onConnectRedis,
  tr,
}: Options) {
  const [createForm, setCreateForm] = useState<SessionInput>(defaultForm);
  const [createSecret, setCreateSecret] = useState("");
  const [createTesting, setCreateTesting] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createTestResult, setCreateTestResult] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editSession, setEditSession] = useState<Session | null>(null);
  const [editForm, setEditForm] = useState<SessionInput>(defaultForm);
  const [editSecret, setEditSecret] = useState("");
  const [editSecretVisible, setEditSecretVisible] = useState(false);
  const [editSecretLoaded, setEditSecretLoaded] = useState(false);
  const [editSecretLoading, setEditSecretLoading] = useState(false);
  const [editSecretDirty, setEditSecretDirty] = useState(false);
  const [editTesting, setEditTesting] = useState(false);
  const [editTestResult, setEditTestResult] = useState<string | null>(null);

  const hostInputRef = useRef<HTMLInputElement>(null);

  const createProtocolPort = useMemo(() => {
    if (createForm.protocol === "ssh") return 22;
    if (createForm.protocol === "telnet") return 23;
    if (createForm.protocol === "redis") return 6379;
    return 2181;
  }, [createForm.protocol]);
  const editProtocolPort = useMemo(() => (editForm.protocol === "ssh" ? 22 : 23), [editForm.protocol]);

  const submitCreate = async (connectAfterSave = false) => {
    if (createSubmitting) return;
    if (!createForm.host.trim()) return;
    if (createForm.protocol !== "zookeeper" && createForm.protocol !== "redis" && !createForm.username.trim()) return;
    if (createForm.protocol === "ssh" && !createSecret.trim()) return;
    setCreateSubmitting(true);
    try {
      if (createForm.protocol === "zookeeper") {
        const created = await onCreateZk(
          {
            name: createForm.name,
            connect_string: `${createForm.host}:${createForm.port}`,
            session_timeout_ms: (createForm.keepalive_secs ?? 30) * 1000,
          },
          createSecret || undefined
        );
        if (!created) return;
        if (connectAfterSave) {
          onConnectZk?.(created.id);
        }
      } else if (createForm.protocol === "redis") {
        const created = await onCreateRedis(
          {
            name: createForm.name,
            address: `${createForm.host}:${createForm.port}`,
            db: 0,
          },
          createSecret || undefined
        );
        if (!created) return;
        if (connectAfterSave) {
          onConnectRedis?.(created.id);
        }
      } else {
        const created = await onCreate(createForm, createSecret || undefined);
        if (!created) return;
        if (connectAfterSave) {
          onConnect?.(created.id);
        }
      }
      setCreateForm(defaultForm);
      setCreateSecret("");
      setCreateTestResult(null);
      setShowCreateModal(false);
    } finally {
      setCreateSubmitting(false);
    }
  };

  const openEdit = (session: Session) => {
    setEditSession(session);
    setEditForm({
      name: session.name,
      protocol: session.protocol,
      host: session.host,
      port: session.port,
      username: session.username,
      encoding: session.encoding,
      keepalive_secs: session.keepalive_secs,
    });
    setEditSecret("");
    setEditSecretVisible(false);
    setEditSecretLoaded(false);
    setEditSecretLoading(false);
    setEditSecretDirty(false);
    setEditTestResult(null);
  };

  const submitEdit = async () => {
    if (!editSession) return;
    if (!editForm.host.trim()) return;
    if (!editForm.username.trim()) return;
    await onUpdate(editSession.id, editForm, editSecretDirty ? editSecret : undefined);
    setEditSession(null);
    setEditTestResult(null);
    setEditSecret("");
    setEditSecretVisible(false);
    setEditSecretLoaded(false);
    setEditSecretLoading(false);
    setEditSecretDirty(false);
  };

  const toggleEditSecretVisible = async () => {
    if (!editSession) return;
    if (editSecretVisible) {
      setEditSecretVisible(false);
      return;
    }
    if (!editSecretLoaded) {
      setEditSecretLoading(true);
      try {
        const secret = await onGetSecret(editSession.id);
        setEditSecret(secret ?? "");
        setEditSecretLoaded(true);
        setEditSecretDirty(false);
      } catch (err) {
        setEditTestResult(mapConnectErrorToMessage(tr, err));
      } finally {
        setEditSecretLoading(false);
      }
    }
    setEditSecretVisible(true);
  };

  const testCreateConnect = async () => {
    setCreateTesting(true);
    setCreateTestResult(null);
    try {
      if (createForm.protocol === "zookeeper") {
        await onTestZk(
          {
            name: createForm.name || createForm.host,
            connect_string: `${createForm.host}:${createForm.port}`,
            session_timeout_ms: (createForm.keepalive_secs ?? 30) * 1000,
          },
          createSecret || undefined
        );
        setCreateTestResult(tr("modal.testSuccess"));
      } else if (createForm.protocol === "redis") {
        await testRedisConnection(`${createForm.host}:${createForm.port}`, 0, createSecret || undefined);
        setCreateTestResult(tr("modal.testSuccess"));
      } else {
        const r = await onTestConnect(createForm);
        setCreateTestResult(
          r.online ? tr("modal.testSuccess") : tr("modal.testFailed", { message: tr("session.statusOffline") })
        );
      }
    } catch (err) {
      setCreateTestResult(mapConnectErrorToMessage(tr, err));
    } finally {
      setCreateTesting(false);
    }
  };

  const testEditConnect = async () => {
    setEditTesting(true);
    setEditTestResult(null);
    try {
      const r = await onTestConnect(editForm);
      setEditTestResult(r.online ? tr("modal.testSuccess") : tr("modal.testFailed"));
    } catch (err) {
      setEditTestResult(mapConnectErrorToMessage(tr, err));
    } finally {
      setEditTesting(false);
    }
  };

  useEffect(() => {
    if (showCreateModal) {
      window.requestAnimationFrame(() => hostInputRef.current?.focus());
    }
  }, [showCreateModal]);

  return {
    createForm,
    setCreateForm,
    createSecret,
    setCreateSecret,
    createTesting,
    createSubmitting,
    createTestResult,
    showCreateModal,
    setShowCreateModal,
    editSession,
    editForm,
    setEditForm,
    editSecret,
    setEditSecret,
    editSecretVisible,
    editSecretLoading,
    editTesting,
    editTestResult,
    hostInputRef,
    createProtocolPort,
    editProtocolPort,
    submitCreate,
    openEdit,
    closeEdit: () => setEditSession(null),
    submitEdit,
    toggleEditSecretVisible,
    testCreateConnect,
    testEditConnect,
    markEditSecretDirty: () => setEditSecretDirty(true),
  };
}

