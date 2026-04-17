import { useMemo, useState } from "react";
import type { Protocol, Session, SessionInput } from "../services/types";

interface Props {
  sessions: Session[];
  selectedId?: string;
  connectedId?: string;
  onSelect: (id: string) => void;
  onCreate: (input: SessionInput, secret?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onConnect?: (id: string) => void;
}

const defaultForm: SessionInput = {
  name: "",
  protocol: "ssh",
  host: "",
  port: 22,
  username: "",
  encoding: "utf-8",
  keepalive_secs: 30,
};

export default function SessionList({
  sessions,
  selectedId,
  connectedId,
  onSelect,
  onCreate,
  onDelete,
  onConnect,
}: Props) {
  const [form, setForm] = useState<SessionInput>(defaultForm);
  const [secret, setSecret] = useState("");

  const protocolPort = useMemo(() => (form.protocol === "ssh" ? 22 : 23), [form.protocol]);

  const submit = async () => {
    if (!form.host.trim()) return;
    if (!form.username.trim()) return;
    if (form.protocol === "ssh" && !secret.trim()) return;
    await onCreate(form, secret || undefined);
    setForm(defaultForm);
    setSecret("");
  };

  return (
    <aside className="session-list">
      <h3>Sessions</h3>
      <ul>
        {sessions.map((session) => (
          <li key={session.id}>
            <div className="session-row">
              <button
                className={selectedId === session.id ? "active" : ""}
                onClick={() => onSelect(session.id)}
              >
                {session.name} ({session.protocol})
              </button>
              {onConnect ? (
                <button
                  className="connect"
                  onClick={() => onConnect(session.id)}
                  disabled={connectedId === session.id}
                  title="Connect"
                >
                  连
                </button>
              ) : null}
              <button
                className="danger"
                onClick={() => void onDelete(session.id)}
                title="Delete"
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="session-form">
        <input
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <select
          value={form.protocol}
          onChange={(e) => {
            const protocol = e.target.value as Protocol;
            setForm({ ...form, protocol, port: protocol === "ssh" ? 22 : 23 });
          }}
        >
          <option value="ssh">SSH</option>
          <option value="telnet">Telnet</option>
        </select>
        <input
          placeholder="Host"
          value={form.host}
          onChange={(e) => {
            const host = e.target.value;
            setForm((prev) => ({
              ...prev,
              host,
              name: prev.name || host,
            }));
          }}
        />
        <input
          placeholder="Port"
          type="number"
          value={form.port || protocolPort}
          onChange={(e) => setForm({ ...form, port: Number(e.target.value) })}
        />
        <input
          placeholder="Username"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
        />
        <input
          placeholder={form.protocol === "ssh" ? "SSH Password (saved)" : "Secret (optional)"}
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
        />
        <button
          onClick={submit}
          disabled={
            !form.host.trim() ||
            !form.username.trim() ||
            (form.protocol === "ssh" && !secret.trim())
          }
        >
          Add Session
        </button>
      </div>
    </aside>
  );
}
