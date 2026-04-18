# rshell 架构设计文档

本文档说明 `rshell` 当前实现的系统结构、核心模块职责、关键数据流与设计权衡。

## 1. 整体架构

`rshell` 采用 Tauri 双层架构：

- 前端（`src-tauri/ui/`）：React + TypeScript，负责界面、交互、状态驱动
- 后端（`src-tauri/src/`）：Rust + Tauri Commands，负责网络连接、SFTP、存储与系统能力

通信方式：

- 前端主动调用后端：`invoke(command, payload)`
- 后端主动推送前端：Tauri 事件（`terminal-output`、`debug-log`）

## 2. 模块划分

## 2.1 Rust 后端

### `src-tauri/src/main.rs`

- Tauri 启动入口
- 注册 `AppState`
- 注册全部命令处理函数（session、terminal、sftp、metrics、utility）

### `src-tauri/src/api/commands.rs`

- 作为前端与业务层之间的命令适配层
- 负责参数转换、日志事件发送、调用 `AppState`

关键命令：

- 会话管理：`list_sessions`、`create_session`、`update_session`、`delete_session`
- 连接管理：`connect_session`、`disconnect_session`
- 终端 I/O：`send_input`、`pull_output`、`resize_terminal`
- SFTP：`list_sftp_dir`、`download_sftp_file`
- 监控与工具：`get_host_metrics`、`test_host_reachability`、`open_in_file_manager`、`get_session_secret`

### `src-tauri/src/app/mod.rs`

业务核心，包含：

- `AppState`（全局状态）
  - 会话列表缓存
  - 活跃终端连接表
  - 存储层句柄
- SSH 会话打开流程 `open_ssh_session`
  - TCP 连接 + SSH 握手 + 用户认证
  - 含握手重试（降低偶发失败）
- SFTP 目录读取与下载
- 主机指标采集（CPU、内存、磁盘）

### `src-tauri/src/infra/store.rs`

- 负责会话和密码持久化
- 文件：
  - `sessions.json`
  - `secrets.json`

## 2.2 前端

### `src-tauri/ui/src/App.tsx`

- 前端主状态容器
- 路由/页面切换（首页与 Terminal）
- 与后端 API 的桥接调用与事件监听
- 管理标签页、下载任务、在线状态等全局状态

### `src-tauri/ui/src/pages/HomePage.tsx`

- 主机列表主页面
- 展示在线状态与会话入口
- 承载新增/编辑/测试连接相关交互入口

### `src-tauri/ui/src/pages/TerminalPage.tsx`

- Terminal 工作台布局
- 左侧主机列表交互（单击选中/双击打开）
- 顶部标签栏与右键菜单
- 右侧固定监控区 + 文件列表区
- SFTP 右键下载菜单

### `src-tauri/ui/src/components/TerminalPane.tsx`

- xterm.js 实例封装
- 处理激活/隐藏切换的尺寸同步、聚焦、刷新
- 将输入事件传回后端
- 连接中/失败遮罩（重试、关闭标签）、右键复制/粘贴/全选，以及常见粘贴快捷键（含 Ctrl+Shift+V、Shift+Insert）
- 终端字号：`localStorage`（`rshell.terminal.fontSize`）持久化；**Ctrl/Cmd + ± / 数字键 0** 与 **Ctrl/Cmd + 滚轮** 缩放

### `src-tauri/ui/src/hooks/useWorkspaceTabs.ts`

- 维护 `WorkspaceTab`（含 `linkState`：`connecting` / `ready` / `failed` 与 `linkError`）
- `connectingHostId`：SSH 握手进行中时用于首页/终端侧栏主机行的加载态，避免重复发起连接
- 连接失败保留标签并支持 `retryConnect`；`pull_output` 异常时通过 `handlePullOutputFailure` 标记会话下所有标签为断开

### `src-tauri/ui/src/lib/recentSessions.ts`

