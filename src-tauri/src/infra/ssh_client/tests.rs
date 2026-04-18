//! 需设置 `RSHELL_TEST_HOST` / `RSHELL_TEST_USER` / `RSHELL_TEST_PASS` 的 SSH2 探测测试。

#[cfg(test)]
mod tests {
    use ssh2::Session as Ssh2Session;
    use std::env;
    use std::io::Read;
    use std::net::TcpStream;

    #[test]
    fn ssh2_backend_probe_exec() {
        let host = env::var("RSHELL_TEST_HOST").expect("RSHELL_TEST_HOST not set");
        let user = env::var("RSHELL_TEST_USER").expect("RSHELL_TEST_USER not set");
        let pass = env::var("RSHELL_TEST_PASS").expect("RSHELL_TEST_PASS not set");
        let addr = format!("{host}:22");

        let tcp = TcpStream::connect(addr).expect("tcp connect failed");
        let mut sess = Ssh2Session::new().expect("create ssh2 session failed");
        sess.set_tcp_stream(tcp);
        sess.handshake().expect("ssh handshake failed");
        sess.userauth_password(&user, &pass)
            .expect("ssh password auth failed");
        assert!(sess.authenticated(), "session not authenticated");

        let mut channel = sess.channel_session().expect("open channel failed");
        channel
            .exec("echo __RSHELL_BACKEND_OK__")
            .expect("exec command failed");
        let mut output = String::new();
        channel
            .read_to_string(&mut output)
            .expect("read command output failed");
        channel.wait_close().expect("wait close failed");

        assert!(
            output.contains("__RSHELL_BACKEND_OK__"),
            "unexpected output: {output}"
        );
    }
}
