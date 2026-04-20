import { useState } from "react";
import { listAudits } from "../services/bridge";
import type { AuditRecord } from "../services/types";

export function useAuditLogs(setError: (text: string | null) => void) {
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [audits, setAudits] = useState<AuditRecord[]>([]);

  const loadAudits = async () => {
    setAuditLoading(true);
    try {
      const data = await listAudits(300);
      setAudits(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setAuditLoading(false);
    }
  };

  return {
    auditOpen,
    setAuditOpen,
    auditLoading,
    audits,
    loadAudits,
  };
}

