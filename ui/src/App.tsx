import { useEffect, useMemo, useState } from "react";
import SessionList from "./components/SessionList";
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

  const connect = async () => {
    if (!selectedId) {
      return;
    }
    try {
      await connectSession(selectedId);
      setConnectedId(selectedId);
      setStatus(`已连接: ${selectedSession?.name ?? selectedId}`);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("missing SSH password")) {
        const input = window.prompt("请输入 SSH 密码（会保存到系统凭据管理器）");
        if (!input) {
          setError("连接失败: 缺少 SSH 密码");
          return;
        }
        try {
          if (selectedSession) {
            const sessionInput: SessionInput = {
              name: selectedSession.name,
              protocol: selectedSession.protocol,
              host: selectedSession.host,
              port: selectedSession.port,
              username: selectedSession.username,
              encoding: selectedSession.encoding,
              keepalive_secs: selectedSession.keepalive_secs,
            };
            await updateSession(selectedId, sessionInput, input);
          }
          await connectSession(selectedId, input);
          setConnectedId(selectedId);
          setStatus(`已连接: ${selectedSession?.name ?? selectedId}`);
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
      <SessionList
        sessions={sessions}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onCreate={create}
        onDelete={remove}
      />
      <section className="workspace">
        <header>
          <h2>{selectedSession?.name ?? "No session selected"}</h2>
          <div className="actions">
            <button disabled={!selectedId || !!connectedId} onClick={connect}>
              Connect
            </button>
            <button disabled={!connectedId} onClick={disconnect}>
              Disconnect
            </button>
          </div>
        </header>
        {error ? <div className="error-banner">{error}</div> : null}
        <div className="debug-panel">
          <div className="debug-panel-header">
            <span>Debug Logs</span>
            <button onClick={() => setDebugLogs([])}>Clear</button>
          </div>
          <div className="debug-panel-body">
            {debugLogs.length === 0 ? "暂无日志" : debugLogs.join("\n")}
          </div>
        </div>
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
        <footer>{status}</footer>
      </section>
    </main>
  );
}
