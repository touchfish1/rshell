import { invoke } from "@tauri-apps/api/core";
import type { EtcdConnection, EtcdConnectionInput, EtcdKeyValue } from "../types";

export async function listEtcdConnections(): Promise<EtcdConnection[]> {
  return invoke("list_etcd_connections");
}

export async function createEtcdConnection(input: EtcdConnectionInput, secret?: string): Promise<EtcdConnection> {
  return invoke("create_etcd_connection", { input, secret });
}

export async function updateEtcdConnection(id: string, input: EtcdConnectionInput, secret?: string): Promise<EtcdConnection> {
  return invoke("update_etcd_connection", { id, input, secret });
}

export async function deleteEtcdConnection(id: string): Promise<void> {
  await invoke("delete_etcd_connection", { id });
}

export async function hasEtcdSecret(id: string): Promise<boolean> {
  return invoke("has_etcd_secret", { id });
}

export async function getEtcdSecret(id: string): Promise<string | null> {
  return invoke("get_etcd_secret", { id });
}

export async function connectEtcd(id: string, secret?: string): Promise<void> {
  await invoke("connect_etcd", { id, secret });
}

export async function disconnectEtcd(id: string): Promise<void> {
  await invoke("disconnect_etcd", { id });
}

export async function etcdListKeys(id: string, prefix: string): Promise<string[]> {
  return invoke("etcd_list_keys", { id, prefix });
}

export async function etcdGetValue(id: string, key: string): Promise<EtcdKeyValue | null> {
  return invoke("etcd_get_value", { id, key });
}

export async function etcdSetValue(id: string, key: string, value: string): Promise<void> {
  await invoke("etcd_set_value", { id, key, value });
}

export async function etcdDeleteKey(id: string, key: string): Promise<void> {
  await invoke("etcd_delete_key", { id, key });
}
