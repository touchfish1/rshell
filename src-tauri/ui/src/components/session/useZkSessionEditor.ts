import { useState } from "react";
import type { ZookeeperConnection, ZookeeperConnectionInput } from "../../services/types";
import type { TrFn } from "../../i18n-context";

interface UseZkSessionEditorParams {
  onGetZkSecret: (id: string) => Promise<string | null>;
  onUpdateZk: (id: string, input: ZookeeperConnectionInput, secret?: string) => Promise<void>;
  onTestZk: (input: ZookeeperConnectionInput, secret?: string) => Promise<void>;
  tr: TrFn;
}

export function useZkSessionEditor({ onGetZkSecret, onUpdateZk, onTestZk, tr }: UseZkSessionEditorParams) {
  const [pendingDeleteZk, setPendingDeleteZk] = useState<ZookeeperConnection | null>(null);
  const [zkEditConnection, setZkEditConnection] = useState<ZookeeperConnection | null>(null);
  const [zkEditForm, setZkEditForm] = useState<ZookeeperConnectionInput>({
    name: "",
    connect_string: "",
    session_timeout_ms: 10000,
  });
  const [zkEditSecret, setZkEditSecret] = useState("");
  const [zkEditSecretVisible, setZkEditSecretVisible] = useState(false);
  const [zkEditSecretLoading, setZkEditSecretLoading] = useState(false);
  const [zkEditTesting, setZkEditTesting] = useState(false);
  const [zkEditSaving, setZkEditSaving] = useState(false);
  const [zkEditTestResult, setZkEditTestResult] = useState<string | null>(null);

  const openEditZk = async (conn: ZookeeperConnection) => {
    setZkEditConnection(conn);
    setZkEditForm({
      name: conn.name,
      connect_string: conn.connect_string,
      session_timeout_ms: conn.session_timeout_ms,
    });
    setZkEditSecret("");
    setZkEditSecretVisible(false);
    setZkEditSecretLoading(true);
    setZkEditTestResult(null);
    try {
      const secret = await onGetZkSecret(conn.id);
      setZkEditSecret(secret ?? "");
    } finally {
      setZkEditSecretLoading(false);
    }
  };

  const closeEditZk = () => {
    setZkEditConnection(null);
    setZkEditTestResult(null);
  };

  const submitEditZk = async () => {
    if (!zkEditConnection) return;
    setZkEditSaving(true);
    try {
      await onUpdateZk(zkEditConnection.id, zkEditForm, zkEditSecret || undefined);
      closeEditZk();
    } finally {
      setZkEditSaving(false);
    }
  };

  const testEditZk = async () => {
    setZkEditTesting(true);
    setZkEditTestResult(null);
    try {
      await onTestZk(zkEditForm, zkEditSecret || undefined);
      setZkEditTestResult(tr("modal.testSuccess"));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setZkEditTestResult(tr("modal.testFailed", { message }));
    } finally {
      setZkEditTesting(false);
    }
  };

  return {
    pendingDeleteZk,
    setPendingDeleteZk,
    zkEditConnection,
    zkEditForm,
    setZkEditForm,
    zkEditSecret,
    setZkEditSecret,
    zkEditSecretVisible,
    setZkEditSecretVisible,
    zkEditSecretLoading,
    zkEditTesting,
    zkEditSaving,
    zkEditTestResult,
    openEditZk,
    closeEditZk,
    submitEditZk,
    testEditZk,
  };
}
