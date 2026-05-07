import { invoke } from "@tauri-apps/api/core";
import type { ZkNodeData, ZookeeperConnection, ZookeeperConnectionInput } from "../types";

export async function listZookeeperConnections(): Promise<ZookeeperConnection[]> {
  return invoke("list_zookeeper_connections");
}

export async function createZookeeperConnection(
  input: ZookeeperConnectionInput,
  secret?: string
): Promise<ZookeeperConnection> {
  return invoke("create_zookeeper_connection", { input, secret });
}

export async function updateZookeeperConnection(
  id: string,
  input: ZookeeperConnectionInput,
  secret?: string
): Promise<ZookeeperConnection> {
  return invoke("update_zookeeper_connection", { id, input, secret });
}

export async function deleteZookeeperConnection(id: string): Promise<void> {
  await invoke("delete_zookeeper_connection", { id });
}

export async function hasZookeeperSecret(id: string): Promise<boolean> {
  return invoke("has_zookeeper_secret", { id });
}

export async function getZookeeperSecret(id: string): Promise<string | null> {
  return invoke("get_zookeeper_secret", { id });
}

export async function connectZookeeper(id: string, secret?: string): Promise<void> {
  await invoke("connect_zookeeper", { id, secret });
}

export async function testZookeeperConnection(
  connectString: string,
  sessionTimeoutMs?: number,
  secret?: string
): Promise<void> {
  await invoke("test_zookeeper_connection", {
    connectString,
    sessionTimeoutMs: sessionTimeoutMs ?? null,
    secret: secret ?? null,
  });
}

export async function disconnectZookeeper(id: string): Promise<void> {
  await invoke("disconnect_zookeeper", { id });
}

export async function zkListChildren(id: string, path: string): Promise<string[]> {
  return invoke("zk_list_children", { id, path });
}

export async function zkGetData(id: string, path: string): Promise<ZkNodeData> {
  return invoke("zk_get_data", { id, path });
}

export async function zkSetData(id: string, path: string, dataUtf8: string): Promise<void> {
  await invoke("zk_set_data", { id, path, dataUtf8 });
}
