import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { LLMConfig } from '../types';

export function useConfigs() {
  const [configs, setConfigs] = useState<LLMConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke<LLMConfig[]>('list_model_configs')
      .then(setConfigs)
      .catch((err) => console.error('Failed to load configs:', err))
      .finally(() => setLoading(false));
  }, []);

  const addConfig = async (config: Omit<LLMConfig, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const saved = await invoke<LLMConfig>('upsert_model_config', { input: config });
      setConfigs(prev => [...prev, saved]);
      return saved;
    } catch (err) {
      console.error('Failed to add config:', err);
      throw err;
    }
  };

  const updateConfig = async (id: string, updated: Partial<Omit<LLMConfig, 'id' | 'createdAt' | 'updatedAt'>>) => {
    try {
      const existing = configs.find(c => c.id === id);
      if (!existing) return;
      const saved = await invoke<LLMConfig>('upsert_model_config', { input: { ...existing, ...updated, id } });
      setConfigs(prev => prev.map(c => c.id === id ? saved : c));
      return saved;
    } catch (err) {
      console.error('Failed to update config:', err);
      throw err;
    }
  };

  const deleteConfig = async (id: string) => {
    try {
      await invoke('delete_model_config', { id });
      setConfigs(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.error('Failed to delete config:', err);
      throw err;
    }
  };

  return { configs, loading, addConfig, updateConfig, deleteConfig };
}
