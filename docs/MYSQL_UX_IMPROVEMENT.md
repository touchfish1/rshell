# MySQL 页面布局与交互改进方案

## 1. 背景

当前 rshell 的 MySQL 页面已具备基本功能：连接管理、数据库/表导航、数据浏览、过滤、查询编辑、表结构编辑。但与 Navicat、DataGrip、HeidiSQL、DBeaver 等成熟工具相比，布局和交互细节上存在差距，影响日常使用效率。

本文档基于主流 MySQL GUI 工具的布局模式调研和当前代码分析，提出改进方案。

---

## 2. 主流工具布局模式对比

### 2.1 通用布局架构

```
+-------------------+--------------------------------------------+
|   Left Panel      |         Central Content Area               |
| (Navigator Tree)  |  +--------------------------------------+  |
|                   |  |  Tab Bar (tables/queries)            |  |
| Connections       |  +--------------------------------------+  |
|   ├─ Database     |  |  Query Editor (top, optional)       |  |
|   │  ├─ Tables    |  +--------------------------------------+  |
|   │  ├─ Views     |  |  Data Grid / Results (bottom)       |  |
|   │  └─ Routines  |  |  [Filter Bar] [Pagination]          |  |
|                   |  +--------------------------------------+  |
+-------------------+--------------------------------------------+
|                   Status Bar                                   |
+----------------------------------------------------------------+
```

### 2.2 关键模式共识

| 模式 | Navicat | DataGrip | HeidiSQL | DBeaver | MySQL Workbench |
|------|---------|----------|----------|---------|-----------------|
| 左树+右详情 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 内联过滤栏 | ✓ | ✓ | ✓ | 列菜单 | ✓ |
| 多标签页 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 查询编辑器+结果拆分 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 底部状态栏 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 右键快捷操作 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 虚拟滚动/大数据 | ✓ | ✓ | × | ✓ | × |

---

## 3. 当前布局分析

### 3.1 现有结构

```
+-------------------+--------------------------------------------+
| MySqlSidebar      |  MySqlBrowsePane                           |
|                   |  +--------------------------------------+  |
| 连接列表          |  |  Tab Bar (table/query/edit tabs)     |  |
|   ├─ db1          |  +--------------------------------------+  |
|   │  ├─ table1    |  |  Filter Bar (conditions)            |  |
|   │  └─ table2    |  +--------------------------------------+  |
|   └─ db2          |  |  Data Grid / Results                |  |
|                   |  |  [Pagination]                         |  |
+-------------------+--------------------------------------------+
```

### 3.2 现有问题

1. **无树形搜索** — 侧边栏不支持过滤/搜索，表多时难以定位
2. **过滤栏与数据脱节** — 条件列选择依赖查询结果，查不到数据就无法选择列
3. **查询编辑器功能弱** — 原生 `<textarea>`，无语法高亮、无括号匹配
4. **查询编辑器与数据浏览拆分不足** — 查询结果和表数据共用同一布局，查询编辑器没有独立的下方结果面板
5. **Rust 端 `limit/offset` 未实现** — `mysql_execute_query` 的 `_limit`/`_offset` 参数未使用，总是返回全量结果
6. **分页控件重复** — 表数据分页和查询结果分页使用两套独立的状态和控件
7. **状态样板代码重复** — `MySqlTableDataState` 的回退默认值在多处硬编码
8. **过滤无防抖** — 每次条件变更立即触发网络请求
9. **无底部状态栏** — 缺少连接信息、行数统计等常驻信息
10. **缺少右键快捷操作** — 树节点右键菜单功能较少

---

## 4. 改进方案

### 4.1 目标布局

```
+-------------------+--------------------------------------------+
| MySqlSidebar      |  MySqlBrowsePane                           |
| (含搜索框)        |  +--------------------------------------+  |
|                   |  |  Tab Bar (tables/queries)            |  |
| 连接列表          |  +--------------------------------------+  |
|   ├─ db1 [🔍]    |  |  Data Grid / Table View             |  |
|   │  ├─ tables    |  |  + Quick Filter (inline)            |  |
|   │  │  ├─ t1     |  |  + Column Header Sort              |  |
|   │  │  └─ t2     |  |  + Pagination                      |  |
|   │  └─ views     |  |                                     |  |
|   └─ db2          |  |  OR for Query Tab:                  |  |
|                   |  |  +━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━+  |  |
|                   |  |  | Query Editor (CodeMirror)      |  |  |
|                   |  |  +━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━+  |  |
|                   |  |  | Query Results Grid              |  |  |
|                   |  |  | [Server-side Pagination]        |  |  |
|                   |  |  +━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━+  |  |
|                   |  +--------------------------------------+  |
+-------------------+--------------------------------------------+
| CommandStatusBar (扩展: 连接名/数据库/行数/耗时)               |
+----------------------------------------------------------------+
```

