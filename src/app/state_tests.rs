#[cfg(test)]
mod tests {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    use crate::app::AppState;
    use crate::domain::session::{Protocol, SessionInput};

    async fn spawn_echo_server() -> u16 {
        let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind echo server");
        let port = listener.local_addr().expect("read local addr").port();
        tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.expect("accept client");
            let mut buf = [0_u8; 1024];
            let n = socket.read(&mut buf).await.expect("read payload");
            socket.write_all(&buf[..n]).await.expect("echo payload");
        });
        port
    }

    async fn assert_session_roundtrip(protocol: Protocol, port: u16, payload: &str) {
        let state = AppState::default();
        let session = state
            .create_session(
                SessionInput {
                    name: format!("{protocol:?}-test"),
                    protocol,
                    host: "127.0.0.1".to_string(),
                    port,
                    username: "tester".to_string(),
                    encoding: Some("utf-8".to_string()),
                    keepalive_secs: Some(30),
                },
                None,
            )
            .await
            .expect("create session");

        state
            .connect_session(session.id, None)
            .await
            .expect("connect session");
        state
            .send_input(session.id, payload.to_string())
            .await
            .expect("send payload");
        let output = state.poll_output(session.id).await.expect("poll output");
        assert_eq!(String::from_utf8_lossy(&output), payload);
        state
            .disconnect_session(session.id)
            .await
            .expect("disconnect session");
        state
            .delete_session(session.id)
            .await
            .expect("cleanup session");
    }

    #[tokio::test]
    async fn telnet_session_create_and_io_roundtrip() {
        let port = spawn_echo_server().await;
        assert_session_roundtrip(Protocol::Telnet, port, "telnet-ping").await;
    }

    #[tokio::test]
    async fn ssh_session_without_secret_fails() {
        let state = AppState::default();
        let session = state
            .create_session(
                SessionInput {
                    name: "ssh-test".to_string(),
                    protocol: Protocol::Ssh,
                    host: "127.0.0.1".to_string(),
                    port: 22,
                    username: "tester".to_string(),
                    encoding: Some("utf-8".to_string()),
                    keepalive_secs: Some(30),
                },
                None,
            )
            .await
            .expect("create session");

        let err = state
            .connect_session(session.id, None)
            .await
            .expect_err("connect should fail without secret");
        assert!(err.contains("missing SSH password"));
        state
            .delete_session(session.id)
            .await
            .expect("cleanup session");
    }
}

