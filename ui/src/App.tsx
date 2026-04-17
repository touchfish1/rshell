import { useEffect, useMemo, useState } from "react";
import HomePage from "./pages/HomePage";
import TerminalPage from "./pages/TerminalPage";
import TerminalPane from "./components/TerminalPane";
import {
  connectSession,
  createSession,
  deleteSession,
  disconnectSession,
  listSessions,
  onDebugLog,
  onTerminalOutput,
  pullOutput,
  resizeTerminal,
  sendInput,
  updateSession,
} from "./services/bridge";
import type { Session, SessionInput } from "./services/types";

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [connectedId, setConnectedId] = useState<string | undefined>();
  const [currentPage, setCurrentPage] = useState<"home" | "terminal">("home");
  const [status, setStatus] = useState("Idle");
  const [error, setError] = useState<string | null>(null);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [writer, setWriter] = useState<(content: string) => void>(() => () => undefined);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedId),
    [sessions, selectedId]
  );

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
        setError(`加载会话失败: ${message}`);
      });
    const unlistenPromise = onTerminalOutput((payload) => {
      // 先不过滤会话，确保任何后端输出都能看见，便于稳定联调。
      const plain = atob(payload.data);
      console.debug("[frontend][terminal-output]", payload.sessionId, plain.slice(0, 120));
      writer(plain);
    });
    const unlistenDebugPromise = onDebugLog((payload) => {
      const line = `[${new Date().toLocaleTimeString()}] [${payload.stage}] ${payload.sessionId} ${payload.message}`;
      console.debug("[frontend][debug-log]", line);
      setDebugLogs((prev) => [...prev.slice(-79), line]);
    });

    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
      void unlistenDebugPromise.then((unlisten) => unlisten());
    };
  }, [connectedId, writer]);

  useEffect(() => {
    if (!connectedId) return;
    const timer = window.setInterval(() => {
      void pullOutput(connectedId)
        .then((base64) => {
          if (!base64) return;
          const plain = atob(base64);
          writer(plain);
        })
        .catch((err) => {
          const message = err instanceof Error ? err.message : String(err);
          setError(`拉取输出失败: ${message}`);
        });
    }, 10);
    return () => window.clearInterval(timer);
  }, [connectedId, writer]);

  const create = async (input: SessionInput, secret?: string) => {
    try {
      const session = await createSession(input, secret);
      const next = [...sessions, session];
      setSessions(next);
      setSelectedId(session.id);
      setStatus(`已创建会话: ${session.name}`);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`创建会话失败: ${message}`);
    }
  };

  const connect = async (id?: string) => {
    const targetId = id ?? selectedId;
    if (!targetId) {
      return;
    }
    const targetSession = sessions.find((session) => session.id === targetId);
    try {
      await connectSession(targetId);
      setConnectedId(targetId);
      setCurrentPage("terminal");
      setStatus(`已连接: ${targetSession?.name ?? targetId}`);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("missing SSH password")) {
        const input = window.prompt("请输入 SSH 密码（将保存到本地配置文件）");
        if (!input) {
          setError("连接失败: 缺少 SSH 密码");
          return;
        }
        try {
          if (targetSession) {
            const sessionInput: SessionInput = {
              name: targetSession.name,
              protocol: targetSession.protocol,
              host: targetSession.host,
              port: targetSession.port,
              username: targetSession.username,
              encoding: targetSession.encoding,
              keepalive_secs: targetSession.keepalive_secs,
            };
            await updateSession(targetId, sessionInput, input);
          }
          await connectSession(targetId, input);
          setConnectedId(targetId);
          setCurrentPage("terminal");
          setStatus(`已连接: ${targetSession?.name ?? targetId}`);
          setError(null);
          return;
        } catch (retryErr) {
          const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
          setError(`连接失败: ${retryMsg}`);
          return;
        }
      }
      setError(`连接失败: ${message}`);
    }
  };

  const disconnect = async () => {
    if (!connectedId) {
      return;
    }
    try {
      await disconnectSession(connectedId);
      setConnectedId(undefined);
      setCurrentPage("home");
      setStatus("已断开");
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`断开失败: ${message}`);
    }
  };

  const remove = async (id: string) => {
    try {
      if (connectedId === id) {
        await disconnectSession(id);
        setConnectedId(undefined);
      }
      await deleteSession(id);
      const next = sessions.filter((s) => s.id !== id);
      setSessions(next);
      if (selectedId === id) {
        setSelectedId(next[0]?.id);
      }
      setStatus("已删除会话");
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`删除失败: ${message}`);
    }
  };

  return (
    <main className="app-shell">
      {currentPage === "home" ? (
        <HomePage
          sessions={sessions}
          selectedId={selectedId}
          connectedId={connectedId}
          connected={Boolean(connectedId)}
          error={error}
          status={status}
          onSelect={setSelectedId}
          onCreate={create}
          onDelete={remove}
          onConnect={connect}
        />
      ) : (
        <TerminalPage
          sessionName={selectedSession?.name}
          connected={Boolean(connectedId)}
          error={error}
          status={status}
          debugLogs={debugLogs}
          onBackToHome={() => setCurrentPage("home")}
          onDisconnect={disconnect}
          onClearDebug={() => setDebugLogs([])}
          terminal={
            <TerminalPane
              connected={Boolean(connectedId)}
              registerWriter={(nextWriter) => setWriter(() => nextWriter)}
              onInput={(text) => {
                if (connectedId) {
                  void sendInput(connectedId, text).catch((err) => {
                    const message = err instanceof Error ? err.message : String(err);
                    setError(`发送失败: ${message}`);
                  });
                }
              }}
              onResize={(cols, rows) => {
                if (connectedId) {
                  void resizeTerminal(connectedId, cols, rows).catch((err) => {
                    const message = err instanceof Error ? err.message : String(err);
                    setError(`调整终端尺寸失败: ${message}`);
                  });
                }
              }}
            />
          }
        />
      )}
    </main>
  );
}