### 4.2 改进项清单

按优先级从高到低排列：

#### P0 — 严重影响日常使用的 Bug/缺失

| # | 改进 | 说明 | 涉及文件 | 状态 |
|---|------|------|----------|------|
| 1 | **修复 Rust 端 `limit/offset`** | `mysql_execute_query` 的 `_limit`/`_offset` 参数未使用，改为 `LIMIT ? OFFSET ?` 追加 | `src-tauri/src/app/state/mysql/query.rs` | ✅ **已完成** |
| 2 | **查询结果服务端分页** | 查询编辑器结果支持按 offset 重新查询，越界时自动请求下一批 | `MySqlBrowsePane.tsx`, `useMySqlDataLoader.ts`, `types.ts` | ✅ **已完成** |
| 3 | **过滤时列名不从查询结果取** | 当查询结果为空时 `data.columns` 为空，fallback 到 `mySqlListColumns` | `useMySqlDataLoader.ts` | ✅ **已完成** |

#### P1 — 布局与交互体验

| # | 改进 | 说明 | 涉及文件 |
|---|------|------|----------|
| 4 | **侧边栏加入搜索/过滤** | 树顶部加一个 `<input>` 用于过滤表名，快速定位 | `MySqlSidebar.tsx` |
| 5 | **查询结果和编辑器垂直拆分** | 新建查询标签时，在同一个面板内垂直分为编辑器和结果区，而非分开渲染 | `MySqlBrowsePane.tsx`, `MySqlPage.tsx` |
| 6 | **拆分分页组件** | 将重复的分页逻辑抽取为 `MySqlPagination` 组件 | 新建 `MySqlPagination.tsx` |
| 7 | **底部状态栏扩展** | `CommandStatusBar` 增加当前连接名、数据库、行数等信息 | `CommandStatusBar.tsx` |
| 8 | **树节点右键菜单增强** | 增加"查询前 1000 行"、"复制名称"、"复制 SQL"等快捷操作 | `MySqlSidebar.tsx` |

#### P2 — 质量与性能

| # | 改进 | 说明 | 涉及文件 |
|---|------|------|----------|
| 9 | **过滤防抖** | 条件输入后 300ms 再触发查询，避免频繁请求 | `useMySqlTableFilters.ts` |
| 10 | **状态默认值抽取** | 将 `MySqlTableDataState` 默认值抽取为常量，消除各处样板代码 | `types.ts`, 多处调用点 |
| 11 | **竞态条件保护** | `loadTableData` 加入 tabId 校验或 abort 机制 | `useMySqlDataLoader.ts` |
| 12 | **查询编辑器语法高亮** | 引入 CodeMirror 或轻量方案替代原生 `<textarea>` | `MySqlBrowsePane.tsx` |

#### P3 — 未来可考虑

| # | 改进 | 说明 |
|---|------|------|
| 13 | 数据网格虚拟滚动 | 虚化大结果集渲染性能 |
| 14 | 列排序支持 | 点击列头按该列排序 |
| 15 | 行号显示 | 表格数据行和查询结果显示行号 |
| 16 | Excel/CSV 导出 | 导出查询结果或表数据 |
| 17 | 查询历史 | 保存已执行的 SQL 历史 |

---

## 5. 详细方案

### 5.1 P0-1: 修复 Rust 端 `limit/offset`

**现状**: `query.rs` 中 `execute_mysql_query` 签名带有 `_limit: u32` 和 `_offset: u32`，但函数体中使用 `let rows = sqlx::query(...).fetch_all(&pool).await?;` 获取所有行。

**方案**: 在 SQL 中追加 `LIMIT ? OFFSET ?`。需要注意区分 `SELECT`/`SHOW`/`DESC` 和其他语句：

```rust
// query.rs
let mut query = sql;
// 只对 SELECT/SHOW/DESC 语句追加 LIMIT/OFFSET
let trimmed = sql.trim().to_uppercase();
if trimmed.starts_with("SELECT") || trimmed.starts_with("SHOW") || trimmed.starts_with("DESC") {
    query = format!("{} LIMIT {} OFFSET {}", sql, limit, offset);
}
let rows = sqlx::query(&query).fetch_all(&pool).await?;
```

