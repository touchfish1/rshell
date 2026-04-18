//! 领域模型与协议抽象，与 UI 无关；被 `app` 与 `infra` 共同依赖。

pub mod audit;
pub mod session;
pub mod terminal;
