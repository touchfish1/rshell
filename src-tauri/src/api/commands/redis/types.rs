use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
pub struct RedisValueData {
    pub key_base64: String,
    pub value: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RedisScanResult {
    pub next_cursor: u64,
    pub keys: Vec<RedisKeyRef>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RedisDatabaseInfo {
    pub db: u32,
    pub key_count: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct RedisKeyRef {
    pub key_base64: String,
    pub key_utf8: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedisHashEntry {
    pub field: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedisZsetEntry {
    pub member: String,
    pub score: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum RedisValuePayload {
    String { value: Option<String> },
    Hash { entries: Vec<RedisHashEntry> },
    List { items: Vec<String> },
    Set { members: Vec<String> },
    Zset { entries: Vec<RedisZsetEntry> },
    Unsupported { raw_type: String },
}

#[derive(Debug, Clone, Serialize)]
pub struct RedisKeyData {
    pub key_base64: String,
    pub key_utf8: Option<String>,
    pub key_type: String,
    pub ttl_seconds: i64,
    pub payload: RedisValuePayload,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum RedisValueUpdate {
    String { value: String },
    Hash { entries: Vec<RedisHashEntry> },
    List { items: Vec<String> },
    Set { members: Vec<String> },
    Zset { entries: Vec<RedisZsetEntry> },
}
