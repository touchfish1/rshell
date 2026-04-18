/** 新建终端标签：会话内序号从 1 起算（第二个同会话标签为 2）。 */
export function nextTabIndexForSession(existingCount: number): number {
  return existingCount + 1;
}

export function buildWorkspaceTabId(sessionId: string): string {
  return `${sessionId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function formatTabTitle(name: string | undefined, sessionId: string, index: number): string {
  return `${name ?? sessionId}${index > 1 ? ` (${index})` : ""}`;
}
