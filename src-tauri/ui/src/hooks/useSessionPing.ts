import { useCallback, useEffect, useRef, useState } from "react";
import { testHostReachability } from "../services/bridge";
import type { Session } from "../services/types";

export function useSessionPing(opts: { currentPage: "home" | "terminal"; sessions: Session[] }) {
  const { currentPage, sessions } = opts;
  const [onlineMap, setOnlineMap] = useState<Record<string, boolean>>({});
  const [pingingIds, setPingingIds] = useState<string[]>([]);

  const currentPageRef = useRef(currentPage);
  const sessionsRef = useRef(sessions);
  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  const runPing = useCallback(async (cancelledRef?: { current: boolean }) => {
    if (cancelledRef?.current) {
      return;
    }
    if (currentPageRef.current !== "home") {
      return;
    }
    const list = sessionsRef.current;
    if (list.length === 0) {
      setOnlineMap({});
      setPingingIds([]);
      return;
    }
    const ids = list.map((s) => s.id);
    if (!cancelledRef?.current) {
      setPingingIds(ids);
    }
    const results = await Promise.all(
      list.map(async (session) => {
        try {
          const ok = await testHostReachability(session.host, session.port, 1500, session.protocol);
          return [session.id, ok] as const;
        } catch {
          return [session.id, false] as const;
        }
      })
    );
    if (cancelledRef?.current) {
      return;
    }
    if (currentPageRef.current !== "home") {
      return;
    }
    setOnlineMap(() => {
      const next: Record<string, boolean> = {};
      for (const [id, ok] of results) {
        next[id] = ok;
      }
      return next;
    });
    setPingingIds([]);
  }, []);

  useEffect(() => {
    const cancelledRef = { current: false };

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

    void runPing(cancelledRef);
    const timer = window.setInterval(() => {
      void runPing(cancelledRef);
    }, 10000);
    return () => {
      cancelledRef.current = true;
      window.clearInterval(timer);
    };
  }, [currentPage, sessions, runPing]);

  const refreshReachability = useCallback(() => {
    void runPing();
  }, [runPing]);

  return { onlineMap, pingingIds, refreshReachability };
}
