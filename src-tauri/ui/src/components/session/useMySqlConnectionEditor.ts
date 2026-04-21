import { useState } from "react";
import { testMySqlConnection } from "../../services/bridge";
import type { MySqlConnection, MySqlConnectionInput } from "../../services/types";
import type { TrFn } from "../../i18n-context";

interface Params {
  onGetMysqlSecret: (id: string) => Promise<string | null>;
  onUpdateMysql: (id: string, input: MySqlConnectionInput, secret?: string) => Promise<void>;
  tr: TrFn;
}

export function useMySqlConnectionEditor({ onGetMysqlSecret, onUpdateMysql, tr }: Params) {
  const [mysqlEditConnection, setMysqlEditConnection] = useState<MySqlConnection | null>(null);
  const [mysqlEditForm, setMysqlEditForm] = useState<MySqlConnectionInput>({ name: "", host: "", port: 3306, username: "", database: "" });
  const [mysqlEditSecret, setMysqlEditSecret] = useState("");
  const [mysqlEditSecretVisible, setMysqlEditSecretVisible] = useState(false);
  const [mysqlEditSecretLoading, setMysqlEditSecretLoading] = useState(false);
  const [mysqlEditTesting, setMysqlEditTesting] = useState(false);
  const [mysqlEditSaving, setMysqlEditSaving] = useState(false);
  const [mysqlEditResult, setMysqlEditResult] = useState<string | null>(null);

  const openEditMysql = async (conn: MySqlConnection) => {
    setMysqlEditConnection(conn);
    setMysqlEditForm({
      name: conn.name,
      host: conn.host,
      port: conn.port,
      username: conn.username,
      database: conn.database ?? "",
    });
    setMysqlEditResult(null);
    setMysqlEditSecretVisible(false);
    setMysqlEditSecretLoading(true);
    try {
      const secret = await onGetMysqlSecret(conn.id);
      setMysqlEditSecret(secret ?? "");
    } catch {
      setMysqlEditSecret("");
    } finally {
      setMysqlEditSecretLoading(false);
    }
  };

  const closeEditMysql = () => {
    setMysqlEditConnection(null);
    setMysqlEditResult(null);
    setMysqlEditTesting(false);
    setMysqlEditSaving(false);
    setMysqlEditSecretVisible(false);
    setMysqlEditSecretLoading(false);
  };

  const testEditMysql = async () => {
    if (!mysqlEditConnection) return;
    setMysqlEditTesting(true);
    setMysqlEditResult(null);
    try {
      await testMySqlConnection(
        mysqlEditForm.host,
        mysqlEditForm.port ?? 3306,
        mysqlEditForm.username,
        mysqlEditForm.database ?? undefined,
        mysqlEditSecret || undefined
      );
      setMysqlEditResult(tr("modal.testSuccess"));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setMysqlEditResult(tr("modal.testFailed", { message }));
    } finally {
      setMysqlEditTesting(false);
    }
  };

  const submitEditMysql = async () => {
    if (!mysqlEditConnection) return;
    setMysqlEditSaving(true);
    try {
      await onUpdateMysql(mysqlEditConnection.id, mysqlEditForm, mysqlEditSecret || undefined);
      closeEditMysql();
    } finally {
      setMysqlEditSaving(false);
    }
  };

  return {
    mysqlEditConnection,
    mysqlEditForm,
    setMysqlEditForm,
    mysqlEditSecret,
    setMysqlEditSecret,
    mysqlEditSecretVisible,
    mysqlEditSecretLoading,
    setMysqlEditSecretVisible,
    mysqlEditTesting,
    mysqlEditSaving,
    mysqlEditResult,
    openEditMysql,
    closeEditMysql,
    testEditMysql,
    submitEditMysql,
  };
}
