# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

rshell is a cross-platform desktop remote terminal tool built with **Tauri 2 + Rust + React + xterm.js**. It provides SSH/Telnet session management with tabbed terminals, SFTP file browsing, host resource monitoring, and database/middleware connectivity (Redis, Zookeeper, MySQL) — all with audit logging.

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

## Project Structure

```
rshell/
  src-tauri/                       # Tauri/Rust backend
    src/
      main.rs                      # Entry: registers plugins, AppState, all commands
      api/
        commands.rs                # Adapter: 50+ #[tauri::command] handlers
        sessions.rs, terminal.rs, sftp.rs, metrics.rs, redis.rs, mysql.rs,
        zookeeper.rs, audit.rs, system.rs, environments.rs, sync.rs
      app/
        mod.rs                     # AppState, SSH session lifecycle, SFTP, metrics
        state/
          sessions.rs, sftp.rs, terminal_io.rs, ssh_helpers.rs, metrics.rs,
          audit.rs, redis/, mysql/, zookeeper.rs, environments.rs
      domain/
        session.rs, terminal.rs, audit.rs, redis.rs, mysql.rs, zookeeper.rs
      infra/
        store.rs                   # JSON file persistence
        ssh_client/                # SSH TerminalClient impl
        telnet_client.rs           # Telnet TerminalClient impl
    ui/                            # React frontend
      src/
        App.tsx                    # Root: page routing, command palette, modals
        pages/
          HomePage.tsx             # Dashboard + session management
          TerminalPage.tsx         # Tabbed terminal workspace
          ZookeeperPage.tsx        # ZNode tree browser
          RedisPage.tsx            # Redis key-value browser
          MySqlPage.tsx            # MySQL database explorer
          MySqlDataPage.tsx        # MySQL data viewer
        hooks/
          useAppShell.ts           # Central orchestrator hook (composes all feature hooks)
          useSessionActions.ts, useZookeeperActions.ts, useRedisActions.ts,
          useMysqlActions.ts, useWorkspaceTabs.ts, useTerminalOutput.ts,
          useSftpState.ts, useSessionPing.ts, useAuditLogs.ts, useUpdater.ts
        components/
          TerminalPane.tsx         # xterm.js wrapper
          SessionList.tsx, ErrorBanner.tsx, ErrorBoundary.tsx, ...
        services/
          bridge.ts                # Single file: all invoke() calls + event listeners
          types.ts                 # TypeScript types mirroring Rust domain structs
        i18n/
          enUS.ts, zhCN.ts, keys.ts
  docs/
    ARCHITECTURE.md, DEVELOPMENT.md, API_REFERENCE.md, USER_GUIDE.md
```

## Architecture

### Tauri Dual-Process Architecture

- **Rust backend** (`src-tauri/src/`): Network connections (SSH/Telnet), file persistence, system operations
- **React frontend** (`src-tauri/ui/`): UI rendering, user interaction, state management
- **IPC**: Frontend calls `invoke("command_name", payload)` via `@tauri-apps/api`; backend pushes events (`terminal-output`, `debug-log`)

### Rust Clean Architecture (layered)

```
api/commands.rs   →   app/state/   →   domain/   →   infra/
(adapter layer)       (state+logic)    (models)     (storage + clients)
```

- **api/commands.rs**: Thin adapter — parameter conversion, debug logging, delegates to AppState. Never contains domain logic.
- **app/state/**: `AppState` holds all runtime state (session lists, active terminal connections keyed by UUID, ZK/Redis/MySQL connections, audit buffers). All wrapped in `Arc<Mutex<>>` for thread safety.
- **domain/**: Pure data structs and `TerminalClient` trait. No dependencies on Tauri or UI.
- **infra/**: `SessionStore` handles JSON file persistence in user config dir. `ssh_client/` and `telnet_client.rs` implement `TerminalClient`.

### Frontend Architecture

- **No router library** — page switching via `currentPage` state ("home", "terminal", "zookeeper", "redis", "mysql", "mysqlData")
- **Central orchestrator**: `useAppShell.ts` composes all feature hooks and manages top-level state
- **Single bridge file**: `bridge.ts` exports typed async functions for every Tauri command; `types.ts` mirrors Rust domain types
- **State management**: React `useState` + `useRef` (no Redux/Zustand). `useRef` avoids stale closures in async terminal output callbacks.
- **No frontend testing** (no Jest/Vitest configured)

### Key Patterns

1. **Frontend-backend contract**: Every `#[tauri::command]` in Rust has a matching typed function in `bridge.ts`, with shared types in `types.ts`
2. **Password storage**: Plaintext JSON files (`secrets.json`, `redis_secrets.json`, etc.) in user config dir. Known limitation.
3. **Terminal I/O**: Base64-encoded output streamed via Tauri events; decoded on frontend per-session encoding to handle CJK correctly
4. **SSH handshake retry**: Short backoff retry for SSH key exchange to reduce transient failures

### Data Persistence

Files stored at `{dirs::config_dir()}/rshell/`:
- `sessions.json`, `secrets.json` — SSH/Telnet sessions
- `zookeeper.json`, `redis.json`, `mysql.json` + `*_secrets.json` — middleware connections
- `audit.json` — audit log
- `environments.json`, `current_environment.txt` — environment management

### i18n

Custom i18n system (no react-i18next). Locales in `src-tauri/ui/src/i18n/` with `enUS.ts` and `zhCN.ts`.
