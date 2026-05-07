/**
 * 前端与 Tauri 后端的薄封装：`invoke` 各命令、`listen` 审计事件，类型与 `types.ts` 对齐。
 *
 * 按领域拆分为 bridge/ 子模块，此文件为统一导出入口。
 * 新增函数请放入对应子模块，再从此文件导出。
 */
export {
  listSessions,
  createSession,
  updateSession,
  deleteSession,
  hasSessionSecret,
  getSessionSecret,
  connectSession,
  pullOutput,
  disconnectSession,
  sendInput,
  resizeTerminal,
  listSftpDir,
  downloadSftpFile,
  readSftpTextFile,
  saveSftpTextFile,
  uploadSftpFile,
  openInFileManager,
  openExternalUrl,
  testHostReachability,
  getHostMetrics,
  listAudits,
  onTerminalOutput,
  onDebugLog,
} from "./bridge/session";

export {
  listZookeeperConnections,
  createZookeeperConnection,
  updateZookeeperConnection,
  deleteZookeeperConnection,
  hasZookeeperSecret,
  getZookeeperSecret,
  connectZookeeper,
  testZookeeperConnection,
  disconnectZookeeper,
  zkListChildren,
  zkGetData,
  zkSetData,
} from "./bridge/zookeeper";

export {
  listRedisConnections,
  createRedisConnection,
  updateRedisConnection,
  deleteRedisConnection,
  getRedisSecret,
  connectRedis,
  testRedisConnection,
  disconnectRedis,
  redisListKeys,
  redisGetValue,
  redisSetValue,
  redisScanKeys,
  redisListDatabases,
  redisGetKeyData,
  redisSetKeyData,
  redisSetTtl,
} from "./bridge/redis";

export {
  listMySqlConnections,
  createMySqlConnection,
  updateMySqlConnection,
  deleteMySqlConnection,
  getMySqlSecret,
  connectMySql,
  testMySqlConnection,
  disconnectMySql,
  mySqlListDatabases,
  mySqlListTables,
  mySqlListColumns,
  mySqlExecuteQuery,
  mySqlExplainQuery,
  mySqlAlterTableAddColumn,
} from "./bridge/mysql";

export {
  listPostgreSqlConnections,
  createPostgreSqlConnection,
  updatePostgreSqlConnection,
  deletePostgreSqlConnection,
  getPostgreSqlSecret,
  connectPostgreSql,
  testPostgreSqlConnection,
  disconnectPostgreSql,
  postgreSqlListDatabases,
  postgreSqlListTables,
  postgreSqlListColumns,
  postgreSqlExecuteQuery,
  postgreSqlExplainQuery,
} from "./bridge/postgresql";

export {
  listEnvironments,
  getCurrentEnvironment,
  createEnvironment,
  renameCurrentEnvironment,
  switchEnvironment,
} from "./bridge/environment";

export {
  listEtcdConnections,
  createEtcdConnection,
  updateEtcdConnection,
  deleteEtcdConnection,
  hasEtcdSecret,
  getEtcdSecret,
  connectEtcd,
  disconnectEtcd,
  etcdListKeys,
  etcdGetValue,
  etcdSetValue,
  etcdDeleteKey,
} from "./bridge/etcd";
