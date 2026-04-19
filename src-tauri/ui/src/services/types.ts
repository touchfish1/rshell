export type Protocol = "ssh" | "telnet";

/** 终端标签与后端的链路状态（用于加载态、失败重试、断开提示） */
export type TabLinkState = "connecting" | "ready" | "failed";

export interface WorkspaceTab {
  id: string;
  sessionId: string;
  title: string;
  linkState: TabLinkState;
  linkError?: string;
}

export interface Session {
  id: string;
  name: string;
  protocol: Protocol;
  host: string;
  port: number;
  username: string;
  encoding: string;
  keepalive_secs: number;
}

export interface SessionInput {
  name: string;
  protocol: Protocol;
  host: string;
  port: number;
  username: string;
  encoding?: string;
  keepalive_secs?: number;
}

/** `test_host_reachability`：ICMP 与端口/协议探测任一成功为在线；`latency_ms` 取成功路径中较短耗时（毫秒），离线为 null。 */
export interface HostReachability {
  online: boolean;
  latency_ms: number | null;
}

export interface SftpEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  mtime: number;
}

export interface HostMetrics {
  cpu_percent: number;
  memory_used_bytes: number;
  memory_total_bytes: number;
  memory_percent: number;
  disk_used_bytes: number;
  disk_total_bytes: number;
  disk_percent: number;
}

export interface SftpTextReadResult {
  content: string;
  total_bytes: number;
  loaded_bytes: number;
  truncated: boolean;
  too_large: boolean;
}

export interface AuditRecord {
  id: string;
  timestamp_ms: number;
  session_id?: string | null;
  session_name?: string | null;
  host?: string | null;
  event_type: string;
  command?: string | null;
  detail: string;
}
