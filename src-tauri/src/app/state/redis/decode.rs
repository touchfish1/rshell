use java_serialization::{parse_serialization_stream, ContentElement, StreamObject};

use crate::app::state::AppState;

impl AppState {
    pub(super) fn decode_redis_text(bytes: Vec<u8>) -> String {
        if let Some(decoded) = Self::try_decode_java_serialized(&bytes) {
            return decoded;
        }
        String::from_utf8(bytes)
            .unwrap_or_else(|e| String::from_utf8_lossy(&e.into_bytes()).to_string())
    }

    fn try_decode_java_serialized(bytes: &[u8]) -> Option<String> {
        if bytes.len() < 4 || bytes[0] != 0xAC || bytes[1] != 0xED || bytes[2] != 0x00 || bytes[3] != 0x05 {
            return None;
        }
        let (_, stream) = parse_serialization_stream(bytes).ok()?;
        let mut parts = Vec::new();
        for item in &stream.contents {
            if let ContentElement::Object(obj) = item {
                Self::collect_java_strings(obj, &mut parts);
            }
        }
        let joined = parts.join(" | ");
        if joined.trim().is_empty() {
            Some(format!("{stream:?}"))
        } else {
            Some(joined)
        }
    }

    fn collect_java_strings(obj: &StreamObject, parts: &mut Vec<String>) {
        match obj {
            StreamObject::NewString(s) => parts.push(s.value.clone()),
            StreamObject::NewEnum(e) => parts.push(e.constant_name.value.clone()),
            StreamObject::NewObject(o) => {
                if let Some(name) = o.class_name() {
                    parts.push(format!("<{}>", name));
                }
            }
            _ => {}
        }
    }
}
