use crate::app::state::AuditInputState;

pub struct AuditInputEvents {
    pub commands: Vec<String>,
    pub control_events: Vec<String>,
}

pub fn collect_audit_input_events(state: &mut AuditInputState, input: &str) -> AuditInputEvents {
    let mut commands = Vec::new();
    let mut control_events = Vec::new();

    for ch in input.chars() {
        if state.esc_pending {
            if state.csi_pending {
                if ('@'..='~').contains(&ch) {
                    state.esc_pending = false;
                    state.csi_pending = false;
                }
                continue;
            }
            if ch == '[' {
                state.csi_pending = true;
                continue;
            }
            state.esc_pending = false;
            continue;
        }

        match ch {
            '\u{0003}' => {
                control_events.push("Ctrl+C".to_string());
            }
            '\u{0004}' => {
                control_events.push("Ctrl+D".to_string());
            }
            '\u{000c}' => {
                control_events.push("Ctrl+L".to_string());
            }
            '\u{001b}' => {
                state.esc_pending = true;
            }
            '\r' | '\n' => {
                let cmd = state.buffer.trim();
                if !cmd.is_empty() {
                    commands.push(cmd.to_string());
                }
                state.buffer.clear();
            }
            '\u{0008}' | '\u{007f}' => {
                state.buffer.pop();
            }
            '\t' => {}
            _ => {
                if !ch.is_control() {
                    state.buffer.push(ch);
                }
            }
        }
    }

    AuditInputEvents {
        commands,
        control_events,
    }
}
