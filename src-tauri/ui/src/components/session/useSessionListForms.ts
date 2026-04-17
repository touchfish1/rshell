import { useEffect, useMemo, useRef, useState } from "react";
import type { Session, SessionInput } from "../../services/types";
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
  onCreate: (input: SessionInput, secret?: string) => Promise<void>;
  onUpdate: (id: string, input: SessionInput, secret?: string) => Promise<void>;
  onTestConnect: (input: SessionInput) => Promise<boolean>;
  onGetSecret: (id: string) => Promise<string | null>;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
}

export function useSessionListForms({ onCreate, onUpdate, onTestConnect, onGetSecret, tr }: Options) {
  const [createForm, setCreateForm] = useState<SessionInput>(defaultForm);
  const [createSecret, setCreateSecret] = useState("");
  const [createTesting, setCreateTesting] = useState(false);
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

  const hostInputRef = useRef<HTMLInputElement | null>(null);

  const createProtocolPort = useMemo(() => (createForm.protocol === "ssh" ? 22 : 23), [createForm.protocol]);
  const editProtocolPort = useMemo(() => (editForm.protocol === "ssh" ? 22 : 23), [editForm.protocol]);

  const submitCreate = async () => {
    if (!createForm.host.trim()) return;
    if (!createForm.username.trim()) return;
    if (createForm.protocol === "ssh" && !createSecret.trim()) return;
    await onCreate(createForm, createSecret || undefined);
    setCreateForm(defaultForm);
    setCreateSecret("");
    setCreateTestResult(null);
    setShowCreateModal(false);
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
        const message = err instanceof Error ? err.message : String(err);
        setEditTestResult(tr("error.connectFailed", { message }));
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
      const ok = await onTestConnect(createForm);
      setCreateTestResult(ok ? tr("modal.testSuccess") : tr("modal.testFailed"));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setCreateTestResult(tr("error.connectFailed", { message }));
    } finally {
      setCreateTesting(false);
    }
  };

  const testEditConnect = async () => {
    setEditTesting(true);
    setEditTestResult(null);
    try {
      const ok = await onTestConnect(editForm);
      setEditTestResult(ok ? tr("modal.testSuccess") : tr("modal.testFailed"));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setEditTestResult(tr("error.connectFailed", { message }));
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

