import type { Session } from "../services/types";

/** 先按最近使用顺序排列，其余按名称排序接在后面。 */
export function orderSessionsByRecent(sessions: Session[], recentIds: string[]): Session[] {
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const ordered: Session[] = [];
  const seen = new Set<string>();
  for (const id of recentIds) {
    const s = byId.get(id);
    if (s) {
      ordered.push(s);
      seen.add(id);
    }
  }
  const rest = sessions.filter((s) => !seen.has(s.id)).sort((a, b) => a.name.localeCompare(b.name));
  return [...ordered, ...rest];
}
