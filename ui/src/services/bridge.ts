import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Session, SessionInput, SftpEntry } from "./types";

export async function listSessions(): Promise<Session[]> {
  return invoke("list_sessions");
}

export async function createSession(input: SessionInput, secret?: string): Promise<Session> {
  return invoke("create_session", { input, secret });
}

export async function updateSession(id: string, input: SessionInput, secret?: string): Promise<Session> {
  return invoke("update_session", { id, input, secret });
}

export async function deleteSession(id: string): Promise<void> {
  await invoke("delete_session", { id });
}

export async function hasSessionSecret(id: string): Promise<boolean> {
  return invoke("has_session_secret", { id });
}

export async function connectSession(id: string, secret?: string): Promise<void> {
  await invoke("connect_session", { id, secret });
}

export async function pullOutput(id: string): Promise<string | null> {
  return invoke("pull_output", { id });
}

export async function disconnectSession(id: string): Promise<void> {
  await invoke("disconnect_session", { id });
}

export async function sendInput(id: string, input: string): Promise<void> {
  await invoke("send_input", { id, input });
}

export async function resizeTerminal(id: string, cols: number, rows: number): Promise<void> {
  await invoke("resize_terminal", { id, cols, rows });
}

export async function listSftpDir(id: string, path?: string): Promise<SftpEntry[]> {
  return invoke("list_sftp_dir", { id, path });
}

export function onTerminalOutput(handler: (payload: { sessionId: string; data: string }) => void) {
  return listen<{ sessionId: string; data: string }>("terminal-output", (event) => {
    handler(event.payload);
  });
}

export function onDebugLog(
  handler: (payload: { sessionId: string; stage: string; message: string }) => void
) {
  return listen<{ sessionId: string; stage: string; message: string }>("debug-log", (event) => {
    handler(event.payload);
  });
}
