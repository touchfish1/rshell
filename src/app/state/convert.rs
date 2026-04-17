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

// keep module referenced so the file isn't "dead" after splits
#[allow(dead_code)]
fn _keep() -> Option<AppState> {
    None
}

