# rshell

`rshell` 是一个基于 **Tauri 2 + Rust + React + xterm.js** 的跨平台桌面远程终端工具，目标是提供：

- 快速的 SSH/Telnet 会话管理
- 类标签页终端体验（支持同主机多会话）
- 集成 SFTP 文件浏览/下载
- 主机状态与资源指标可视化

---

## 当前能力概览

### v0.1.31 升级

- 首页连接列表进一步统一：MySQL 与 SSH/Telnet、Zookeeper、Redis 一起在同一列表管理（连接/编辑/删除/搜索）
- 首页新增连接弹窗支持 MySQL 协议（默认端口 3306），支持新增后直接进入 MySQL 页面
- MySQL 页面增强：支持表结构编辑（字段、索引、表备注），支持索引字段多选与顺序调整
- MySQL 交互优化：数据分页、页码跳转、当前执行 SQL 一键复制、表结构编辑字段/索引分 tab 展示
- 主题与样式完善：MySQL 页面补齐日间模式，筛选/分页/编辑区样式统一，顶栏与操作按钮尺寸一致

### 终端能力

- SSH（用户名 + 密码）与 Telnet 基础连接
- 多标签页会话管理（可复制标签、批量关闭左右/其他）
- 左侧主机单击选中、双击新建标签
- xterm.js 终端自适应与激活重同步（降低切换错位）
- 输出编码兼容（UTF-8/GBK 等）

### 文件与运维能力

- SFTP 目录浏览（目录/文件图标、上级导航）
- 右键下载文件到本地下载目录下的 `rshell` 子目录
- 下载成功后一键打开文件所在目录
- 右侧主机监控（CPU/内存/磁盘，支持自动轮询与手动刷新）

### 主机管理能力

- 主机会话新增、编辑、删除
- 新增/编辑时可测试可达性
- 首页自动探测主机在线状态（启动即探测 + 周期探测）
- 支持获取已保存密码并在编辑界面按需显示
- Redis / Zookeeper / MySQL 连接支持在首页统一管理（连接/编辑/删除）

### 数据与中间件能力

- Zookeeper：连接管理、节点树浏览、节点数据读取与保存
- Redis：连接管理、Key 搜索与类型识别、string/hash/list/set/zset 读写、TTL 编辑、DB 切换
- JDK 序列化数据：自动识别并解析为可读文本（解析失败时回退结构化摘要）

### 审计能力

- 终端会话审计：连接/断开/命令/控制键
- Zookeeper 审计：连接、断开、节点列表、节点读写
- Redis 审计：连接、断开、Key 扫描、数据读写、TTL 变更
- 审计页面支持筛选、导出（CSV/JSON）和统计报表视图

---

## 文档导航

- 用户文档：`docs/USER_GUIDE.md`
- 架构设计：`docs/ARCHITECTURE.md`
- 开发与发布：`docs/DEVELOPMENT.md`
- API 参考：`docs/API_REFERENCE.md`

---

## 技术栈

- **Backend**: Rust 2021, Tauri 2, ssh2/libssh2, tokio, serde, uuid
- **Frontend**: React 18, TypeScript, Vite 5, xterm.js
- **Desktop Bridge**: `@tauri-apps/api`

---

## 快速开始

### 1) 环境准备

- Rust stable（建议最新稳定版）
- Node.js 18+（推荐 Node 20 LTS）
- npm
- Windows 10/11（当前主要验证环境）
- macOS / Linux 可构建（发布流程已覆盖）

### 2) 安装依赖

在仓库根目录：

```bash
npm install
npm --prefix src-tauri/ui install
cargo check
```

### 3) 本地开发

推荐直接在仓库根目录启动（会自动拉起前端 + 桌面端）：

```bash
npm run dev:tauri
```

如需分开调试，可用双终端：

终端 A（前端热更新）：

```bash
npm --prefix src-tauri/ui run dev
```

终端 B（桌面应用）：

```bash
cargo run
```

如需单独启动前端构建脚本（走根目录 npm scripts）：

```bash
npm run dev:ui
```

---

## 配置与数据文件

`rshell` 会将配置写入系统配置目录下 `rshell` 文件夹（由 `dirs::config_dir()` 决定）：

- `sessions.json`：会话配置（主机、端口、用户名、编码等）
- `secrets.json`：会话密码映射

> 安全提示：当前密码存储实现为本地配置文件（`secrets.json`）。如果你在生产环境或敏感场景使用，建议后续切换到系统凭据管理器（如 Windows Credential Manager / macOS Keychain / Secret Service）。

下载文件默认目录：

- `<系统下载目录>/rshell`

---

## 常见问题（简版）

### 1) `SFTP 列表读取失败: handshake failed ... Unable to exchange encryption keys`

已在后端加入 SSH 握手重试机制（短退避重试）。若仍持续出现：

- 检查目标主机 SSH 算法策略（是否禁用常见 kex/cipher）
- 检查中间网络设备（堡垒机/防火墙）是否会中断短连接
- 使用同主机执行普通 SSH 终端连接比对是否稳定

### 2) `inactive session`

这通常发生在标签页关闭和输出轮询时间点重叠的瞬间，前端已做忽略处理；如仍频繁出现，建议采集 `debug-log` 事件并反馈复现步骤。

### 3) 中文乱码

在主机配置中设置正确编码（例如 `utf-8` 或 `gbk`），终端侧会按会话编码解码输出。

---

## 路线图（建议）

- SSH 私钥认证（含 passphrase）
- 秘钥安全存储升级（替换明文 secrets 文件）
- SFTP 上传/重命名/删除
- 主机监控趋势图与告警阈值
- 首次使用引导（首页与终端页）

---

## License

当前仓库未显式声明 License 文件，请在对外分发前补充 `LICENSE`。
