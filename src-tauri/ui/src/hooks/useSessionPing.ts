import { useEffect, useState } from "react";
import { testHostReachability } from "../services/bridge";
import type { Session } from "../services/types";

export function useSessionPing(opts: { currentPage: "home" | "terminal"; sessions: Session[] }) {
  const { currentPage, sessions } = opts;
  const [onlineMap, setOnlineMap] = useState<Record<string, boolean>>({});
  const [pingingIds, setPingingIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    if (currentPage !== "home") {
      setOnlineMap({});
      setPingingIds([]);
      return;
    }

    if (sessions.length === 0) {
      setOnlineMap({});
      setPingingIds([]);
      return;
    }

    const runPing = async () => {
      const ids = sessions.map((session) => session.id);
      if (!cancelled) setPingingIds(ids);
      const results = await Promise.all(
        sessions.map(async (session) => {
          try {
            const ok = await testHostReachability(session.host, session.port, 1500);
            return [session.id, ok] as const;
          } catch {
            return [session.id, false] as const;
          }
        })
      );
      if (cancelled) return;
      setOnlineMap(() => {
        const next: Record<string, boolean> = {};
        for (const [id, ok] of results) {
          next[id] = ok;
        }
        return next;
      });
      setPingingIds([]);
    };

    void runPing();
    const timer = window.setInterval(() => {
      void runPing();
    }, 10000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [currentPage, sessions]);

  return { onlineMap, pingingIds };
}

