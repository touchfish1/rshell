# rshell Design System

## 1. Design Philosophy

rshell is a developer tool for remote infrastructure management. The UI should feel like a **professional instrument** — precise, predictable, and unobtrusive.

- **Clarity over decoration**: Every visual element must serve a purpose. Hierarchy is achieved through spacing, weight, and color, not through shadows, gradients, or icons.
- **Consistency across pages**: Terminal, MySQL, Redis, Zookeeper, Etcd — all pages share the same layout pattern, component language, and color semantics. Users should feel at home regardless of which service they're browsing.
- **High information density, not clutter**: Show as much data as needed, but group it visually. Use progressive disclosure (expandable trees, tabs, collapsible sections) rather than stacking everything on screen.
- **Light/dark parity**: Both themes must cover all components. Dark is the primary (terminal-native), light is for daytime use and accessibility.

---

## 2. Layout Architecture

### 2.1 Page Shell

Every workspace page follows one of two patterns:

**Pattern A — Tool page (MySQL, Redis, ZK, Etcd):**
```
+----------------------------------------------------------------+
|  Top Bar (56px) — title, current connection, action buttons     |
+-----------------------------------+----------------------------+
|  Sidebar                           |  Browse Pane              |
|  (tree / connection list)          |  (tabs + content area)    |
|  280px fixed                       |  flex: 1                  |
+-----------------------------------+----------------------------+
|  Status Bar (~32px) — current command, connection info          |
+----------------------------------------------------------------+
```

**Pattern B — Terminal page:**
```
+----------------------------------------------------------------+
|  Top Bar (56px) — shortcuts, theme, preferences                |
+-----------------------------------+------+---------------------+
|  Host List  |  splitter  |  Terminal Tabs + Pane  | splitter | SFTP |
|  240px var  |  8px       |  flex: 1               |  8px      | 320px var |
+-----------------------------------+------+---------------------+
|  Status Bar — connection state, activity                        |
+----------------------------------------------------------------+
```

### 2.2 Spacing Units

All spacing uses multiples of 4px:

| Token | Value | Usage |
|-------|-------|-------|
| `4px` | 4px | Tight icon-to-text gaps |
| `8px` | 8px | Button padding (horizontal), card gaps |
| `12px` | 12px | Section padding, generous gaps |
| `16px` | 16px | Page edge padding, modal padding |
| `24px` | 24px | Section margins, card padding |
| `32px` | 32px | Between major sections |

### 2.3 Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 6px | Buttons, small cards |
| `--radius-md` | 8px | Connection cards, tab pills, panels |
| `--radius-lg` | 12px | Modal cards, large popups |
| `--radius-xl` | 16px | (Reserved) |

---

## 3. Color System

### 3.1 Surface Hierarchy (Dark)

Four levels establish depth without relying on shadows or transparency stacking:

| Level | Token | Hex | Usage |
|-------|-------|-----|-------|
| Page | `--bg-page` | `#0d1117` | Main background, modal backdrop |
| Surface | `--bg-surface` | `#161b22` | Cards, panels, sidebars |
| Elevated | `--bg-elevated` | `#1c2333` | Dropdowns, context menus, tooltips |
| Hover | `--bg-hover` | `#222834` | Button hover, row hover |
| Active | `--bg-active` | `#282e3f` | Button active, selected items |

### 3.2 Text Hierarchy

| Level | Token | Hex | Usage |
|-------|-------|-----|-------|
| Primary | `--text-primary` | `#e6edf3` | Body text, headings, table cells |
| Secondary | `--text-secondary` | `#8b949e` | Labels, metadata, subtitles |
| Muted | `--text-muted` | `#6e7681` | Placeholders, disabled, hints |

**Exception**: In sidebar trees where space is constrained, database names may use `#eef4ff` (slightly brighter) and table names may use `#9aafcf` (slightly dimmer) to reinforce hierarchy — but these should be the ONLY exceptions.

### 3.3 Accent

Cyan-teal, chosen to feel technical and distinct from common blue UIs:

```
--accent:        #2dd4bf   (selected borders, primary buttons)
--accent-hover:  #5eead4   (hover states)
--accent-muted:  rgba(45, 212, 191, 0.12)  (selected backgrounds)
--accent-ring:   rgba(45, 212, 191, 0.3)   (focus rings)
```

### 3.4 Semantic Colors

