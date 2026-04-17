export type Lang = "zh-CN" | "en-US";

export type I18nKey =
  | "lang.zh"
  | "lang.en"
  | "lang.switchToZh"
  | "lang.switchToEn"
  | "top.subtitle"
  | "top.upgrade"
  | "top.upgradeChecking"
  | "top.online"
  | "top.offline"
  | "top.current"
  | "top.noHostSelected"
  | "top.ariaLanguageSwitch"
  | "home.hostList"
  | "home.hostListHint"
  | "home.emptyTitle"
  | "home.emptySubtitle"
  | "home.ariaNoSession"
  | "home.audit"
  | "home.auditTitle"
  | "home.auditRefresh"
  | "home.auditEmpty"
  | "home.auditFilterAll"
  | "home.auditFilterConnect"
  | "home.auditFilterCommand"
  | "home.auditFilterDisconnect"
  | "home.auditSearchPlaceholder"
  | "home.auditExportCsv"
  | "home.auditExportJson"
  | "session.management"
  | "session.addHost"
  | "session.name"
  | "session.host"
  | "session.user"
  | "session.protocol"
  | "session.port"
  | "session.status"
  | "session.actions"
  | "session.statusChecking"
  | "session.statusOnline"
  | "session.statusOffline"
  | "session.connect"
  | "session.editHost"
  | "session.copy"
  | "session.copySuffix"
  | "session.deleteConfirm"
  | "session.more"
  | "session.moreViewDetail"
  | "session.moreCopyConfig"
  | "session.moreExport"
  | "session.delete"
  | "session.connectTitle"
  | "session.copyIp"
  | "session.copied"
  | "modal.close"
  | "modal.cancel"
  | "modal.save"
  | "modal.testing"
  | "modal.testConnection"
  | "modal.testSuccess"
  | "modal.testFailed"
  | "modal.add"
  | "modal.newHost"
  | "modal.editHost"
  | "modal.modifyHostInfo"
  | "form.name"
  | "form.host"
  | "form.port"
  | "form.username"
  | "form.encoding"
  | "form.keepaliveSeconds"
  | "form.sshPassword"
  | "form.sshPasswordOptional"
  | "form.sshPasswordSaved"
  | "form.secretOptional"
  | "form.toggleShowPassword"
  | "form.toggleHidePassword"
  | "toast.downloading"
  | "toast.done"
  | "toast.failed"
  | "toast.openFolder"
  | "toast.downloadingHint"
  | "toast.openFolderFailed"
  | "terminal.noOpenedSession"
  | "terminal.closeTab"
  | "terminal.duplicateSession"
  | "terminal.closeRight"
  | "terminal.closeLeft"
  | "terminal.closeOthers"
  | "terminal.onlySshMonitor"
  | "terminal.ariaResizeHosts"
  | "terminal.ariaResizeFiles"
  | "terminal.hostList"
  | "terminal.hostSingleDoubleClickHint"
  | "terminal.modifyHostInfo"
  | "terminal.refreshHostMonitor"
  | "sftp.hostMonitor"
  | "sftp.refreshing"
  | "sftp.refresh"
  | "sftp.notConnected"
  | "sftp.copyIp"
  | "sftp.copied"
  | "sftp.memory"
  | "sftp.cpu"
  | "sftp.disk"
  | "sftp.lastUpdated"
  | "sftp.fileList"
  | "sftp.up"
  | "sftp.fileName"
  | "sftp.fileSize"
  | "sftp.modifiedAt"
  | "sftp.loading"
  | "sftp.emptyOrNoPermission"
  | "sftp.backToParent"
  | "sftp.parent"
  | "sftp.downloadFile"
  | "sftp.editTextFile"
  | "sftp.textEditor"
  | "sftp.editorPlaceholder"
  | "sftp.editorSave"
  | "sftp.editorSaving"
  | "sftp.editorSaved"
  | "sftp.editorMeta"
  | "sftp.editorTooLarge"
  | "sftp.editorTruncatedReadonly"
  | "sftp.editorLoadFailed"
  | "sftp.editorSaveFailed"
  | "sftp.unnamed"
  | "error.loadSessionsFailed"
  | "error.createSessionFailed"
  | "error.updateHostFailed"
  | "error.deleteFailed"
  | "error.sftpListFailed"
  | "error.pullOutputFailed"
  | "error.sendFailed"
  | "error.downloadFailed"
  | "error.resizeTerminalFailed"
  | "error.openFolderFailed"
  | "error.disconnectFailed"
  | "error.connectFailed"
  | "error.connectMissingPassword"
  | "prompt.inputSshPassword"
  | "status.connecting"
  | "status.connected"
  | "status.createdSession"
  | "status.updatedHost"
  | "status.deletedSession"
  | "status.disconnected"
  | "status.downloadedTo"
  | "terminal.workspace"
  | "terminal.back"
  | "terminal.disconnect"
  | "updater.checking"
  | "updater.latest"
  | "updater.confirm"
  | "updater.cancelled"
  | "updater.downloading"
  | "updater.startDownloading"
  | "updater.downloadingWithPercent"
  | "updater.downloadDoneInstalling"
  | "updater.installDoneRelaunch"
  | "updater.failed"
  | "status.idle";

