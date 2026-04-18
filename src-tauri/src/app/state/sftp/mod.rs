//! SFTP 目录列表、下载与文本读写（挂接到 `AppState`）。

mod list_download;
mod text;

pub use text::SftpTextReadResult;
