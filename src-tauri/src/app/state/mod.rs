mod metrics;
mod sessions;
mod sftp;
mod audit;
mod ssh_helpers;
mod terminal_io;
mod convert;
pub use self::sftp::SftpTextReadResult;

use std::collections::HashMap;
use std::sync::Arc;

use tokio::sync::Mutex;
use uuid::Uuid;

use crate::domain::session::Session;
use crate::domain::terminal::TerminalClient;
use crate::infra::store::SessionStore;

#[derive(Default)]
pub(crate) struct AuditInputState {
    pub buffer: String,
    pub esc_pending: bool,
    pub csi_pending: bool,
}

pub struct ActiveTerminal {
    pub client: Mutex<Box<dyn TerminalClient>>,
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

pub struct AppState {
    store: SessionStore,
    sessions: Arc<Mutex<Vec<Session>>>,
    active: Arc<Mutex<HashMap<Uuid, Arc<ActiveTerminal>>>>,
    audit_input_buffers: Arc<Mutex<HashMap<Uuid, AuditInputState>>>,
}

impl Default for AppState {
    fn default() -> Self {
        let store = SessionStore::new().expect("failed to init session store");
        let sessions = store.list().unwrap_or_default();
        Self {
            store,
            sessions: Arc::new(Mutex::new(sessions)),
            active: Arc::new(Mutex::new(HashMap::new())),
            audit_input_buffers: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

