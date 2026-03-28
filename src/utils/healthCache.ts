import { invoke } from '@tauri-apps/api/core';
import { ModelHealthResult } from '../types';

export interface HealthCache {
  results: ModelHealthResult[];
  checkedAt: number; // unix ms
}

export async function saveHealthCache(configId: string, results: ModelHealthResult[]) {
  await invoke('save_model_health_cache', { configId, results });
}

export async function loadHealthCache(configId: string): Promise<HealthCache | null> {
  try {
    const results = await invoke<ModelHealthResult[] | null>('load_model_health_cache', { configId });
    if (!results || results.length === 0) return null;
    const checkedAt = results[0]?.checked_at
      ? new Date(results[0].checked_at as unknown as string).getTime()
      : Date.now();
    return { results, checkedAt };
  } catch {
    return null;
  }
}

export async function removeHealthCache(configId: string) {
  await invoke('remove_model_health_cache', { configId });
}

export function formatCheckedAt(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
