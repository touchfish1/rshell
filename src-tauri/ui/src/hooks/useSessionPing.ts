import { useCallback, useEffect, useRef, useState } from "react";
import { testHostReachability } from "../services/bridge";
import type { HostReachability, Session } from "../services/types";

type RunPingOpts = { cancelledRef?: { current: boolean }; manual?: boolean };

export function useSessionPing(opts: { currentPage: "home" | "terminal"; sessions: Session[] }) {
  const { currentPage, sessions } = opts;
  const [reachabilityMap, setReachabilityMap] = useState<Record<string, HostReachability>>({});
  const [refreshBusy, setRefreshBusy] = useState(false);

  const currentPageRef = useRef(currentPage);
  const sessionsRef = useRef(sessions);
  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  const runPing = useCallback(async (opts?: RunPingOpts) => {
    const cancelledRef = opts?.cancelledRef;
    if (cancelledRef?.current) {
      return;
    }
    if (currentPageRef.current !== "home") {
      return;
    }
    const list = sessionsRef.current;
    if (list.length === 0) {
      setReachabilityMap({});
      setRefreshBusy(false);
      return;
    }
    if (opts?.manual) {
      setRefreshBusy(true);
    }
    try {
      const results = await Promise.all(
        list.map(async (session) => {
          try {
            const r = await testHostReachability(session.host, session.port, 1500, session.protocol);
            return [session.id, r] as const;
          } catch {
            return [session.id, { online: false, latency_ms: null }] as const;
          }
        })
      );
      if (cancelledRef?.current) {
        return;
      }
      if (currentPageRef.current !== "home") {
        return;
      }
      setReachabilityMap(() => {
        const next: Record<string, HostReachability> = {};
        for (const [id, r] of results) {
          next[id] = r;
        }
        return next;
      });
    } finally {
      if (opts?.manual) {
        setRefreshBusy(false);
      }
    }
  }, []);

  useEffect(() => {
    const cancelledRef = { current: false };

    if (currentPage !== "home") {
      setReachabilityMap({});
      setRefreshBusy(false);
      return;
    }

    if (sessions.length === 0) {
      setReachabilityMap({});
      setRefreshBusy(false);
      return;
    }

    void runPing({ cancelledRef });
    const timer = window.setInterval(() => {
      void runPing({ cancelledRef });
    }, 10000);
    return () => {
      cancelledRef.current = true;
      window.clearInterval(timer);
    };
  }, [currentPage, sessions, runPing]);

  const refreshReachability = useCallback(() => {
    void runPing({ manual: true });
  }, [runPing]);

  return { reachabilityMap, refreshBusy, refreshReachability };
}
