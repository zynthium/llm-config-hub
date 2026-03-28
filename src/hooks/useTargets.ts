import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ExportTarget } from '../types';

export function useTargets() {
  const [targets, setTargets] = useState<ExportTarget[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke<ExportTarget[]>('list_targets')
      .then(setTargets)
      .finally(() => setLoading(false));
  }, []);

  const addTarget = async (target: Omit<ExportTarget, 'id'>) => {
    const saved = await invoke<ExportTarget>('upsert_target', { target });
    setTargets(prev => [...prev, saved]);
    return saved;
  };

  const updateTarget = async (id: string, target: Omit<ExportTarget, 'id'>) => {
    const saved = await invoke<ExportTarget>('upsert_target', { target: { ...target, id } });
    setTargets(prev => prev.map(t => t.id === id ? saved : t));
    return saved;
  };

  const deleteTarget = async (id: string) => {
    await invoke('delete_target', { id });
    setTargets(prev => prev.filter(t => t.id !== id));
  };

  return { targets, loading, addTarget, updateTarget, deleteTarget };
}
