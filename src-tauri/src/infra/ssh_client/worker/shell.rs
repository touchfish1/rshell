use ssh2::Session as Ssh2Session;
use tokio::sync::mpsc;

pub(super) fn open_shell_channel(
    ssh: &Ssh2Session,
    output_tx: &mpsc::UnboundedSender<Vec<u8>>,
) -> Option<ssh2::Channel> {
    let mut channel = match ssh.channel_session() {
        Ok(c) => c,
        Err(e) => {
            let _ = output_tx.send(format!("\r\n[ssh] open channel failed: {e}\r\n").into_bytes());
            return None;
        }
    };
    if let Err(e) = channel.request_pty("xterm", None, Some((120, 40, 0, 0))) {
        let _ = output_tx.send(format!("\r\n[ssh] request pty failed: {e}\r\n").into_bytes());
        return None;
    }
    if let Err(e) = channel.shell() {
        let _ = output_tx.send(format!("\r\n[ssh] request shell failed: {e}\r\n").into_bytes());
        return None;
    }
    Some(channel)
}
