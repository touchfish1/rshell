use base64::Engine;

use super::types::RedisKeyRef;

pub fn encode_key_ref(key: &[u8]) -> RedisKeyRef {
    let key_utf8 = best_effort_utf8(key);
    let key_base64 = base64::engine::general_purpose::STANDARD.encode(key);
    RedisKeyRef { key_base64, key_utf8 }
}

pub fn best_effort_utf8(bytes: &[u8]) -> Option<String> {
    if let Ok(s) = String::from_utf8(bytes.to_vec()) {
        return Some(s);
    }
    Some(String::from_utf8_lossy(bytes).to_string())
}

pub fn display_bytes(bytes: &[u8]) -> String {
    best_effort_utf8(bytes).unwrap_or_default()
}

pub fn decode_display(value: &str) -> Result<Vec<u8>, String> {
    let s = value.trim();
    if let Some(rest) = s.strip_prefix("b64:") {
        return base64::engine::general_purpose::STANDARD
            .decode(rest.trim())
            .map_err(|e| format!("invalid base64: {e}"));
    }
    Ok(s.as_bytes().to_vec())
}

pub fn decode_key_base64(key_base64: &str) -> Result<Vec<u8>, String> {
    base64::engine::general_purpose::STANDARD
        .decode(key_base64.trim())
        .map_err(|e| format!("invalid key_base64: {e}"))
}
