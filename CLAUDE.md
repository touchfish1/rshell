# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

rshell is a cross-platform desktop remote terminal tool built with **Tauri 2 + Rust + React + xterm.js**. It provides SSH/Telnet session management with tabbed terminals, SFTP file browsing, host resource monitoring, and database/middleware connectivity (Redis, Zookeeper, MySQL, PostgreSQL, Etcd) — all with audit logging and multi-environment support.

## Build & Development Commands

```bash
# Install dependencies (first time)
npm install                                    # Tauri CLI at root
npm --prefix src-tauri/ui install              # Frontend deps
cd src-tauri && cargo check                    # Verify Rust compiles

# Development (single command — launches UI dev server + desktop app)
npm run dev:tauri

# Development (two-terminal for separate debugging)
npm --prefix src-tauri/ui run dev              # Terminal A: Vite on port 5173
npx tauri dev                                  # Terminal B: desktop app

# Build
npm run build:ui                               # Frontend only (Vite -> dist/)
npm run build:tauri                            # Full Tauri build + bundling

# Test (Rust only — no frontend test framework configured)
cd src-tauri && cargo test                     # All Rust unit tests
cd src-tauri && cargo test state_tests         # Single test module

# Pre-commit checks
cd src-tauri && cargo check                    # Rust compilation check
cd src-tauri/ui && npm run build               # Frontend build check
```

### Build prerequisites

- **protoc** (Protocol Buffers compiler) must be installed — required by `etcd-client` crate. On macOS: `brew install protobuf`. On Ubuntu: `sudo apt install protobuf-compiler`. On Windows: `choco install protoc` or use the CI's `arduino/setup-protoc@v3` action.

## Project Structure

```
rshell/
  src-tauri/                       # Tauri/Rust backend
    Cargo.toml                     # Feature flag: postgresql_sync
    src/
      main.rs                      # Entry: registers plugins, AppState, all commands
      api/
        commands.rs                # Adapter: all #[tauri::command] handlers (some split into sub-modules)
        commands/                  # Per-feature command sub-modules (e.g. postgresql/)
      app/
        mod.rs                     # AppState exports + re-exports
        state/
          mod.rs                   # AppState struct: all runtime state, Arc<Mutex<>> maps
          sessions.rs, terminal_io.rs, ssh_helpers.rs, sftp.rs, metrics.rs
          audit.rs, audit_parse.rs, convert.rs, environments.rs
          redis/, zookeeper/, mysql/, etcd/, postgresql/
      domain/
        session.rs, terminal.rs, audit.rs
        redis.rs, mysql.rs, postgresql.rs, zookeeper.rs, etcd.rs
      infra/
        store.rs                   # JSON file persistence for all resource types
        store_audit.rs, store_secret.rs
        ssh_client/                # SSH TerminalClient impl (via russh + ssh2)
        telnet_client.rs           # Telnet TerminalClient impl
    ui/                            # React frontend
      src/
        App.tsx                    # Root: page routing, command palette, modals, theme
        pages/
          HomePage.tsx             # Dashboard + session management + audit viewer
          TerminalPage.tsx         # Tabbed terminal workspace (terminal + SFTP + monitor)
          ZookeeperPage.tsx        # ZNode tree browser
          RedisPage.tsx            # Redis key-value browser
          MySqlPage.tsx, MySqlDataPage.tsx  # MySQL database explorer + data viewer
          EtcdPage.tsx             # Etcd key-value browser
        hooks/
          useAppShell.ts           # Central orchestrator hook (composes all feature hooks)
          useSessionActions.ts, useZookeeperActions.ts, useRedisActions.ts
          useMysqlActions.ts, usePostgreSqlActions.ts
          useWorkspaceTabs.ts, useTerminalOutput.ts
          useSftpState.ts, useSessionPing.ts, useAuditLogs.ts, useUpdater.ts
        components/
          TerminalPane.tsx         # xterm.js wrapper
          SessionList.tsx, ErrorBanner.tsx, ErrorBoundary.tsx, ...
        services/
          bridge.ts                # Single file: all invoke() calls + event listeners
          types.ts                 # TypeScript types mirroring Rust domain structs
        i18n/
          enUS.ts, zhCN.ts, keys.ts   # Custom i18n (no react-i18next)
  docs/
    ARCHITECTURE.md, DEVELOPMENT.md, API_REFERENCE.md, USER_GUIDE.md
```

## Architecture

### Tauri Dual-Process Architecture