```
--success:  #22c55e  (online, connected, saved)
--warning:  #f59e0b  (pending, degraded)
--danger:   #ef4444  (error, disconnected, failed)
```

### 3.5 Borders

```
--border-default:  #30363d  (primary dividers, card borders)
--border-subtle:   #21262d  (secondary dividers, table row lines)
--border-accent:   rgba(45, 212, 191, 0.4)  (accent borders)
```

### 3.6 Light Theme Mapping

Each dark color maps to a light equivalent. The accent shifts to a forest teal:

```
--bg-page:     #f6f8fa     (→ dark: #0d1117)
--bg-surface:  #ffffff     (→ dark: #161b22)
--accent:      #0d9488     (→ dark: #2dd4bf)
--text-primary: #1f2328   (→ dark: #e6edf3)
--border-default: #d0d7de (→ dark: #30363d)
```

**Rule**: Every component CSS must have a `html[data-theme="light"]` override in `theme-light.css`. If a component doesn't specify a light override, it will use hardcoded dark colors in light mode — that is a bug.

---

## 4. Component Standards

### 4.1 Sidebar Tree Navigation

Used in MySQL, Redis, ZK, and Etcd pages.

**Connection node:**
- Card with border (`--border-default`), radius `--radius-md`
- Selected: accent border, accent muted background
- Left padding: 10px
- Font: 12px bold for name, 10px normal for metadata

**Database/group node (expandable):**
```
● DatabaseName          (bold, 12px, #eef4ff)
   └─ line connecting to child section
```
- Left border accent (2px) on selected
- Small filled dot `●` (6px) as bullet — NOT a text badge
- Indent from connection card: 8px + left border rail

**Table/leaf node:**
```
  table_name             (11px, #9aafcf, normal weight)
```
- Plain text, no bullet, no border
- Clearly secondary to database names
- Indented below database, visually grouped by the section container
- Hover: subtle background tint

**Table section container:**
- Light background tint (different from the outer pane)
- Search bar at top with filter input
- Results list below with max-height and scroll

### 4.2 Tabs

Used for browse tabs in database pages and session tabs in terminal page.

**Tab bar:**
```
[ Table: users ] [ Query: active ] [x] [ Design: orders ] [x]
```
- Height: 34px (6px padding top/bottom, content area ~22px)
- Gap between tabs: 6px
- Background: slightly different from main content area (distinguish tab bar from body)

**Tab item:**
```
+---[  Table: users  ]--[x]--+
```
- Border-radius: `--radius-md` (8px)
- Inactive: no background, `--text-secondary` color
- Hover: subtle background (`rgba(28, 36, 50, 0.45)`)
- Active: filled background (`rgba(35, 47, 66, 0.62)`)
- Close button: only visible on hover (or always for tabs that can be closed)
- Close button: 24x24px, rounded, hover highlight

**Tab types** (should be visually distinct):
- `Table: <name>` — data browsing tab
- `Query: <#>` — SQL editor tab
- `Design: <name>` — table structure editor tab

### 4.3 Data Grid

Used for table data display and query results.

```
+--------+-----------+------+------+
|  ← id  |  name ↑   | age  | city |
+--------+-----------+------+------+
|  1     |  Alice    |  30  |  NY  |
|  2     |  Bob      |  25  |  SF  |
+--------+-----------+------+------+
```

- Table header: sticky, bold, slightly darker background
- Cells: monospace font for consistency, left-aligned by default
- NULL values: muted text or '—'
- Row hover: full-row highlight
- **No alternating row colors** (keeps visual noise low for data-heavy tables)
- Column divider lines: 1px `--border-subtle` or `--border-default`
- Horizontal scroll when columns exceed container width

### 4.4 Filter Bar

Inline filter for data tables:

```
[ Column: name ]  [ contains ]  [ John ]  [ + ]  [ × ]  [ Query ]
```

- Compact: all controls 28px height
- Column select, operator select, value input in a single row per condition
- Add condition button (+), remove condition button (×)
- "Query" button executes the filter
- Conditions stack vertically when multiple

### 4.5 Buttons

Defined in `base.css` with variations:

| Class | Usage | Key style |
|-------|-------|-----------|
| `.btn` | Default action | border, surface bg, primary text |
| `.btn-primary` | Primary action | accent border + muted accent bg |
| `.btn-ghost` | Toolbar/secondary | transparent until hover |
| `.btn-danger` | Destructive | red tones |