### 5.2 P0-3: 过滤列 fallback

**现状**: `loadTableData` 中 `columns` 来自 `data.columns`（查询结果列），当结果为空时可能返回空数组。

**方案**: 已修复。当 `data.columns` 为空时调用 `mySqlListColumns` 获取列信息。

### 5.3 P1-4: 侧边栏搜索

**现状**: `MySqlSidebar` 渲染数据库下的表列表，无搜索框。

**方案**: 在数据库展开后的表列表上方加一个 `<input>`：

```tsx
// MySqlSidebar.tsx
{expanded && (
  <div>
    <input
      className="mysql-field mysql-filter-input"
      placeholder={tr("mysql.page.filterTables")}
      value={tableFilter}
      onChange={(e) => onFilterTables(schema, e.target.value)}
    />
    {filteredTables.map(...)}
  </div>
)}
```

### 5.4 P1-5: 查询标签垂直拆分布局

**现状**: 查询标签页内，编辑器在顶部（可滚动），结果显示在编辑器下方。没有固定的分区。

**方案**: 查询标签使用 flex 容器垂直拆分，编辑器区域和结果区域可拖动调节比例：

```
+-----------------------------------+
|  Query Editor (flex: 1)           |
|  [工具栏: 运行/解释/格式化]        |
|  [CodeMirror 编辑器]              |
+-----------------------------------+
|  ← 可拖动分隔条 →                 |
+-----------------------------------+
|  Query Results (flex: 1)          |
|  [数据网格] [分页]                |
+-----------------------------------+
```

### 5.5 P1-6: 分页组件抽取

**现状**: `MySqlBrowsePane` 中有两套分页代码，总计约 80 行重复。

**方案**: 新建 `MySqlPagination.tsx` 组件，接收通用 props：

```tsx
interface MySqlPaginationProps {
  page: number;
  pageSize: number;
  totalRows: number;
  loading: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}
```

### 5.6 P1-7: 状态栏扩展

**现状**: `CommandStatusBar` 仅显示当前执行的 SQL。

**方案**: 增加扩展信息行，显示当前连接、数据库、总行数和查询耗时。

### 5.7 P2-9: 过滤防抖

**现状**: `patchCondition` 调用后立即触发 `queryCurrentTable`，每次输入都发起请求。

**方案**: 在 `useMySqlTableFilters` 中使用 `useRef` + `setTimeout` 实现 300ms 防抖：

```tsx
const debounceRef = useRef<ReturnType<typeof setTimeout>>();
const queryCurrentTable = useCallback(() => {
  if (debounceRef.current) clearTimeout(debounceRef.current);
  debounceRef.current = setTimeout(() => {
    // 执行查询...
  }, 300);
}, [...]);
```

### 5.8 P2-10: 状态默认值抽取

**现状**: `{ loading: false, conditions: [createEmptyCondition()], columns: [], rows: [], page: 0, pageSize: 100, totalRows: 0 }` 在 4 个文件中重复。

**方案**: 在 `types.ts` 中导出常量：

```ts
export const EMPTY_TABLE_DATA_STATE: Omit<MySqlTableDataState, 'loading' | 'error'> = {
  conditions: [createEmptyCondition()],
  columns: [],
  rows: [],
  page: 0,
  pageSize: 100,
  totalRows: 0,
};
```

---

## 6. 建议实施路线

| 阶段 | 内容 | 工作量 |
|------|------|--------|
| **Sprint 1** | P0 缺陷修复（limit/offset、列 fallback）+ 查询结果分页 | 2-3 天 |
| **Sprint 2** | P1 布局改进（侧边栏搜索、分页组件抽取、状态栏扩展） | 3-4 天 |
| **Sprint 3** | P1 查询标签垂直拆分布局 + 右键菜单增强 | 3-4 天 |
| **Sprint 4** | P2 质量改进（防抖、默认值抽取、竞态保护） | 2-3 天 |
| **未来** | P3 语法高亮、虚拟滚动、排序、导出 | 5-10 天 |

---

## 7. 参考工具

- [Navicat for MySQL](https://www.navicat.com/en/products/navicat-for-mysql) — 布局参考
- [DataGrip](https://www.jetbrains.com/datagrip/) — 查询编辑器和自动补全参考
- [HeidiSQL](https://www.heidisql.com/) — 轻量级交互参考
- [DBeaver](https://dbeaver.io/) — 数据网格和元数据浏览参考
- [Sequel Ace](https://sequel-ace.com/) — Mac 端简洁设计参考
