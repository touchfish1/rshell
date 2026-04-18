//! 错误类型到 `String` 的转换，供 Tauri 命令统一返回 `Result<_, String>`。

use crate::app::state::AppState;
use crate::domain::terminal::TerminalError;
use crate::infra::store::StoreError;

impl From<TerminalError> for String {
    fn from(value: TerminalError) -> Self {
        value.to_string()
    }
}

impl From<StoreError> for String {
    fn from(value: StoreError) -> Self {
        value.to_string()
    }
}

// 保留模块引用，避免拆分后本文件被误判为未使用。
#[allow(dead_code)]
fn _keep() -> Option<AppState> {
    None
}
