//! 审计入库前对命令行做脱敏与截断，避免密钥类参数进入明文审计。

use regex::{Captures, Regex};

pub fn normalize_command_for_audit(input: &str) -> String {
    let mut cmd = sanitize_command(input.trim());
    if cmd.len() > 240 {
        cmd.truncate(240);
        cmd.push_str("...");
    }
    cmd
}

fn is_sensitive_key(key: &str) -> bool {
    let lower = key.to_ascii_lowercase();
    lower.contains("password")
        || lower.contains("passwd")
        || lower.contains("pwd")
        || lower.contains("token")
        || lower.contains("secret")
        || lower.contains("apikey")
        || lower.contains("api_key")
        || lower.contains("access_key")
}

fn is_sensitive_flag(token: &str) -> bool {
    let lower = token.to_ascii_lowercase();
    matches!(
        lower.as_str(),
        "-p" | "--p" | "--pw" | "--pwd" | "--password" | "--passwd" | "--token" | "--secret" | "--apikey"
            | "--api-key"
    )
}

fn sanitize_token(token: &str) -> String {
    if let Some((k, _)) = token.split_once('=') {
        if is_sensitive_key(k) {
            return format!("{k}=***");
        }
    }
    token.to_string()
}

fn sanitize_command(command: &str) -> String {
    let mut out = Vec::new();
    let mut next_mask = false;
    for raw in command.split_whitespace() {
        if next_mask {
            out.push("***".to_string());
            next_mask = false;
            continue;
        }
        if is_sensitive_flag(raw) {
            out.push(raw.to_string());
            next_mask = true;
            continue;
        }
        out.push(sanitize_token(raw));
    }
    let masked = if out.is_empty() {
        command.to_string()
    } else {
        out.join(" ")
    };
    sanitize_payload_pairs(&masked)
}

fn sanitize_payload_pairs(input: &str) -> String {
    let key_value_re = Regex::new(
        r#"(?i)\b(password|passwd|pwd|token|secret|api[_-]?key|access[_-]?key)\b\s*=\s*([^\s&"',}]+|"[^"]*"|'[^']*')"#,
    )
    .expect("valid key=value masking regex");
    let pass1 = key_value_re.replace_all(input, |caps: &Captures| format!("{}=***", &caps[1]));

    let json_pair_re = Regex::new(
        r#"(?i)(["']?(password|passwd|pwd|token|secret|api[_-]?key|access[_-]?key)["']?\s*:\s*)("[^"]*"|'[^']*'|[^\s,}\]]+)"#,
    )
    .expect("valid json-like masking regex");
    json_pair_re
        .replace_all(&pass1, |caps: &Captures| format!("{}\"***\"", &caps[1]))
        .to_string()
}
