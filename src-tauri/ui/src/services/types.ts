export type Protocol = "ssh" | "telnet";

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