- Height: 28px in toolbars, 30-32px in forms/modals
- Font: 12px, 500 weight

### 4.6 Inputs & Selects

- Height: 28px (compact) / 34px (standard)
- Border: `--border-default`, radius `--radius-sm`
- Focus: accent ring (`--accent-ring`)
- Background: `--bg-surface` or `--bg-page`

### 4.7 Pagination

Compact bar below data grid:

```
← 1-100 of 1,234 →    [ 100 / page ▼ ]
```

- Page size select on right (25 / 50 / 100 / 200)
- Previous/next buttons on left
- Current range and total displayed
- Single shared component (`MySqlPagination`)

### 4.8 Context Menus

```
+---------------------------+
|  Edit Table               |
|  Query Top 1000           |
|  Copy Name                |
+---------------------------+
```

- Fixed position, z-index: 80
- `--bg-elevated` background, `--border-default` border
- Radius: `--radius-md` (8px)
- Spacing: 6px padding container, 4px gap between items
- Item height: ~28px, padding 6px 8px
- Hover: accent border, subtle accent background
- Danger items: red text

### 4.9 Top Bar

- Height: 56px
- Left: title + subtitle (connection/database name)
- Right: action buttons (compact: 28px height)
- Bottom border: `--border-default`

### 4.10 Status Bar

- Height: ~30-32px
- Background: `--bg-surface` or similar
- Top border: `--border-subtle`
- Shows: current executing command, connection count, row counts
- Left-aligned command text, right-aligned metadata

---

## 5. Typography

| Context | Family | Size | Weight |
|---------|--------|------|--------|
| Page title | Inter / system-ui | 16px | 600 |
| Section header | Inter / system-ui | 12px | 700 (uppercase) |
| Connection name | Inter / system-ui | 12px | 700 |
| Database node | Inter / system-ui | 12px | 700 |
| Table node | Inter / system-ui | 11px | 400 |
| Table cell | JetBrains Mono / monospace | 12px | 400 |
| Tab label | Inter / system-ui | 13px | 500 |
| Button | Inter / system-ui | 12px | 500 |
| Status bar | Inter / system-ui | 11px | 400 |
| Filter input | Inter / system-ui | 12px | 400 |

---

## 6. Interaction Patterns

### 6.1 Transition Speeds

| Token | Duration | Usage |
|-------|----------|-------|
| `--ease-fast` | 120ms | Color transitions, background fades |
| `--ease-normal` | 200ms | Panel open/close, modal |

### 6.2 Focus

- All interactive elements must have visible focus ring (`--accent-ring`)
- Focus ring: `0 0 0 2px var(--bg-page), 0 0 0 4px var(--accent-ring)`
- Never use `outline: none` without replacing with a focus ring

### 6.3 Context Menu Close

- Click outside → close
- ESC key → close
- Right-click on same element → replace existing menu (don't stack)

### 6.4 Hover States

Every interactive element needs a hover state:

| Element | Hover effect |
|---------|-------------|
| Button | Slightly lighter background (`--bg-hover`) |
| Tab | Subtle background tint |
| Table row | Row background highlight |
| Tree node | Background tint, cursor pointer |
| Close button | Background + color change |

---

## 7. Migration Rules

When converting existing pages to this design system:

1. **Replace hardcoded colors** with CSS custom properties from `base.css`. If a property doesn't exist, add it.
2. **Every new CSS rule** in `*.css` files (not `theme-light.css`) must have a corresponding `html[data-theme="light"]` override in `theme-light.css`.
3. **Sidebar components** (MySQL, ZK, Redis browsers) must share the same tree node styling. Extract common classes if needed.
4. **Tab bars** across all pages should use the same component or CSS class pattern.
5. **Data grids** should share the same base styling. Column-specific customization can be additive.

---

## 8. Dos and Don'ts

| Do | Don't |
|----|-------|
| Use `--accent` for selection indicators | Use hardcoded blue (#2563eb) for selection |
| Use `--border-subtle` for row dividers | Use `rgba(...)` values from another page's CSS |
| Keep sidebar tree rows compact (max 28px) | Add padding beyond 10px horizontal / 6px vertical |
| Group related controls with 8px gap | Scatter controls with 16px+ gaps |
| Use monospace for data cells | Use proportional font in data grids |
| Close context menus on outside click | Leave orphan menus on the screen |
