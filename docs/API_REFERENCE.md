# rshell API 参考（Tauri Commands & Events）

本文档描述前端通过 `@tauri-apps/api/core` 调用的命令接口，以及后端推送事件。

## 1. 调用约定

- 调用入口：`ui/src/services/bridge.ts`
- 传输方式：`invoke(command, payload)`
- 错误处理：Rust 返回 `Result<T, String>`，前端以异常捕获

---

## 2. Commands

## 2.1 会话管理

### `list_sessions`

- 入参：无
- 返回：`Session[]`
- 说明：获取全部会话

### `create_session`

- 入参：
  - `input: SessionInput`
  - `secret?: string`
- 返回：`Session`
- 说明：创建会话并可选保存密码

### `update_session`

- 入参：
  - `id: string`（UUID）
  - `input: SessionInput`
  - `secret?: string`
- 返回：`Session`
- 说明：更新会话配置，可选更新密码

### `delete_session`

- 入参：`id: string`
- 返回：`void`
- 说明：删除会话及其密码

### `has_session_secret`

- 入参：`id: string`
- 返回：`boolean`
- 说明：检查会话是否有保存密码

### `get_session_secret`

- 入参：`id: string`
- 返回：`string | null`
- 说明：获取会话密码（用于编辑弹窗按需显示）

---

## 2.2 终端连接与 I/O

### `connect_session`

- 入参：
  - `id: string`
  - `secret?: string`
- 返回：`void`
- 说明：按会话协议建立连接并写入活跃会话表

### `disconnect_session`

- 入参：`id: string`
- 返回：`void`
- 说明：断开会话连接

### `send_input`

- 入参：
  - `id: string`
  - `input: string`
- 返回：`void`
- 说明：向远端发送输入

### `pull_output`

- 入参：`id: string`
- 返回：`string | null`（Base64 编码）
- 说明：拉取终端输出数据；空输出返回 `null`

### `resize_terminal`

- 入参：
  - `id: string`
  - `cols: u16`
  - `rows: u16`
- 返回：`void`
- 说明：同步终端尺寸到远端 PTY

---

## 2.3 SFTP

### `list_sftp_dir`

- 入参：
  - `id: string`
  - `path?: string`
- 返回：`SftpEntry[]`
- 说明：读取目录内容并按目录优先排序

### `download_sftp_file`

- 入参：
  - `id: string`
  - `remote_path: string`
- 返回：`string`（本地文件绝对路径）
- 说明：将远程文件下载到本地下载目录 `rshell` 子目录

---

## 2.4 监控与工具

### `test_host_reachability`

- 入参：
  - `host: string`
  - `port: u16`
  - `timeout_ms?: u64`（100~10000，默认 2000）
  - `protocol?: string`（`ssh` / `telnet`；SSH 时在 TCP 连通后还会校验是否收到 `SSH-` 协议横幅，不执行登录认证）
- 返回：`boolean`
- 说明：并行执行 ICMP ping 与 TCP/协议探测（SSH 横幅等），**任一为真**则返回 `true`；用于刷新按钮与主机列表状态

### `get_host_metrics`

- 入参：`id: string`
- 返回：`HostMetrics`
- 说明：通过 SSH 采集 CPU/内存/磁盘指标

### `open_in_file_manager`

- 入参：`path: string`
- 返回：`void`
- 说明：在系统文件管理器中定位本地文件

---

## 3. Events

## 3.1 `terminal-output`

- 载荷：
  - `sessionId: string`
  - `data: string`（Base64）
- 说明：后端向前端推送终端输出数据

## 3.2 `debug-log`

- 载荷：
  - `sessionId: string`
  - `stage: string`
  - `message: string`
- 说明：用于调试链路定位（连接、输入、输出、SFTP、监控等）

---

## 4. 类型定义（前端）

定义文件：`ui/src/services/types.ts`

- `Protocol = "ssh" | "telnet"`
- `Session`
- `SessionInput`
- `SftpEntry`
- `HostMetrics`

---

## 5. 错误处理建议

- 对 `invoke` 调用统一封装错误提示，避免 UI 层重复 `try/catch` 样板代码。
- 对可重试错误（如偶发握手失败）优先在后端做重试，前端只展示最终状态。
- 将用户提示与底层错误解耦，保留详细错误到 debug 面板。
