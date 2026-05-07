import { useCallback, useEffect, useState } from "react";
import { createEnvironment, getCurrentEnvironment, listEnvironments, renameCurrentEnvironment, switchEnvironment } from "../services/bridge";
import type { I18nKey } from "../i18n";

interface Deps {
  onRefresh: () => void;
  setStatus: (status: string) => void;
  setError: (error: string | null) => void;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
}

export function useEnvironmentManager({ onRefresh, setStatus, setError, tr }: Deps) {
  const [environments, setEnvironments] = useState<string[]>(["default"]);
  const [currentEnvironment, setCurrentEnvironment] = useState("default");
  const [environmentBusy, setEnvironmentBusy] = useState(false);

  useEffect(() => {
    void Promise.all([listEnvironments(), getCurrentEnvironment()])
      .then(([envs, current]) => {
        const next = envs.length > 0 ? envs : ["default"];
        setEnvironments(next);
        setCurrentEnvironment(current || next[0]);
      })
      .catch(() => {
        setEnvironments(["default"]);
        setCurrentEnvironment("default");
      });
  }, []);

  const switchCurrentEnvironment = useCallback(
    async (name: string) => {
      setEnvironmentBusy(true);
      try {
        const next = await switchEnvironment(name);
        setCurrentEnvironment(next);
        const envs = await listEnvironments();
        setEnvironments(envs.length > 0 ? envs : [next]);
        onRefresh();
        setStatus(tr("status.environmentSwitched", { name: next }));
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(tr("error.switchEnvironmentFailed", { message }));
      } finally {
        setEnvironmentBusy(false);
      }
    },
    [onRefresh, setStatus, setError, tr]
  );

  const createAndSwitchEnvironment = useCallback(
    async (name: string) => {
      setEnvironmentBusy(true);
      try {
        const envs = await createEnvironment(name);
        const next = await switchEnvironment(name);
        setEnvironments(envs.length > 0 ? envs : [next]);
        setCurrentEnvironment(next);
        onRefresh();
        setStatus(tr("status.environmentCreated", { name: next }));
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(tr("error.createEnvironmentFailed", { message }));
      } finally {
        setEnvironmentBusy(false);
      }
    },
    [onRefresh, setStatus, setError, tr]
  );

  const renameEnvironment = useCallback(
    async (newName: string) => {
      setEnvironmentBusy(true);
      try {
        const next = await renameCurrentEnvironment(newName);
        setCurrentEnvironment(next);
        const envs = await listEnvironments();
        setEnvironments(envs.length > 0 ? envs : [next]);
        onRefresh();
        setStatus(tr("status.environmentRenamed", { name: next }));
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(tr("error.renameEnvironmentFailed", { message }));
      } finally {
        setEnvironmentBusy(false);
      }
    },
    [onRefresh, setStatus, setError, tr]
  );

  return {
    environments,
    currentEnvironment,
    environmentBusy,
    switchCurrentEnvironment,
    createAndSwitchEnvironment,
    renameEnvironment,
  };
}
