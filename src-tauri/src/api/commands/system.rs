//! 跨平台打开本机目录/选中文件、在默认浏览器打开 URL。

use std::path::Path;
use std::process::Command;

pub async fn open_in_file_manager(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err("path does not exist".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg("/select,")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("open explorer failed: {e}"))?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        let status = Command::new("open")
            .arg("-R")
            .arg(&path)
            .status()
            .map_err(|e| format!("open finder failed: {e}"))?;
        if status.success() {
            return Ok(());
        }
        return Err("open finder failed".to_string());
    }

    #[cfg(target_os = "linux")]
    {
        let parent = p
            .parent()
            .ok_or_else(|| "invalid parent path".to_string())?;
        let status = Command::new("xdg-open")
            .arg(parent)
            .status()
            .map_err(|e| format!("open file manager failed: {e}"))?;
        if status.success() {
            return Ok(());
        }
        return Err("open file manager failed".to_string());
    }

    #[allow(unreachable_code)]
    Err("unsupported platform".to_string())
}

pub async fn open_external_url(url: String) -> Result<(), String> {
    let trimmed = url.trim();
    if !(trimmed.starts_with("http://") || trimmed.starts_with("https://")) {
        return Err("only http/https URL is supported".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", trimmed])
            .spawn()
            .map_err(|e| format!("open url failed: {e}"))?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        let status = Command::new("open")
            .arg(trimmed)
            .status()
            .map_err(|e| format!("open url failed: {e}"))?;
        if status.success() {
            return Ok(());
        }
        return Err("open url failed".to_string());
    }

    #[cfg(target_os = "linux")]
    {
        let status = Command::new("xdg-open")
            .arg(trimmed)
            .status()
            .map_err(|e| format!("open url failed: {e}"))?;
        if status.success() {
            return Ok(());
        }
        return Err("open url failed".to_string());
    }

    #[allow(unreachable_code)]
    Err("unsupported platform".to_string())
}
