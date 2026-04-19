/**
 * 前端与 Tauri 后端的薄封装：`invoke` 各命令、`listen` 审计事件，类型与 `types.ts` 对齐。
 */
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  AuditRecord,
  HostMetrics,
  Protocol,
  Session,
  SessionInput,
  SftpEntry,
  SftpTextReadResult,
} from "./types";

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

export async function getSessionSecret(id: string): Promise<string | null> {
  return invoke("get_session_secret", { id });
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

export async function downloadSftpFile(id: string, remotePath: string): Promise<string> {
  return invoke("download_sftp_file", { id, remotePath });
}

export async function readSftpTextFile(id: string, remotePath: string): Promise<SftpTextReadResult> {
  return invoke("read_sftp_text_file", { id, remotePath });
}

export async function saveSftpTextFile(id: string, remotePath: string, content: string): Promise<void> {
  await invoke("save_sftp_text_file", { id, remotePath, content });
}

export async function uploadSftpFile(
  id: string,
  remoteDir: string,
  fileName: string,
  contentBase64: string
): Promise<void> {
  await invoke("upload_sftp_file", { id, remoteDir, fileName, contentBase64 });
}

export async function openInFileManager(path: string): Promise<void> {
  await invoke("open_in_file_manager", { path });
}

export async function openExternalUrl(url: string): Promise<void> {
  await invoke("open_external_url", { url });
}

export async function testHostReachability(
  host: string,
  port: number,
  timeoutMs = 2000,
  protocol?: Protocol
): Promise<boolean> {
  const ok = await invoke<boolean>("test_host_reachability", {
    host,
    port,
    timeout_ms: timeoutMs,
    protocol: protocol ?? null,
  });
  return ok === true;
}

export async function getHostMetrics(id: string): Promise<HostMetrics> {
  return invoke("get_host_metrics", { id });
}

export async function listAudits(limit = 300): Promise<AuditRecord[]> {
  return invoke("list_audits", { limit });
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