- 本地记录最近连接过的 `sessionId`（`localStorage` + 事件 `rshell-recent-bumped`），供主机列表排序

### `src-tauri/ui/src/components/SessionList.tsx`

- 主机名/地址/用户等关键字搜索；列表按「最近连接」优先展示；无匹配时展示空结果提示

### `src-tauri/ui/src/components/ErrorBanner.tsx`

- 顶部错误条统一展示与关闭（与终端内失败遮罩可同时出现，关闭仅清除全局 `error` 文案）

### `src-tauri/ui/src/services/bridge.ts`

- 前端唯一后端调用入口
- 所有 invoke 命令与事件监听都在此定义，便于追踪与重构

## 3. 核心数据结构

## 3.1 会话模型（前后端同构）

- `Session`：`id`、`name`、`protocol`、`host`、`port`、`username`、`encoding`、`keepalive_secs`
- `SessionInput`：新增/编辑时使用
- `WorkspaceTab`（仅前端）：终端标签 `id` / `sessionId` / `title` / `linkState` / `linkError`

## 3.2 SFTP 模型

- `SftpEntry`：`name`、`path`、`is_dir`、`size`、`mtime`

## 3.3 监控模型

- `HostMetrics`
  - `cpu_percent`
  - `memory_used_bytes` / `memory_total_bytes` / `memory_percent`
  - `disk_used_bytes` / `disk_total_bytes` / `disk_percent`

## 4. 关键流程

## 4.1 终端连接流程

1. 前端调用 `connect_session`
2. 后端按协议创建客户端（SSH/Telnet）
3. 成功后将连接实例写入 `active` 映射
4. 前端开始轮询 `pull_output`
5. 输出使用 Base64 传输，前端按会话编码解码并写入 xterm

设计说明：

- Base64 用于确保事件载荷稳定传输字节流
- 终端解码放在前端，避免后端假定编码导致中文乱码

## 4.2 SFTP 目录读取流程

1. 前端调用 `list_sftp_dir(id, path)`
2. 后端验证会话协议为 SSH
3. 从存储读取密码
4. 打开 SSH 会话并初始化 SFTP
5. 读取目录项、过滤 `.` 和 `..`、排序返回

健壮性策略：

- SSH 握手失败支持重试（短退避）
- 错误信息透传到前端，便于定位

## 4.3 文件下载流程

1. 前端右键文件触发下载
2. 后端通过 SFTP 打开远程文件
3. 落盘到 `<Downloads>/rshell`
4. 如重名自动追加 `(n)` 后缀
5. 前端展示下载进度/结果通知
6. 可调用 `open_in_file_manager` 定位文件

## 4.4 主机监控流程

1. 前端按当前激活 session 触发拉取
2. 后端通过 SSH 远程执行指标命令并解析
3. 返回 `HostMetrics`
4. 前端展示文本 + 进度条，并记录最近更新时间

## 5. 状态管理策略

前端状态以 React `useState` + `useRef` 为主：

- `tabs` / `activeTabId`：标签与激活态
- `sessions`：主机配置
- `onlineMap` / `pingingIds`：在线探测状态
- `sftpEntries` / `sftpPath`：文件列表状态
- `downloadTasks`：下载任务通知

使用 `ref` 的原因：

- 在异步回调中读取最新值，规避闭包陈旧状态问题

## 6. 安全模型与已知风险

当前实现：

- 密码保存在本地配置目录 `secrets.json`

风险：

- 默认未加密，主机上具有文件访问权限的进程/用户可读取

建议：

- 迁移至系统密钥链（Windows Credential Manager / Keychain / Secret Service）
- 或引入主密码 + 本地加密方案

## 7. 扩展建议

- 接入 SSH 私钥认证
- SFTP 上传与批量操作
- 指标历史缓存 + 趋势图
- 统一错误码与可观测性字段
- 引入端到端 UI 自动化回归（关键交互：多标签、SFTP、监控）
