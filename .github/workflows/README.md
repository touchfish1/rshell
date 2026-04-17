# Workflows 说明

本目录包含项目 CI 与发布流水线。

- `ci.yml`
  - 前端构建校验（`src-tauri/ui`）
  - Rust 编译校验（`src-tauri`）

- `release.yml`
  - 基于 tag（`v*`）进行多平台构建
  - 上传安装包与 updater 相关产物
  - 产物路径统一使用 `src-tauri/target/...`

维护建议：

- 若调整项目目录结构，先同步更新这里的 `working-directory` 与 `target` 路径
- 若调整 updater 产物规则，务必同步检查 `latest*.json` 与 `.sig` 上传步骤