type Dict = Record<I18nKey, string>;

const zhCN: Dict = {
  "lang.zh": "中文",
  "lang.en": "EN",
  "lang.switchToZh": "切换中文",
  "lang.switchToEn": "Switch to English",
  "top.subtitle": "SSH / Telnet 会话管理",
  "top.upgrade": "在线升级",
  "top.upgradeChecking": "检查升级中...",
  "top.online": "在线",
  "top.offline": "离线",
  "top.current": "当前：{name}",
  "top.noHostSelected": "未选择主机",
  "top.ariaLanguageSwitch": "语言切换",
  "home.hostList": "主机列表",
  "home.hostListHint": "点击行内“连接”或主机名即可新建会话标签",
  "home.emptyTitle": "还没有会话",
  "home.emptySubtitle": "添加一个会话后即可连接。",
  "home.ariaNoSession": "暂无会话",
  "home.audit": "审计日志",
  "home.auditTitle": "主机审计日志",
  "home.auditRefresh": "刷新",
  "home.auditEmpty": "暂无审计记录",
  "home.auditFilterAll": "全部",
  "home.auditFilterConnect": "连接",
  "home.auditFilterCommand": "命令",
  "home.auditFilterDisconnect": "断开",
  "home.auditSearchPlaceholder": "搜索主机、会话或命令",
  "home.auditExportCsv": "导出 CSV",
  "home.auditExportJson": "导出 JSON",
  "session.management": "主机管理",
  "session.addHost": "新增主机",
  "session.name": "名称",
  "session.host": "主机",
  "session.user": "用户",
  "session.protocol": "协议",
  "session.port": "端口",
  "session.status": "状态",
  "session.actions": "操作",
  "session.statusChecking": "检测中",
  "session.statusOnline": "在线",
  "session.statusOffline": "离线",
  "session.connect": "连接",
  "session.editHost": "编辑",
  "session.copy": "复制",
  "session.copySuffix": "副本",
  "session.deleteConfirm": "确定删除主机“{name}”吗？",
  "session.more": "复制",
  "session.moreViewDetail": "查看详情（占位）",
  "session.moreCopyConfig": "复制配置（占位）",
  "session.moreExport": "导出（占位）",
  "session.delete": "删除",
  "session.connectTitle": "连接 {name}",
  "session.copyIp": "复制 IP",
  "session.copied": "已复制",
  "modal.close": "关闭",
  "modal.cancel": "取消",
  "modal.save": "保存",
  "modal.testing": "测试中...",
  "modal.testConnection": "测试连接",
  "modal.testSuccess": "连接测试成功",
  "modal.testFailed": "连接测试失败",
  "modal.add": "添加",
  "modal.newHost": "新增主机",
  "modal.editHost": "编辑主机",
  "modal.modifyHostInfo": "修改主机信息",
  "form.name": "名称",
  "form.host": "主机",
  "form.port": "端口",
  "form.username": "用户名",
  "form.encoding": "编码 (utf-8/gbk)",
  "form.keepaliveSeconds": "保活秒数",
  "form.sshPassword": "SSH 密码",
  "form.sshPasswordOptional": "SSH 密码（可选）",
  "form.sshPasswordSaved": "SSH 密码（保存）",
  "form.secretOptional": "密钥（可选）",
  "form.toggleShowPassword": "显示密码",
  "form.toggleHidePassword": "隐藏密码",
  "toast.downloading": "下载中",
  "toast.done": "完成",
  "toast.failed": "失败",
  "toast.openFolder": "打开文件目录",
  "toast.downloadingHint": "正在下载到本地...",
  "toast.openFolderFailed": "打开目录失败: {message}",
  "terminal.noOpenedSession": "暂无打开的会话，点击左侧主机连接",
  "terminal.closeTab": "关闭标签",
  "terminal.duplicateSession": "复制 session",
  "terminal.closeRight": "关闭右边",
  "terminal.closeLeft": "关闭左边",
  "terminal.closeOthers": "关闭其他",
  "terminal.onlySshMonitor": "仅 SSH 会话支持监控指标",
  "terminal.ariaResizeHosts": "调整主机列表宽度",
  "terminal.ariaResizeFiles": "调整文件列表宽度",
  "terminal.hostList": "主机列表",
  "terminal.hostSingleDoubleClickHint": "单击选中，双击打开新的会话标签",
  "terminal.modifyHostInfo": "修改主机信息",
  "terminal.refreshHostMonitor": "刷新主机监控",
  "sftp.hostMonitor": "主机监控",
  "sftp.refreshing": "刷新中...",
  "sftp.refresh": "刷新",
  "sftp.notConnected": "未连接会话",
  "sftp.copyIp": "复制 IP",
  "sftp.copied": "已复制",
  "sftp.memory": "内存",
  "sftp.cpu": "CPU",
  "sftp.disk": "磁盘",
  "sftp.lastUpdated": "最近更新：{time}",
  "sftp.fileList": "SFTP 文件列表",
  "sftp.up": "上级",
  "sftp.fileName": "名称",
  "sftp.fileSize": "大小",
  "sftp.modifiedAt": "修改时间",
  "sftp.loading": "加载中...",
  "sftp.emptyOrNoPermission": "目录为空或无权限",
  "sftp.backToParent": "返回上一级目录",
  "sftp.parent": "上一级",
  "sftp.downloadFile": "下载文件",
  "sftp.editTextFile": "编辑文本",
  "sftp.textEditor": "文本编辑器",
  "sftp.editorPlaceholder": "此处显示文件内容",
  "sftp.editorSave": "保存",
  "sftp.editorSaving": "保存中...",
  "sftp.editorSaved": "已保存",
  "sftp.editorMeta": "已加载 {loaded} / {total}",
  "sftp.editorTooLarge": "文件过大（{size}），为避免卡顿已禁用编辑。",
  "sftp.editorTruncatedReadonly": "仅加载前 {loaded} / {total}，当前为只读预览。",
  "sftp.editorLoadFailed": "加载文本失败: {message}",
  "sftp.editorSaveFailed": "保存文本失败: {message}",
  "sftp.unnamed": "(未命名)",
  "error.loadSessionsFailed": "加载会话失败: {message}",
  "error.createSessionFailed": "创建会话失败: {message}",
  "error.updateHostFailed": "更新主机失败: {message}",
  "error.deleteFailed": "删除失败: {message}",
  "error.sftpListFailed": "SFTP 列表读取失败: {message}",
  "error.pullOutputFailed": "拉取输出失败: {message}",
  "error.sendFailed": "发送失败: {message}",
  "error.downloadFailed": "下载失败: {message}",
  "error.resizeTerminalFailed": "调整终端尺寸失败: {message}",
  "error.openFolderFailed": "打开目录失败: {message}",
  "error.disconnectFailed": "断开失败: {message}",
  "error.connectFailed": "连接失败: {message}",
  "error.connectMissingPassword": "连接失败: 缺少 SSH 密码",
  "prompt.inputSshPassword": "请输入 SSH 密码（将保存到本地配置文件）",
  "status.connecting": "连接中: {name}",
  "status.connected": "已连接: {name}",
  "status.createdSession": "已创建会话: {name}",
  "status.updatedHost": "已更新主机: {name}",
  "status.deletedSession": "已删除会话",
  "status.disconnected": "已断开",
  "status.downloadedTo": "已下载到: {path}",
  "terminal.workspace": "终端工作区",
  "terminal.back": "返回",
  "terminal.disconnect": "断开",
  "updater.checking": "检查新版本中...",
  "updater.latest": "当前已是最新版本 v{current}",
  "updater.confirm": "检测到新版本 v{next}（当前 v{current}）。\n是否立即下载并自动安装重启？",
  "updater.cancelled": "发现新版本 v{next}，已取消升级",
  "updater.downloading": "正在下载更新 v{next}...",
  "updater.startDownloading": "开始下载 v{next}...",
  "updater.downloadingWithPercent": "下载更新中 v{next}... {percent}%",
  "updater.downloadDoneInstalling": "更新包下载完成，正在安装 v{next}...",
  "updater.installDoneRelaunch": "安装完成，应用即将重启...",
  "updater.failed": "在线升级检查失败: {message}",
  "status.idle": "空闲",
};

