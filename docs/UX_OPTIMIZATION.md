# 用户体验分步优化计划

本文档按**依赖顺序**与**投入产出**排列，便于迭代：每完成一步可单独发版或合并 PR，不必一次做完。

---

## 阶段 0：基线（当前能力）

在继续优化前，建议先确认下列能力在主线可用（便于回归对比）：

| 领域 | 内容 |
|------|------|
| 连接 | 握手加载态、失败可重试、`pull_output` 失败清理会话 |
| 终端 | 右键复制/粘贴/全选；字号 Ctrl±/0 与 Ctrl+滚轮；选区与系统剪贴板快捷键 |
| 主机 | 搜索、最近连接排序 |
| 全局 | 错误条可关闭、i18n、在线更新流程 |

---

## 阶段 1：工作区快捷键（高优先级）

**目标**：多标签场景下接近浏览器/IDE 的操作习惯，减少鼠标依赖。

### 步骤 1.1 — 切换标签

- [x] 实现 `Ctrl+Tab` / `Ctrl+Shift+Tab` 在**终端页**会话标签间循环切换（`TerminalPage` 捕获阶段 `keydown`）。
- [x] 仅在终端页挂载时注册监听，首页不受影响。
- [x] `Ctrl+Tab` 不与 xterm 常规编辑冲突；未额外改 `useWorkspaceTabs`。

**涉及**：`TerminalPage`；逻辑在组件内用 `tabsRef` 计算相邻下标。

### 步骤 1.2 — 关闭当前标签

- [x] `Ctrl+Shift+W`：始终关闭当前活动标签。
- [x] `Ctrl+W`：焦点**不在** `.xterm` 内时关闭（侧栏、SFTP、按钮等）；终端聚焦时保留给 Shell/readline。
- [x] 编辑主机弹层、SFTP 文本编辑遮罩打开时不响应工作区快捷键。

**涉及**：`TerminalPage` → `onCloseTab(activeTabId)`。

### 步骤 1.3 — 文案与可发现性

- [x] i18n 键 `terminal.workspaceShortcutsHint`；终端页 `<section>` 的 `title` 与字号提示合并展示。
- [x] 快捷键帮助面板（`ShortcutHelpModal`）已提供完整说明文案。

---

## 阶段 2：快捷键帮助（高优先级）

**目标**：降低新用户学习成本，减少「为什么没反应」类问题。

### 步骤 2.1 — 入口

- [x] 终端页顶栏「快捷键」按钮打开 `ShortcutHelpModal`。
- [x] `Ctrl+/`：焦点**不在** `.xterm` 内时打开；帮助打开时再次 `Ctrl+/` 关闭（与标签快捷键同一套捕获逻辑，且先于 `isBlockingOverlayFocused` 处理关闭）。

### 步骤 2.2 — 内容结构

- [x] 分区：**工作区与标签 / 终端 / 标签栏（鼠标）/ SFTP**，仅列已实现行为。
- [x] 文案中说明 Cmd（粘贴、滚轮、复制等）与 Ctrl 并列。

### 步骤 2.3 — 实现方式

- [x] `modal-backdrop` + `modal-card`，样式见 `modals.css`（`.shortcut-help-*`）；`Esc` 关闭。

**涉及**：`ShortcutHelpModal.tsx`；`i18n` 键 `shortcutHelp.*`。

---

## 阶段 3：主机列表键盘导航（中高优先级）

**目标**：主机很多时，仅用键盘完成选中与连接。

### 步骤 3.1 — 列表聚焦模型

- [x] `SessionList` 中 `ul.session-table-body` 设置 `tabIndex={0}` 与 `aria-label`，由列表容器接收方向键（需先 Tab 聚焦到列表区域）。

### 步骤 3.2 — 按键行为

- [x] `↑/↓` 与 `j/k`（无修饰键）移动选中行（调用 `onSelect`）。
- [x] `Enter` 在已选中时触发 `onConnect(selectedId)`（与连接逻辑一致）。
- [x] `Home` / `End` 跳到列表首尾。
- [x] `F2`：打开当前选中主机的编辑弹窗。

**涉及**：`SessionList.tsx`。

---

## 阶段 4：布局与窗口持久化（中优先级）

