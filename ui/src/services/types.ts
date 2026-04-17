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
