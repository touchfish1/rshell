/** 应用壳固定为深色主题（`data-theme="dark"`），不再提供亮/暗/系统切换。 */
export function initAppShellTheme(): void {
  document.documentElement.setAttribute("data-theme", "dark");
}