**目标**：下次启动恢复用户习惯的分栏与窗口。

### 步骤 4.1 — 分栏宽度

- [x] `useSplitPanels` 在拖拽结束（`mouseup`）时将主机列宽、SFTP 列宽写入 `localStorage`（`rshell.workspace.hostsWidth` / `rshell.workspace.sftpWidth`），见 `lib/workspacePanelWidths.ts`。
- [x] 首次访问或非法值时使用默认 240 / 320。

### 步骤 4.2 — 窗口几何（可选）

- [x] 工程已启用 `tauri-plugin-window-state`（`main.rs`），由插件负责恢复窗口位置与尺寸；无需前端重复实现。

---

## 阶段 5：终端可读性（中优先级）

**目标**：长时间使用更舒适。

### 步骤 5.1 — 主题

- [x] 顶栏 `ThemeControls`：深色 / 浅色 / 跟随系统，写入 `rshell.theme`；`document.documentElement` 上 `data-theme`；`base.css` 提供浅色全局覆盖；xterm 通过 `lib/xtermThemes.ts` 与 `rshell-theme-changed` 事件同步配色。

### 步骤 5.2 — 字体（可选）

- [x] 终端页顶栏第二项：等宽字体预设（界面等宽 / 编程等宽 / 经典），`localStorage` `rshell.terminal.fontFamily`，`TerminalPane` 监听 `rshell-terminal-font-changed` 更新 `fontFamily`。

---

## 阶段 6：升级与强提示体验（中低优先级）

**目标**：与应用整体 UI 一致。

### 步骤 6.1 — 替换 `window.confirm`

- [x] `useUpdater` 使用 `UpgradeConfirmModal` + Promise 等待用户选择；`App` 渲染弹层并调用 `resolveUpgradePrompt`。
- [x] 下载与安装进度仍通过既有 `setStatus` 文案展示。

---

## 阶段 7：SFTP 与空状态（按需）

### SFTP

- [x] 路径面包屑可点击跳转（`SftpPanel` + `.sftp-breadcrumbs`）。
- [x] **拖拽/选择上传**：后端 `upload_sftp_file` + 前端工具栏按钮/拖拽到列表上传；为避免卡顿，单文件限制约 8MB。
- [x] 失败下载：`DownloadToastStack` 提供「重试」「关闭」；`useDownloadTasks` 记录 `sessionId`/`remotePath` 供重试。

### 空状态 / 引导

- [x] 无主机时 `HomePage` 展示编号步骤与 `docs/USER_GUIDE.md` 文字指引。

---

## 阶段 8：系统级增强（长期）

- [x] 关闭主窗口：`main.rs` 拦截 `CloseRequested` 后改为 `hide()`，实现“关闭即隐藏到托盘”。
- [x] **系统托盘 / 最小化到托盘**：前端 `useSystemTray` 创建托盘图标与菜单（显示主窗口 / 退出）；退出路径复用 `CloseConfirmModal`，有会话先确认再断开退出。

---

## 执行与验收建议

1. **每阶段单独分支或 PR**，便于回滚与 Code Review。
2. **每步完成后**：在 `src-tauri/ui` 运行 `npx tsc --noEmit`，在 `src-tauri` 运行 `cargo check`；若有 E2E 再补关键路径。
3. **文档同步**：新快捷键或行为变更时，更新本文件对应勾选框与 `USER_GUIDE.md`。

---

## 修订记录

| 日期 | 说明 |
|------|------|
| 2026-04-18 | 初版：分阶段步骤与验收要点 |
| 2026-04-18 | 阶段 1 已实现：终端页 `Ctrl+Tab` 切换标签、`Ctrl+Shift+W` / 非终端聚焦时 `Ctrl+W` 关标签；`USER_GUIDE` 已补充 |
| 2026-04-18 | 阶段 2 已实现：`ShortcutHelpModal`、顶栏入口、`Ctrl+/` 开闭、`USER_GUIDE` 已补充 |
| 2026-04-18 | 阶段 3～8 已落实：列表键盘、分栏持久化、主题与终端字体、升级内联弹窗、SFTP 面包屑/上传/下载重试、空状态步骤、关闭确认与系统托盘 |
