const KEY_HOSTS = "rshell.workspace.hostsWidth";
const KEY_SFTP = "rshell.workspace.sftpWidth";

function readNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 80) return fallback;
    return n;
  } catch {
    return fallback;
  }
}

export function readInitialHostsWidth(fallback = 240): number {
  return readNumber(KEY_HOSTS, fallback);
}

export function readInitialSftpWidth(fallback = 320): number {
  return readNumber(KEY_SFTP, fallback);
}

export function persistHostsWidth(px: number): void {
  try {
    localStorage.setItem(KEY_HOSTS, String(Math.round(px)));
  } catch {
    /* ignore */
  }
}

export function persistSftpWidth(px: number): void {
  try {
    localStorage.setItem(KEY_SFTP, String(Math.round(px)));
  } catch {
    /* ignore */
  }
}
