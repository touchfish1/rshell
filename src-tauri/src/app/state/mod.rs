//! 全局 `AppState`：会话内存镜像、活跃终端表、审计输入缓冲等。
//!
//! 子模块按职责拆分：`sessions` / `terminal_io` / `sftp` / `metrics` / `audit` 等。

mod audit;
mod audit_parse;
mod convert;
mod metrics;
mod sessions;
mod sftp;
mod ssh_helpers;
mod terminal_io;
mod redis;
mod zookeeper;
pub use self::sftp::SftpTextReadResult;

use std::collections::HashMap;
use std::sync::Arc;

use tokio::sync::Mutex;
use uuid::Uuid;

use crate::domain::session::Session;
use crate::domain::terminal::TerminalClient;
use crate::domain::redis::RedisConnection;
use crate::domain::zookeeper::ZookeeperConnection;
use crate::infra::store::SessionStore;

/// 审计用：按会话缓冲终端输入，用于解析控制序列、归并命令行。
#[derive(Default)]
pub(crate) struct AuditInputState {
    pub buffer: String,
    pub esc_pending: bool,
    pub csi_pending: bool,
}

/// 已连接会话在内存中的句柄，内层为异步 `TerminalClient`。
pub struct ActiveTerminal {
    pub client: Mutex<Box<dyn TerminalClient>>,
}

/// 已连接的 Zookeeper 客户端（复用会话，减少反复握手）。
pub struct ActiveZookeeper {
    pub client: zookeeper_client::Client,
}

/// 已连接的 Redis 客户端（复用配置，按需获取连接）。
pub struct ActiveRedis {
    pub client: ::redis::Client,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct SftpEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub mtime: u64,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct HostMetrics {
    pub cpu_percent: f64,
    pub memory_used_bytes: u64,
    pub memory_total_bytes: u64,
    pub memory_percent: f64,
    pub disk_used_bytes: u64,
    pub disk_total_bytes: u64,
    pub disk_percent: f64,
}

/// 应用全局状态（由 Tauri `manage` 注入，所有 command 共享）。
pub struct AppState {
    /// 本地 `sessions.json` / `secrets.json` / `audit.json` 访问
    store: SessionStore,
    /// 当前内存中的会话列表（与磁盘同步）
    sessions: Arc<Mutex<Vec<Session>>>,
    /// Zookeeper 连接列表（与磁盘同步）
    zookeeper_connections: Arc<Mutex<Vec<ZookeeperConnection>>>,
    /// Redis 连接列表（与磁盘同步）
    redis_connections: Arc<Mutex<Vec<RedisConnection>>>,
    /// 已建立终端连接：`session_id ->` 活跃客户端
    active: Arc<Mutex<HashMap<Uuid, Arc<ActiveTerminal>>>>,
    /// 已建立 Zookeeper 连接：`conn_id ->` 活跃客户端
    active_zookeeper: Arc<Mutex<HashMap<Uuid, Arc<ActiveZookeeper>>>>,
    /// 已建立 Redis 连接：`conn_id ->` 活跃客户端
    active_redis: Arc<Mutex<HashMap<Uuid, Arc<ActiveRedis>>>>,
    /// 审计：每个会话的输入解析状态
    audit_input_buffers: Arc<Mutex<HashMap<Uuid, AuditInputState>>>,
}

impl Default for AppState {
    fn default() -> Self {
        let store = SessionStore::new().expect("failed to init session store");
        let sessions = store.list().unwrap_or_default();
        let zookeeper_connections = store.list_zk().unwrap_or_default();
        let redis_connections = store.list_redis().unwrap_or_default();
        Self {
            store,
            sessions: Arc::new(Mutex::new(sessions)),
            zookeeper_connections: Arc::new(Mutex::new(zookeeper_connections)),
            redis_connections: Arc::new(Mutex::new(redis_connections)),
            active: Arc::new(Mutex::new(HashMap::new())),
            active_zookeeper: Arc::new(Mutex::new(HashMap::new())),
            active_redis: Arc::new(Mutex::new(HashMap::new())),
            audit_input_buffers: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}
