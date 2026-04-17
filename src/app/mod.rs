mod state;

pub use state::{AppState, HostMetrics, SftpEntry, SftpTextReadResult};

#[cfg(test)]
mod state_tests;
