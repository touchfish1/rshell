import { useState } from "react";
import { testPostgreSqlConnection } from "../../services/bridge";
import type { PostgreSqlConnection, PostgreSqlConnectionInput } from "../../services/types";
import type { TrFn } from "../../i18n-context";

interface Params {
  onGetPostgreSqlSecret: (id: string) => Promise<string | null>;
  onUpdatePostgreSql: (id: string, input: PostgreSqlConnectionInput, secret?: string) => Promise<void>;
  tr: TrFn;
}

export function usePostgreSqlConnectionEditor({ onGetPostgreSqlSecret, onUpdatePostgreSql, tr }: Params) {
  const [postgresqlEditConnection, setPostgresqlEditConnection] = useState<PostgreSqlConnection | null>(null);
  const [postgresqlEditForm, setPostgresqlEditForm] = useState<PostgreSqlConnectionInput>({ name: "", host: "", port: 5432, username: "", database: "" });
  const [postgresqlEditSecret, setPostgresqlEditSecret] = useState("");
  const [postgresqlEditSecretVisible, setPostgresqlEditSecretVisible] = useState(false);
  const [postgresqlEditSecretLoading, setPostgresqlEditSecretLoading] = useState(false);
  const [postgresqlEditTesting, setPostgresqlEditTesting] = useState(false);
  const [postgresqlEditSaving, setPostgresqlEditSaving] = useState(false);
  const [postgresqlEditResult, setPostgresqlEditResult] = useState<string | null>(null);

  const openEditPostgreSql = async (conn: PostgreSqlConnection) => {
    setPostgresqlEditConnection(conn);
    setPostgresqlEditForm({
      name: conn.name,
      host: conn.host,
      port: conn.port,
      username: conn.username,
      database: conn.database ?? "",
    });
    setPostgresqlEditResult(null);
    setPostgresqlEditSecretVisible(false);
    setPostgresqlEditSecretLoading(true);
    try {
      const secret = await onGetPostgreSqlSecret(conn.id);
      setPostgresqlEditSecret(secret ?? "");
    } catch {
      setPostgresqlEditSecret("");
    } finally {
      setPostgresqlEditSecretLoading(false);
    }
  };

  const closeEditPostgreSql = () => {
    setPostgresqlEditConnection(null);
    setPostgresqlEditResult(null);
    setPostgresqlEditTesting(false);
    setPostgresqlEditSaving(false);
    setPostgresqlEditSecretVisible(false);
    setPostgresqlEditSecretLoading(false);
  };

  const testEditPostgreSql = async () => {
    if (!postgresqlEditConnection) return;
    setPostgresqlEditTesting(true);
    setPostgresqlEditResult(null);
    try {
      await testPostgreSqlConnection(
        postgresqlEditForm.host,
        postgresqlEditForm.port ?? 5432,
        postgresqlEditForm.username,
        postgresqlEditForm.database ?? undefined,
        postgresqlEditSecret || undefined
      );
      setPostgresqlEditResult(tr("modal.testSuccess"));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setPostgresqlEditResult(tr("modal.testFailed", { message }));
    } finally {
      setPostgresqlEditTesting(false);
    }
  };

  const submitEditPostgreSql = async () => {
    if (!postgresqlEditConnection) return;
    setPostgresqlEditSaving(true);
    try {
      await onUpdatePostgreSql(
        postgresqlEditConnection.id,
        postgresqlEditForm,
        postgresqlEditSecret || undefined
      );
      closeEditPostgreSql();
    } finally {
      setPostgresqlEditSaving(false);
    }
  };

  return {
    postgresqlEditConnection,
    postgresqlEditForm,
    setPostgresqlEditForm,
    postgresqlEditSecret,
    setPostgresqlEditSecret,
    postgresqlEditSecretVisible,
    postgresqlEditSecretLoading,
    setPostgresqlEditSecretVisible,
    postgresqlEditTesting,
    postgresqlEditSaving,
    postgresqlEditResult,
    openEditPostgreSql,
    closeEditPostgreSql,
    testEditPostgreSql,
    submitEditPostgreSql,
  };
}
