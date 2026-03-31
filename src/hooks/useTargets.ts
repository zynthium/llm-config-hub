import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ExportTarget } from '../types';

export function useTargets() {
  const [targets, setTargets] = useState<ExportTarget[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke<ExportTarget[]>('list_targets')
      .then(setTargets)
      .catch((err) => console.error('Failed to load targets:', err))
      .finally(() => setLoading(false));
  }, []);

  const addTarget = async (target: Omit<ExportTarget, 'id'>) => {
    try {
      const saved = await invoke<ExportTarget>('upsert_target', { target });
      setTargets(prev => [...prev, saved]);
      return saved;
    } catch (err) {
      console.error('Failed to add target:', err);
      throw err;
    }
  };

  const updateTarget = async (id: string, target: Omit<ExportTarget, 'id'>) => {
    try {
      const saved = await invoke<ExportTarget>('upsert_target', { target: { ...target, id } });
      setTargets(prev => prev.map(t => t.id === id ? saved : t));
      return saved;
    } catch (err) {
      console.error('Failed to update target:', err);
      throw err;
    }
  };

  const deleteTarget = async (id: string) => {
    try {
      await invoke('delete_target', { id });
      setTargets(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error('Failed to delete target:', err);
      throw err;
    }
  };

  return { targets, loading, addTarget, updateTarget, deleteTarget };
}
