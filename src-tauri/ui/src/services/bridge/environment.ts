import { invoke } from "@tauri-apps/api/core";

export async function listEnvironments(): Promise<string[]> {
  return invoke("list_environments");
}

export async function getCurrentEnvironment(): Promise<string> {
  return invoke("get_current_environment");
}

export async function createEnvironment(name: string): Promise<string[]> {
  return invoke("create_environment", { name });
}

export async function renameCurrentEnvironment(newName: string): Promise<string> {
  return invoke("rename_current_environment", { newName });
}

export async function switchEnvironment(name: string): Promise<string> {
  return invoke("switch_environment", { name });
}
