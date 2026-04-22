//! `AppState` 上与 Redis 连接列表、密钥持久化以及基础 key/value 操作相关的实现。

mod client;
mod connections;
mod decode;
mod keys;
mod values;
