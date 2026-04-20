import type { SftpEntry } from "../../services/types";

export function buildSftpPathCrumbs(path: string): Array<{ label: string; path: string }> {
  const p = path.replace(/\/+$/, "") || "/";
  if (p === "/") return [{ label: "/", path: "/" }];
  const segments = p.split("/").filter(Boolean);
  const out: { label: string; path: string }[] = [{ label: "/", path: "/" }];
  let acc = "";
  for (const seg of segments) {
    acc += `/${seg}`;
    out.push({ label: seg, path: acc });
  }
  return out;
}

export function getSftpDisplayName(entry: SftpEntry, unnamedLabel: string): string {
  if (entry.name && entry.name.trim()) return entry.name;
  const normalized = entry.path.replace(/\\/g, "/").replace(/\/+$/, "");
  const fallback = normalized.split("/").pop();
  return fallback && fallback.trim() ? fallback : unnamedLabel;
}

export async function readFileAsBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.slice(i, i + chunk));
  }
  return btoa(binary);
}
