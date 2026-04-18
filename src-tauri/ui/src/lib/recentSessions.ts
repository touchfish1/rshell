const STORAGE_KEY = "rshell.recentSessionIds";
const MAX_IDS = 32;

export function touchRecentSession(sessionId: string): void {
  let ids: string[] = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      ids = Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string")
        : [];
    }
  } catch {
    ids = [];
  }
  const next = [sessionId, ...ids.filter((id) => id !== sessionId)].slice(0, MAX_IDS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("rshell-recent-bumped"));
}

export function getRecentSessionIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const ids = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}
