import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { LLMConfig } from '../types';

export function useConfigs() {
  const [configs, setConfigs] = useState<LLMConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke<LLMConfig[]>('list_model_configs')
      .then(setConfigs)
      .finally(() => setLoading(false));
  }, []);

  const addConfig = async (config: Omit<LLMConfig, 'id' | 'createdAt' | 'updatedAt'>) => {
    const saved = await invoke<LLMConfig>('upsert_model_config', { input: config });
    setConfigs(prev => [...prev, saved]);
    return saved;
  };

  const updateConfig = async (id: string, updated: Partial<Omit<LLMConfig, 'id' | 'createdAt' | 'updatedAt'>>) => {
    const existing = configs.find(c => c.id === id);
    if (!existing) return;
    const saved = await invoke<LLMConfig>('upsert_model_config', { input: { ...existing, ...updated, id } });
    setConfigs(prev => prev.map(c => c.id === id ? saved : c));
    return saved;
  };

  const deleteConfig = async (id: string) => {
    await invoke('delete_model_config', { id });
    setConfigs(prev => prev.filter(c => c.id !== id));
  };

  return { configs, loading, addConfig, updateConfig, deleteConfig };
}
