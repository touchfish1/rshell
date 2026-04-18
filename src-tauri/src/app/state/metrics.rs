//! 主机资源指标：在 SSH 会话上执行 `/proc` 等只读命令并解析为 `HostMetrics`。

use uuid::Uuid;

use crate::app::state::{AppState, HostMetrics};
use crate::domain::session::Protocol;

impl AppState {
    pub async fn get_host_metrics(&self, id: Uuid) -> Result<HostMetrics, String> {
        let session = self.find_session(id).await?;
        if !matches!(session.protocol, Protocol::Ssh) {
            return Err("host metrics only supports ssh sessions".to_string());
        }
        let secret = self
            .store
            .get_secret(id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "missing SSH password".to_string())?;
        let ssh = self.open_ssh_session(&session, &secret)?;

        let cpu_raw = Self::run_ssh_command(
            &ssh,
            "sh -lc \"grep '^cpu ' /proc/stat; sleep 0.2; grep '^cpu ' /proc/stat\"",
        )?;
        let cpu_lines = cpu_raw.lines().collect::<Vec<_>>();
        let parse_cpu = |line: &str| -> Option<(u64, u64)> {
            let mut parts = line.split_whitespace();
            if parts.next()? != "cpu" {
                return None;
            }
            let values = parts
                .filter_map(|v| v.parse::<u64>().ok())
                .collect::<Vec<_>>();
            if values.len() < 4 {
                return None;
            }
            let total = values.iter().sum::<u64>();
            let idle = values.get(3).copied().unwrap_or(0) + values.get(4).copied().unwrap_or(0);
            Some((total, idle))
        };
        let (cpu_total_1, cpu_idle_1) =
            parse_cpu(cpu_lines.first().copied().unwrap_or("")).unwrap_or((0, 0));
        let (cpu_total_2, cpu_idle_2) =
            parse_cpu(cpu_lines.get(1).copied().unwrap_or("")).unwrap_or((0, 0));
        let cpu_delta = cpu_total_2.saturating_sub(cpu_total_1) as f64;
        let cpu_idle_delta = cpu_idle_2.saturating_sub(cpu_idle_1) as f64;
        let cpu_percent = if cpu_delta > 0.0 {
            ((cpu_delta - cpu_idle_delta) * 100.0 / cpu_delta).clamp(0.0, 100.0)
        } else {
            0.0
        };

        let mem_raw = Self::run_ssh_command(&ssh, "cat /proc/meminfo")?;
        let mut mem_total_kb = 0_u64;
        let mut mem_available_kb = 0_u64;
        for line in mem_raw.lines() {
            if let Some(v) = line.strip_prefix("MemTotal:") {
                mem_total_kb = v
                    .split_whitespace()
                    .next()
                    .and_then(|x| x.parse::<u64>().ok())
                    .unwrap_or(0);
            } else if let Some(v) = line.strip_prefix("MemAvailable:") {
                mem_available_kb = v
                    .split_whitespace()
                    .next()
                    .and_then(|x| x.parse::<u64>().ok())
                    .unwrap_or(0);
            }
        }
        let memory_total_bytes = mem_total_kb.saturating_mul(1024);
        let memory_used_bytes = mem_total_kb
            .saturating_sub(mem_available_kb)
            .saturating_mul(1024);
        let memory_percent = if memory_total_bytes > 0 {
            (memory_used_bytes as f64 * 100.0 / memory_total_bytes as f64).clamp(0.0, 100.0)
        } else {
            0.0
        };

        let disk_raw = Self::run_ssh_command(&ssh, "df -B1 /")?;
        let disk_line = disk_raw
            .lines()
            .nth(1)
            .ok_or_else(|| "parse disk metrics failed".to_string())?;
        let fields = disk_line.split_whitespace().collect::<Vec<_>>();
        if fields.len() < 5 {
            return Err("parse disk metrics failed".to_string());
        }
        let disk_total_bytes = fields
            .get(1)
            .and_then(|v| v.parse::<u64>().ok())
            .unwrap_or(0);
        let disk_used_bytes = fields
            .get(2)
            .and_then(|v| v.parse::<u64>().ok())
            .unwrap_or(0);
        let disk_percent = if disk_total_bytes > 0 {
            (disk_used_bytes as f64 * 100.0 / disk_total_bytes as f64).clamp(0.0, 100.0)
        } else {
            0.0
        };

        Ok(HostMetrics {
            cpu_percent,
            memory_used_bytes,
            memory_total_bytes,
            memory_percent,
            disk_used_bytes,
            disk_total_bytes,
            disk_percent,
        })
    }
}
