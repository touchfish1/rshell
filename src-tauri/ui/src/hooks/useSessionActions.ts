import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import {
  createSession,
  deleteSession,
  disconnectSession,
  getSessionSecret,
  listSessions,
  testHostReachability,
  updateSession,
} from "../services/bridge";
import type { Session, SessionInput } from "../services/types";
import type { I18nKey } from "../i18n";

interface UseSessionActionsArgs {
  sessions: Session[];
  setSessions: Dispatch<SetStateAction<Session[]>>;
  selectedId?: string;
  setSelectedId: Dispatch<SetStateAction<string | undefined>>;
  connectedIds: string[];
  setConnectedIds: Dispatch<SetStateAction<string[]>>;
  tabs: Array<{ id: string; sessionId: string }>;
  clearTab: (tabId: string) => void;
  writerMapRef: MutableRefObject<Map<string, (content: string) => void>>;
  setStatus: (text: string) => void;
  setError: (text: string | null) => void;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
}

export function useSessionActions({
  sessions,
  setSessions,
  selectedId,
  setSelectedId,
  connectedIds,
  setConnectedIds,
  tabs,
  clearTab,
  writerMapRef,
  setStatus,
  setError,
  tr,
}: UseSessionActionsArgs) {
  useEffect(() => {
    void listSessions()
      .then((data) => {
        setSessions(data);
        if (data.length > 0) {
          setSelectedId(data[0].id);
        }
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        setError(tr("error.loadSessionsFailed", { message }));
      });
  }, [setError, setSelectedId, setSessions, tr]);

  const create = async (input: SessionInput, secret?: string) => {
    try {
      const session = await createSession(input, secret);
      const next = [...sessions, session];
      setSessions(next);
      setSelectedId(session.id);
      setStatus(tr("status.createdSession", { name: session.name }));
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(tr("error.createSessionFailed", { message }));
    }
  };

  const update = async (id: string, input: SessionInput, secret?: string) => {
    try {
      const updated = await updateSession(id, input, secret);
      setSessions((prev) => prev.map((session) => (session.id === id ? updated : session)));
      setStatus(tr("status.updatedHost", { name: updated.name }));
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(tr("error.updateHostFailed", { message }));
    }
  };

  const remove = async (id: string) => {
    try {
      if (connectedIds.includes(id)) {
        await disconnectSession(id);
        setConnectedIds((prev) => prev.filter((sid) => sid !== id));
        tabs
          .filter((tab) => tab.sessionId === id)
          .forEach((tab) => {
            writerMapRef.current.delete(tab.id);
            clearTab(tab.id);
          });
        Array.from(writerMapRef.current.keys()).forEach((key) => {
          if (key.startsWith(`${id}-`)) {
            writerMapRef.current.delete(key);
          }
        });
      }
      await deleteSession(id);
      const next = sessions.filter((s) => s.id !== id);
      setSessions(next);
      if (selectedId === id) {
        setSelectedId(next[0]?.id);
      }
      setStatus(tr("status.deletedSession"));
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(tr("error.deleteFailed", { message }));
    }
  };

  const testConnect = async (input: SessionInput) => {
    return testHostReachability(input.host, input.port, 2000);
  };

  const getSecret = async (id: string) => {
    return getSessionSecret(id);
  };

  return {
    create,
    update,
    remove,
    testConnect,
    getSecret,
  };
}