- **Rust backend** (`src-tauri/src/`): Network connections (SSH/Telnet), file persistence, system operations
- **React frontend** (`src-tauri/ui/`): UI rendering, user interaction, state management
- **IPC**: Frontend calls `invoke("command_name", payload)` via `@tauri-apps/api`; backend pushes events (`terminal-output`, `debug-log`)
- **Tauri plugins**: `tauri-plugin-process` (subprocess control), `tauri-plugin-updater` (in-app updates via GitHub Releases), `tauri-plugin-window-state` (persist window geometry)

### Rust Clean Architecture (layered)

```
api/commands     →   app/state/   →   domain/   →   infra/
(adapter layer)      (state+logic)    (models)     (storage + clients)
```

- **api/**: Thin adapter — parameter conversion, debug logging, delegates to AppState. Never contains domain logic. Some features (PostgreSQL) have per-feature sub-modules under `api/commands/`.
- **app/state/**: `AppState` holds all runtime state (session lists, active terminal connections keyed by UUID, per-service connection maps, audit buffers, environment state). All wrapped in `Arc<Mutex<>>` for thread safety. Per-service state lives in sub-modules (e.g. `state/postgresql/` for connection lifecycle + query execution).
- **domain/**: Pure data structs and `TerminalClient` trait. No dependencies on Tauri or UI.
- **infra/**: `SessionStore` handles JSON file persistence in user config dir. `ssh_client/` (russh + ssh2) and `telnet_client.rs` implement `TerminalClient`.

### Feature flags (Cargo)

- `postgresql_sync`: Enables PostgreSQL DDL sync across environments (gated behind `#[cfg(feature = "postgresql_sync")]`)

### Frontend Architecture

- **No router library** — page switching via `currentPage` state ("home", "terminal", "zookeeper", "redis", "mysql", "mysqlData", "etcd")
- **Central orchestrator**: `useAppShell.ts` composes all feature hooks and manages top-level state
- **Single bridge file**: `bridge.ts` exports typed async functions for every Tauri command; `types.ts` mirrors Rust domain types
- **State management**: React `useState` + `useRef` (no Redux/Zustand). `useRef` avoids stale closures in async terminal output callbacks.
- **No frontend testing** (no Jest/Vitest configured)
- **Theme**: Light/dark/system modes persisted to `localStorage` (`rshell.theme`)

### Key Patterns

1. **Frontend-backend contract**: Every `#[tauri::command]` in Rust has a matching typed function in `bridge.ts`, with shared types in `types.ts`
2. **Password storage**: Plaintext JSON files in user config dir. Known limitation — each service has its own `*_secrets.json` file.
3. **Terminal I/O**: Base64-encoded output streamed via Tauri events; decoded on frontend per-session encoding to handle CJK correctly
4. **SSH handshake retry**: Short backoff retry for SSH key exchange to reduce transient failures
5. **Tab linkState**: Each workspace tab tracks connection state as `connecting` | `ready` | `failed`, enabling loading overlays and reconnect UX
6. **Window close = hide to tray**: The main window prevents close and hides instead. Actual quit happens via tray menu. This preserves active sessions.
7. **Multi-environment**: Sessions and connections are scoped to environments (default: "default"). Environment switching filters visible resources. Environment list is auto-populated from existing data.

### Data Persistence

Files stored at `{dirs::config_dir()}/rshell/`:
- `sessions.json`, `secrets.json` — SSH/Telnet sessions
- `zookeeper.json`, `zookeeper_secrets.json` — Zookeeper connections
- `redis.json`, `redis_secrets.json` — Redis connections
- `mysql.json`, `mysql_secrets.json` — MySQL connections
- `postgresql.json`, `postgresql_secrets.json` — PostgreSQL connections
- `etcd.json`, `etcd_secrets.json` — Etcd connections
- `audit.json` — audit log
- `environments.json`, `current_environment.txt` — environment management

### CI/CD

- **CI** (`.github/workflows/ci.yml`): Runs on every push/PR. Frontend build (ubuntu) + Rust check (windows/ubuntu/macos matrix). Requires `protoc`.
- **Release** (`.github/workflows/release.yml`): Triggered by `v*` tags or manual dispatch. Builds platform bundles + updater artifacts (`.sig` signatures), generates `latest.json` for the Tauri updater plugin.

### i18n

Custom i18n system (no react-i18next). Locales in `src-tauri/ui/src/i18n/` with `enUS.ts` and `zhCN.ts`. All keys are type-checked via the `I18nKey` union type in `keys.ts`. Add new keys to all three files (keys.ts, enUS.ts, zhCN.ts).