const enUS: Dict = {
  "lang.zh": "中文",
  "lang.en": "EN",
  "lang.switchToZh": "Switch to Chinese",
  "lang.switchToEn": "Switch to English",
  "top.subtitle": "SSH / Telnet Session Manager",
  "top.upgrade": "Upgrade",
  "top.upgradeChecking": "Checking...",
  "top.online": "Online",
  "top.offline": "Offline",
  "top.current": "Current: {name}",
  "top.noHostSelected": "No host selected",
  "top.ariaLanguageSwitch": "Language switch",
  "home.hostList": "Hosts",
  "home.hostListHint": "Click Connect or host name to open a new tab",
  "home.emptyTitle": "No sessions yet",
  "home.emptySubtitle": "Add one session to start connecting.",
  "home.ariaNoSession": "No session",
  "home.audit": "Audit",
  "home.auditTitle": "Host Audit Logs",
  "home.auditRefresh": "Refresh",
  "home.auditEmpty": "No audit records yet",
  "home.auditFilterAll": "All",
  "home.auditFilterConnect": "Connect",
  "home.auditFilterCommand": "Command",
  "home.auditFilterDisconnect": "Disconnect",
  "home.auditSearchPlaceholder": "Search by host, session, or command",
  "home.auditExportCsv": "Export CSV",
  "home.auditExportJson": "Export JSON",
  "session.management": "Host Management",
  "session.addHost": "Add Host",
  "session.name": "Name",
  "session.host": "Host",
  "session.user": "User",
  "session.protocol": "Protocol",
  "session.port": "Port",
  "session.status": "Status",
  "session.actions": "Actions",
  "session.statusChecking": "Checking",
  "session.statusOnline": "Online",
  "session.statusOffline": "Offline",
  "session.connect": "Connect",
  "session.editHost": "Edit",
  "session.copy": "Duplicate",
  "session.copySuffix": "copy",
  "session.deleteConfirm": "Are you sure you want to delete host \"{name}\"?",
  "session.more": "Copy IP",
  "session.moreViewDetail": "View Details (placeholder)",
  "session.moreCopyConfig": "Copy Config (placeholder)",
  "session.moreExport": "Export (placeholder)",
  "session.delete": "Delete",
  "session.connectTitle": "Connect {name}",
  "session.copyIp": "Copy IP",
  "session.copied": "Copied",
  "modal.close": "Close",
  "modal.cancel": "Cancel",
  "modal.save": "Save",
  "modal.testing": "Testing...",
  "modal.testConnection": "Test Connection",
  "modal.testSuccess": "Connection test passed",
  "modal.testFailed": "Connection test failed",
  "modal.add": "Add",
  "modal.newHost": "Add Host",
  "modal.editHost": "Edit Host",
  "modal.modifyHostInfo": "Modify Host Info",
  "form.name": "Name",
  "form.host": "Host",
  "form.port": "Port",
  "form.username": "Username",
  "form.encoding": "Encoding (utf-8/gbk)",
  "form.keepaliveSeconds": "Keepalive Seconds",
  "form.sshPassword": "SSH Password",
  "form.sshPasswordOptional": "SSH Password (optional)",
  "form.sshPasswordSaved": "SSH Password (saved)",
  "form.secretOptional": "Secret (optional)",
  "form.toggleShowPassword": "Show password",
  "form.toggleHidePassword": "Hide password",
  "toast.downloading": "Downloading",
  "toast.done": "Done",
  "toast.failed": "Failed",
  "toast.openFolder": "Open folder",
  "toast.downloadingHint": "Downloading to local path...",
  "toast.openFolderFailed": "Open folder failed: {message}",
  "terminal.noOpenedSession": "No opened sessions. Click a host on the left to connect",
  "terminal.closeTab": "Close tab",
  "terminal.duplicateSession": "Duplicate session",
  "terminal.closeRight": "Close right",
  "terminal.closeLeft": "Close left",
  "terminal.closeOthers": "Close others",
  "terminal.onlySshMonitor": "Host metrics are available for SSH sessions only",
  "terminal.ariaResizeHosts": "Resize hosts panel",
  "terminal.ariaResizeFiles": "Resize files panel",
  "terminal.hostList": "Hosts",
  "terminal.hostSingleDoubleClickHint": "Single click to select, double click to open a new tab",
  "terminal.modifyHostInfo": "Modify Host Info",
  "terminal.refreshHostMonitor": "Refresh Host Metrics",
  "sftp.hostMonitor": "Host Metrics",
  "sftp.refreshing": "Refreshing...",
  "sftp.refresh": "Refresh",
  "sftp.notConnected": "No active session",
  "sftp.copyIp": "Copy IP",
  "sftp.copied": "Copied",
  "sftp.memory": "Memory",
  "sftp.cpu": "CPU",
  "sftp.disk": "Disk",
  "sftp.lastUpdated": "Last updated: {time}",
  "sftp.fileList": "SFTP Files",
  "sftp.up": "Up",
  "sftp.fileName": "Name",
  "sftp.fileSize": "Size",
  "sftp.modifiedAt": "Modified",
  "sftp.loading": "Loading...",
  "sftp.emptyOrNoPermission": "Directory is empty or no permission",
  "sftp.backToParent": "Back to parent directory",
  "sftp.parent": "Parent",
  "sftp.downloadFile": "Download file",
  "sftp.editTextFile": "Edit text",
  "sftp.textEditor": "Text Editor",
  "sftp.editorPlaceholder": "File content appears here",
  "sftp.editorSave": "Save",
  "sftp.editorSaving": "Saving...",
  "sftp.editorSaved": "Saved",
  "sftp.editorMeta": "Loaded {loaded} / {total}",
  "sftp.editorTooLarge": "File is too large ({size}), editing is disabled to keep performance stable.",
  "sftp.editorTruncatedReadonly": "Loaded first {loaded} / {total}. Editor is read-only preview.",
  "sftp.editorLoadFailed": "Load text failed: {message}",
  "sftp.editorSaveFailed": "Save text failed: {message}",
  "sftp.unnamed": "(unnamed)",
  "error.loadSessionsFailed": "Load sessions failed: {message}",
  "error.createSessionFailed": "Create session failed: {message}",
  "error.updateHostFailed": "Update host failed: {message}",
  "error.deleteFailed": "Delete failed: {message}",
  "error.sftpListFailed": "Read SFTP list failed: {message}",
  "error.pullOutputFailed": "Pull output failed: {message}",
  "error.sendFailed": "Send failed: {message}",
  "error.downloadFailed": "Download failed: {message}",
  "error.resizeTerminalFailed": "Resize terminal failed: {message}",
  "error.openFolderFailed": "Open folder failed: {message}",
  "error.disconnectFailed": "Disconnect failed: {message}",
  "error.connectFailed": "Connect failed: {message}",
  "error.connectMissingPassword": "Connect failed: missing SSH password",
  "prompt.inputSshPassword": "Input SSH password (will be stored locally)",
  "status.connecting": "Connecting: {name}",
  "status.connected": "Connected: {name}",
  "status.createdSession": "Created session: {name}",
  "status.updatedHost": "Updated host: {name}",
  "status.deletedSession": "Session deleted",
  "status.disconnected": "Disconnected",
  "status.downloadedTo": "Downloaded to: {path}",
  "terminal.workspace": "Terminal Workspace",
  "terminal.back": "Back",
  "terminal.disconnect": "Disconnect",
  "updater.checking": "Checking for updates...",
  "updater.latest": "Already up to date: v{current}",
  "updater.confirm":
    "New version v{next} detected (current v{current}).\nDownload, install, and relaunch now?",
  "updater.cancelled": "New version v{next} detected, upgrade canceled",
  "updater.downloading": "Downloading update v{next}...",
  "updater.startDownloading": "Start downloading v{next}...",
  "updater.downloadingWithPercent": "Downloading v{next}... {percent}%",
  "updater.downloadDoneInstalling": "Download complete, installing v{next}...",
  "updater.installDoneRelaunch": "Install complete, relaunching...",
  "updater.failed": "Update check failed: {message}",
  "status.idle": "Idle",
};

const dictionaries: Record<Lang, Dict> = {
  "zh-CN": zhCN,
  "en-US": enUS,
};

export function detectInitialLang(): Lang {
  const saved = localStorage.getItem("rshell.lang");
  if (saved === "zh-CN" || saved === "en-US") return saved;
  const locale = navigator.language.toLowerCase();
  return locale.startsWith("zh") ? "zh-CN" : "en-US";
}

export function setLangStorage(lang: Lang) {
  localStorage.setItem("rshell.lang", lang);
}

export function t(lang: Lang, key: I18nKey, vars?: Record<string, string | number>): string {
  let text = dictionaries[lang][key];
  if (!vars) return text;
  for (const [name, value] of Object.entries(vars)) {
    text = text.replace(new RegExp(`\\{${name}\\}`, "g"), String(value));
  }
  return text;
}

