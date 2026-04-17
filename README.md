# rshell

`rshell` 是一个用 Rust 编写的桌面 SSH/Telnet 客户端（Tauri + React + xterm.js）。

当前版本重点是先打通 Linux 远程交互能力，支持会话管理、密码安全保存、基础调试日志与终端输入输出。

## 主要功能

- SSH 连接（用户名 + 密码）
- Telnet 连接（基础支持）
- 会话保存（主机、端口、用户名等）
- 密码保存到系统凭据管理器（Keyring，不明文落盘）
- 左侧会话列表删除
- 终端实时输入输出
- `Tab` 键透传给远端（用于 shell 自动补全）
- 内置 Debug Logs 面板（便于定位收发与连接问题）

## 技术栈

- Backend: Rust + Tauri + ssh2/libssh2
- Frontend: React + TypeScript + Vite + xterm.js
- Secret storage: keyring

## 目录结构

- `src/`：Rust 主程序与核心逻辑
  - `src/api/commands.rs`：Tauri 命令入口
  - `src/app/mod.rs`：应用状态与会话/连接管理
  - `src/infra/ssh_client.rs`：SSH 客户端实现
  - `src/infra/telnet_client.rs`：Telnet 客户端实现
  - `src/infra/store.rs`：会话与凭据存储
- `ui/`：前端工程（React + Vite）

## 环境要求

- Windows 10/11（当前主要验证环境）
- Rust stable
- Node.js 18+
- npm

## 安装依赖

在项目根目录执行：

```bash
cargo check
cd ui
npm install
```

## 开发运行

推荐两个终端分别运行：

终端 1（前端）：

```bash
cd ui
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

终端 2（桌面端）：

```bash
cargo run
```

## 使用说明

1. 左侧填写会话信息（Host/Port/Username/Password）
2. 点击 `Add Session` 保存会话
3. 选中会话后点击 `Connect`
4. 在终端输入命令并回车执行
5. 使用 `Tab` 可以触发远端补全
6. `Disconnect` 断开会话
7. 点击会话右侧 `✕` 删除会话

## 调试与排错

如果遇到“连接成功但无输出/输入慢/偶发断开”等问题：

- 观察界面中的 `Debug Logs` 面板
- 检查终端中的 `[ssh] ...` 提示
- 常见提示：
  - `auth failed`：用户名或密码错误
  - `handshake failed`：SSH 握手失败（算法/链路问题）
  - `transport read`：网络抖动或远端主动中断
  - `sending on a closed channel`：会话通道已关闭（当前版本含自动重连恢复逻辑）

## 当前限制

- 仅支持用户名+密码认证（暂未支持私钥登录）
- 尚未实现 SFTP/端口转发/多标签会话管理
- 仍在持续优化 SSH 长连接稳定性与高频交互延迟

## 后续计划

- 私钥认证（含 passphrase）
- 连接重试策略可配置
- 会话编辑 UI
- 日志导出与问题诊断包
