import { useEffect, useState } from "react";
import type { MySqlConnection, MySqlConnectionInput } from "../../services/types";

interface Params {
  selected: MySqlConnection | undefined;
  onCreate: (input: MySqlConnectionInput, secret?: string) => Promise<MySqlConnection | null>;
  onUpdate: (id: string, input: MySqlConnectionInput, secret?: string) => Promise<void>;
  onGetSecret: (id: string) => Promise<string | null>;
  onSelect: (id: string) => void;
  setLocalError: (message: string) => void;
}

const DEFAULT_FORM: MySqlConnectionInput = {
  name: "",
  host: "127.0.0.1",
  port: 3306,
  username: "root",
  database: "",
};

export function useMySqlConnectionForm({
  selected,
  onCreate,
  onUpdate,
  onGetSecret,
  onSelect,
  setLocalError,
}: Params) {
  const [formOpen, setFormOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [secret, setSecret] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [form, setForm] = useState<MySqlConnectionInput>(DEFAULT_FORM);

  useEffect(() => {
    if (!formOpen) {
      setTesting(false);
      setTestResult(null);
    }
  }, [formOpen]);

  const openCreate = () => {
    setEditMode(false);
    setForm(DEFAULT_FORM);
    setSecret("");
    setFormOpen(true);
  };

  const openEdit = (nextForm: MySqlConnectionInput) => {
    setEditMode(true);
    setForm(nextForm);
    setSecret("");
    setFormOpen(true);
  };

  const saveModalForm = async () => {
    try {
      if (editMode && selected) {
        await onUpdate(selected.id, form, secret || undefined);
        setFormOpen(false);
        setSecret("");
        const updatedSecret = await onGetSecret(selected.id);
        setSecret(updatedSecret ?? "");
      } else {
        const created = await onCreate(form, secret || undefined);
        if (created) {
          onSelect(created.id);
          setFormOpen(false);
          setSecret("");
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setLocalError(message);
    }
  };

  return {
    formOpen,
    editMode,
    secret,
    testing,
    testResult,
    form,
    setFormOpen,
    setSecret,
    setTesting,
    setTestResult,
    setForm,
    openCreate,
    openEdit,
    saveModalForm,
  };
}
