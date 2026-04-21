use base64::Engine;
use java_serialization::{
    parse_serialization_stream, AnnotationElement, ClassData, ContentElement, FieldValue, SerializationStream,
    StreamObject,
};

use super::types::RedisKeyRef;

pub fn encode_key_ref(key: &[u8]) -> RedisKeyRef {
    let key_utf8 = best_effort_utf8(key);
    let key_base64 = base64::engine::general_purpose::STANDARD.encode(key);
    RedisKeyRef { key_base64, key_utf8 }
}

pub fn best_effort_utf8(bytes: &[u8]) -> Option<String> {
    if let Some(decoded) = try_decode_java_serialized(bytes) {
        return Some(decoded);
    }
    if let Ok(s) = String::from_utf8(bytes.to_vec()) {
        return Some(s);
    }
    Some(String::from_utf8_lossy(bytes).to_string())
}

pub fn display_bytes(bytes: &[u8]) -> String {
    best_effort_utf8(bytes).unwrap_or_default()
}

fn is_java_serialized(bytes: &[u8]) -> bool {
    bytes.len() >= 4 && bytes[0] == 0xAC && bytes[1] == 0xED && bytes[2] == 0x00 && bytes[3] == 0x05
}

fn try_decode_java_serialized(bytes: &[u8]) -> Option<String> {
    if !is_java_serialized(bytes) {
        return None;
    }
    let (_, stream) = parse_serialization_stream(bytes).ok()?;
    let text = summarize_java_stream(&stream);
    if text.trim().is_empty() {
        Some(format!("{stream:?}"))
    } else {
        Some(text)
    }
}

fn summarize_java_stream(stream: &SerializationStream) -> String {
    let mut out: Vec<String> = Vec::new();
    for item in &stream.contents {
        collect_content_strings(item, &mut out);
    }
    out.join(" | ")
}

fn collect_content_strings(content: &ContentElement, out: &mut Vec<String>) {
    match content {
        ContentElement::Object(obj) => collect_stream_object_strings(obj, out),
        ContentElement::BlockData(data) => {
            if let Ok(s) = String::from_utf8(data.data().to_vec()) {
                if !s.trim().is_empty() {
                    out.push(s);
                }
            }
        }
    }
}

fn collect_stream_object_strings(obj: &StreamObject, out: &mut Vec<String>) {
    match obj {
        StreamObject::NewString(s) => out.push(s.value.clone()),
        StreamObject::NewEnum(e) => out.push(e.constant_name.value.clone()),
        StreamObject::NewObject(o) => {
            if let Some(name) = o.class_name() {
                out.push(format!("<{}>", name));
            }
            for class_data in &o.class_data {
                collect_class_data_strings(class_data, out);
            }
        }
        StreamObject::NewArray(a) => {
            if let Some(name) = a.class_name() {
                out.push(format!("<{}>", name));
            }
            match &a.values {
                java_serialization::ArrayValues::Object(items) => {
                    for item in items.iter().flatten() {
                        collect_stream_object_strings(item, out);
                    }
                }
                java_serialization::ArrayValues::Byte(items) => {
                    let bytes: Vec<u8> = items.iter().map(|b| *b as u8).collect();
                    if let Ok(s) = String::from_utf8(bytes) {
                        if !s.trim().is_empty() {
                            out.push(s);
                        }
                    }
                }
                _ => {}
            }
        }
        _ => {}
    }
}

fn collect_class_data_strings(class_data: &ClassData, out: &mut Vec<String>) {
    match class_data {
        ClassData::NoWriteMethod(values) | ClassData::WriteMethodWithFields(values, _) => {
            for value in &values.values {
                collect_field_value_strings(value, out);
            }
        }
        ClassData::WriteMethod(annotation) | ClassData::ExternalBlockData(annotation) => {
            for item in &annotation.contents {
                collect_annotation_strings(item, out);
            }
        }
        ClassData::ExternalContents(bytes) => {
            if let Ok(s) = String::from_utf8(bytes.clone()) {
                if !s.trim().is_empty() {
                    out.push(s);
                }
            }
        }
    }
}

fn collect_annotation_strings(item: &AnnotationElement, out: &mut Vec<String>) {
    match item {
        AnnotationElement::Object(obj) => collect_stream_object_strings(obj, out),
        AnnotationElement::BlockData(data) => {
            if let Ok(s) = String::from_utf8(data.data().to_vec()) {
                if !s.trim().is_empty() {
                    out.push(s);
                }
            }
        }
    }
}

fn collect_field_value_strings(value: &FieldValue, out: &mut Vec<String>) {
    match value {
        FieldValue::Object(Some(obj)) => collect_stream_object_strings(obj, out),
        FieldValue::Byte(v) => out.push(v.to_string()),
        FieldValue::Char(v) => {
            if let Some(c) = char::from_u32(*v as u32) {
                out.push(c.to_string());
            }
        }
        FieldValue::Double(v) => out.push(v.to_string()),
        FieldValue::Float(v) => out.push(v.to_string()),
        FieldValue::Int(v) => out.push(v.to_string()),
        FieldValue::Long(v) => out.push(v.to_string()),
        FieldValue::Short(v) => out.push(v.to_string()),
        FieldValue::Boolean(v) => out.push(v.to_string()),
        FieldValue::Object(None) => {}
    }
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
