import { invoke } from "@tauri-apps/api/core";
import type {
  RedisConnection,
  RedisConnectionInput,
  RedisDatabaseInfo,
  RedisKeyData,
  RedisKeyRef,
  RedisScanResult,
  RedisValueData,
  RedisValueUpdate,
} from "../types";

export async function listRedisConnections(): Promise<RedisConnection[]> {
  return invoke("list_redis_connections");
}

export async function createRedisConnection(
  input: RedisConnectionInput,
  secret?: string
): Promise<RedisConnection> {
  return invoke("create_redis_connection", { input, secret });
}

export async function updateRedisConnection(
  id: string,
  input: RedisConnectionInput,
  secret?: string
): Promise<RedisConnection> {
  return invoke("update_redis_connection", { id, input, secret });
}

export async function deleteRedisConnection(id: string): Promise<void> {
  await invoke("delete_redis_connection", { id });
}

export async function getRedisSecret(id: string): Promise<string | null> {
  return invoke("get_redis_secret", { id });
}

export async function connectRedis(id: string, secret?: string): Promise<void> {
  await invoke("connect_redis", { id, secret });
}

export async function testRedisConnection(address: string, db?: number, secret?: string): Promise<void> {
  await invoke("test_redis_connection", {
    address,
    db: db ?? null,
    secret: secret ?? null,
  });
}

export async function disconnectRedis(id: string): Promise<void> {
  await invoke("disconnect_redis", { id });
}

export async function redisListKeys(id: string, pattern?: string): Promise<string[]> {
  return invoke("redis_list_keys", { id, pattern: pattern ?? null });
}

export async function redisGetValue(id: string, keyBase64: string): Promise<RedisValueData> {
  return invoke("redis_get_value", { id, keyBase64 });
}

export async function redisSetValue(id: string, keyBase64: string, value: string): Promise<void> {
  await invoke("redis_set_value", { id, keyBase64, value });
}

export async function redisScanKeys(
  id: string,
  cursor = 0,
  pattern?: string,
  count = 50
): Promise<RedisScanResult> {
  return invoke("redis_scan_keys", {
    id,
    cursor,
    pattern: pattern ?? null,
    count,
  });
}

export async function redisListDatabases(id: string): Promise<RedisDatabaseInfo[]> {
  return invoke("redis_list_databases", { id });
}

export async function redisGetKeyData(id: string, keyBase64: string): Promise<RedisKeyData> {
  return invoke("redis_get_key_data", { id, keyBase64 });
}

export async function redisSetKeyData(id: string, keyBase64: string, payload: RedisValueUpdate): Promise<void> {
  await invoke("redis_set_key_data", { id, keyBase64, payload });
}

export async function redisSetTtl(id: string, keyBase64: string, ttlSeconds?: number): Promise<void> {
  await invoke("redis_set_ttl", { id, keyBase64, ttlSeconds: ttlSeconds ?? null });
}
