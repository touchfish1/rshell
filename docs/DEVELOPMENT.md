# rshell 开发与发布文档

本文件面向开发者，说明本地开发、调试、测试、发布与维护规范。

## 1. 运行环境

## 1.1 必需依赖

- Rust stable
- Node.js 18+（建议 20 LTS）
- npm

## 1.2 平台依赖

Windows 一般无需额外系统包。  
Linux 构建 Tauri 需要 GTK/WebKit 相关依赖（参考 `.github/workflows/release.yml`）。

## 2. 项目结构

```text
rshell/
  src-tauri/               # Tauri backend root
    src/                   # Rust backend
    api/commands.rs        # Tauri command 层
    app/mod.rs             # 业务核心状态机
    infra/store.rs         # 配置与密码存储
    infra/ssh_client.rs    # SSH terminal client
    infra/telnet_client.rs # Telnet client
    tauri.conf.json        # Tauri config
    capabilities/          # Tauri capabilities
    ui/                    # React frontend
    src/App.tsx            # 前端状态与页面总入口
    src/pages/HomePage.tsx
    src/pages/TerminalPage.tsx
    src/components/TerminalPane.tsx
    src/services/bridge.ts # invoke/event bridge
  docs/                    # 项目文档
```

## 3. 本地开发流程

## 3.1 安装依赖

```bash
cd src-tauri
cargo check
cd ui
npm install
```

## 3.2 启动开发

推荐双终端：

终端 1（前端）：

```bash
cd src-tauri/ui
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

终端 2（桌面）：

```bash
npx @tauri-apps/cli@2 dev
```

## 3.3 常用检查命令

```bash
cd src-tauri && cargo check && cargo test
cd src-tauri/ui && npm run build
```

建议在提交前至少执行：

- `cd src-tauri && cargo check`
- `cd src-tauri/ui && npm run build`

## 4. 调试指南

## 4.1 后端日志

`src-tauri/src/api/commands.rs` 使用 `emit_debug` 发送结构化日志：

- 终端输出拉取
- 输入发送
- 尺寸变更
- SFTP 操作
- 监控采集

日志渠道：

- `stderr`（开发终端可见）
- Tauri 事件 `debug-log`（前端可订阅）

## 4.2 常见问题定位

### SFTP 握手失败

定位步骤：

1. 查看错误是否包含 `Unable to exchange encryption keys`
2. 使用同目标手工 SSH 验证
3. 检查服务端 `sshd_config` 的 `KexAlgorithms/Ciphers`
4. 检查网络设备（跳板、WAF、ACL）

### 终端乱码

确认：

- 会话 `encoding` 是否与服务器输出一致
- 前端是否按该编码解码（`src-tauri/ui/src/App.tsx`）

### inactive session

通常由标签关闭与拉取输出并发造成。定位时关注：

- 关闭动作时间点
- `pull_output` 调用是否已停止

## 5. 后端命令契约

主要命令与用途：

- `list_sessions`: 获取全部会话
- `create_session` / `update_session` / `delete_session`: 会话 CRUD
- `connect_session` / `disconnect_session`: 建连与断开
- `send_input` / `pull_output` / `resize_terminal`: 终端数据流
- `list_sftp_dir` / `download_sftp_file`: 文件浏览与下载
- `test_host_reachability`: TCP 可达性测试
- `get_host_metrics`: 主机指标采集
- `open_in_file_manager`: 打开本地文件所在目录
- `get_session_secret`: 获取密码（用于编辑界面按需显示）

## 6. 数据持久化与安全

配置目录（由 `dirs::config_dir()` 推导）：

- `sessions.json`
- `secrets.json`

当前密码为明文存储。请在安全要求较高场景优先推进：

- 系统密钥链改造，或
- 本地加密方案（主密码 + KDF）

## 7. 前端开发约定

- 页面层仅做 UI 与编排，不直接调用 `invoke`
- 所有后端调用统一经 `src-tauri/ui/src/services/bridge.ts`
- 类型统一定义在 `src-tauri/ui/src/services/types.ts`
- 涉及 xterm.js 的尺寸问题优先在 `TerminalPane` 处理

## 8. 发布流程

仓库已包含 GitHub Actions 发布工作流：`.github/workflows/release.yml`

触发方式：

- 推送标签：`v*`（如 `v0.1.0`）
- 手动触发：`workflow_dispatch` 并输入 tag

流程摘要：

1. 在 Linux/Windows/macOS 构建
2. 使用 `tauri-apps/tauri-action` 生成安装包并附加到 Release
3. 额外打包 ZIP 资产并上传

**Windows 产物说明**：`src-tauri/tauri.windows.conf.json` 与主配置合并后，Windows 上仅打 **NSIS（`*-setup.exe`）** 与 **MSI**，不再打便携版 `app` 目录。发布工作流里的 **`rshell-windows-x64.zip` 内只放入该 `*-setup.exe`**，用户解压后运行安装程序即可，与单独下载 setup 等价；面向更新器的 **`*.nsis.zip`** 仍为签名包，用途不同。

## 9. 建议的提交检查清单

- 功能是否覆盖异常路径（失败提示、空态、禁用态）
- `cargo check` 是否通过
- 前端构建是否通过
- 文档是否同步（README + docs）
- 高风险变更是否附带最小复现步骤

## 10. 后续工程化建议

- 增加 Rust 集成测试（模拟 SSH 服务端）
- 增加前端交互 E2E（标签/下载/监控）
- 引入统一错误码与用户提示映射
- 建立 CHANGELOG 与版本迁移说明
