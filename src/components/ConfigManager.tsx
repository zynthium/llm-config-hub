import React, { useState, useEffect, useRef } from 'react';
import { useLocalStorage } from 'react-use';
import { saveHealthCache, loadHealthCache, removeHealthCache, formatCheckedAt } from '../utils/healthCache';
import { invoke } from '@tauri-apps/api/core';
import { Plus, Edit2, Trash2, Copy, Eye, EyeOff, Check, Database, CheckCircle2, XCircle, HelpCircle, LayoutGrid, List, Tag, Send, Play, Loader2, Filter, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { LLMConfig, ModelHealthResult } from '../types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/Select';
import { Button } from './ui/Button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './ui/Table';
import { Badge } from './ui/Badge';
import ConfigModal from './ConfigModal';
import DeployModal from './DeployModal';
import ConfirmModal from './ConfirmModal';

export default function ConfigManager({ configs, targets, addConfig, updateConfig, deleteConfig }: any) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<LLMConfig | null>(null);
  const [deployConfig, setDeployConfig] = useState<LLMConfig | null>(null);
  const [configToDelete, setConfigToDelete] = useState<LLMConfig | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useLocalStorage<'card' | 'list'>('llm-hub:viewMode', 'list');
  const [selectedTag, setSelectedTag] = useLocalStorage<string>('llm-hub:selectedTag', 'all');
  const [selectedStatus, setSelectedStatus] = useLocalStorage<string>('llm-hub:selectedStatus', 'valid');
  const [testingIds, setTestingIds] = useState<Record<string, boolean>>({});
  const testingRefs = useRef<Set<string>>(new Set());
  const [modelResults, setModelResults] = useState<Record<string, ModelHealthResult[]>>({});
  const [modelCheckedAt, setModelCheckedAt] = useState<Record<string, number>>({});
  const [modelExpanded, setModelExpanded] = useState<Record<string, boolean>>({});
  const [testingModels, setTestingModels] = useState<Record<string, boolean>>({});

  const allTags = Array.from(new Set(configs.flatMap((c: LLMConfig) => c.tags || []))).sort();
  const filteredConfigs = configs.filter((c: LLMConfig) => {
    const matchTag = selectedTag === 'all' || (c.tags && c.tags.includes(selectedTag));
    const matchStatus = selectedStatus === 'all' || c.status === selectedStatus || (selectedStatus === 'untested' && !c.status);
    return matchTag && matchStatus;
  });

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const testConnection = async (config: LLMConfig) => {
    if (testingRefs.current.has(config.id)) return;
    testingRefs.current.add(config.id);
    setTestingIds(prev => ({ ...prev, [config.id]: true }));
    try {
      const result: { status: string } = await invoke('check_config_health', { configId: config.id });
      updateConfig(config.id, { ...config, status: result.status === 'ok' ? 'valid' : 'invalid' });
    } catch (error) {
      console.error('Test failed:', error);
      updateConfig(config.id, { ...config, status: 'invalid' });
    } finally {
      testingRefs.current.delete(config.id);
      setTestingIds(prev => ({ ...prev, [config.id]: false }));
    }
  };

  const testModels = async (config: LLMConfig) => {
    if (testingModels[config.id]) return;
    setTestingModels(prev => ({ ...prev, [config.id]: true }));
    setModelExpanded(prev => ({ ...prev, [config.id]: true }));
    try {
      const results: ModelHealthResult[] = await invoke('check_config_models_health', { configId: config.id });
      setModelResults(prev => ({ ...prev, [config.id]: results }));
      const now = Date.now();
      setModelCheckedAt(prev => ({ ...prev, [config.id]: now }));
      await saveHealthCache(config.id, results);
    } catch (err) {
      console.error('Model health check failed:', err);
    } finally {
      setTestingModels(prev => ({ ...prev, [config.id]: false }));
    }
  };

  const retestAll = async () => {
    for (const config of configs) {
      testConnection(config);
    }
  };

  const isRetestingAll = configs.length > 0 && configs.every((c: LLMConfig) => testingIds[c.id]);

  const toggleModelExpanded = (configId: string, config: LLMConfig) => {
    const next = !modelExpanded[configId];
    setModelExpanded(prev => ({ ...prev, [configId]: next }));
    if (next && !modelResults[configId] && !testingModels[configId]) {
      testModels(config);
    }
  };

  useEffect(() => {
    const loadCaches = async () => {
    const cachedResults: Record<string, ModelHealthResult[]> = {};
    const cachedAt: Record<string, number> = {};
    for (const c of configs) {
      const cache = await loadHealthCache(c.id);
      if (cache) {
        cachedResults[c.id] = cache.results;
        cachedAt[c.id] = cache.checkedAt;
      }
    }
    if (Object.keys(cachedResults).length > 0) {
      setModelResults(prev => ({ ...cachedResults, ...prev }));
      setModelCheckedAt(prev => ({ ...cachedAt, ...prev }));
    }
    };
    loadCaches();
  }, []);

  useEffect(() => {
    const untestedConfigs = configs.filter((c: LLMConfig) => !c.status || c.status === 'untested');
    untestedConfigs.forEach((config: LLMConfig) => {
      testConnection(config);
    });
  }, [configs]);

  const getStatusIcon = (status?: string, id?: string) => {
    if (id && testingIds[id]) return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
    if (status === 'valid') return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    if (status === 'invalid') return <XCircle className="w-4 h-4 text-red-500" />;
    return <HelpCircle className="w-4 h-4 text-gray-400" />;
  };

  const renderModelHealth = (config: LLMConfig) => {
    const results = modelResults[config.id];
    const loading = testingModels[config.id];
    const expanded = modelExpanded[config.id];
    return (
      <div className="border-t border-gray-100 mt-3 pt-3">
        <button
          className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 w-full text-left"
          onClick={() => toggleModelExpanded(config.id, config)}
        >
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          <span>Models</span>
          {results && (
            <span className="ml-1 text-gray-400">
              ({results.filter(r => r.status === 'ok').length}/{results.length} available)
            </span>
          )}
          {loading && <Loader2 className="w-3 h-3 animate-spin ml-1 text-blue-500" />}
          <div className="ml-auto flex items-center gap-1.5">
            {modelCheckedAt[config.id] && !loading && (
              <span className="text-gray-300 text-xs">{formatCheckedAt(modelCheckedAt[config.id])}</span>
            )}
            <button
              className="text-gray-400 hover:text-blue-500"
              onClick={e => { e.stopPropagation(); testModels(config); }}
              title="Refresh"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
        </button>
        {expanded && (
          <div className="mt-2 space-y-1">
            {loading && !results && (
              <p className="text-xs text-gray-400 pl-5">Checking models...</p>
            )}
            {results && results.length === 0 && (
              <p className="text-xs text-gray-400 pl-5">No models found.</p>
            )}
            {results && [...results].sort((a, b) => {
              if (a.status !== b.status) return a.status === 'ok' ? -1 : 1;
              return a.model.localeCompare(b.model);
            }).map(r => (
              <div key={r.model} className="group flex items-center gap-2 pl-5">
                {r.status === 'ok'
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                <span className="text-xs text-gray-700 font-mono truncate flex-1">{r.model}</span>
                <span className="text-xs text-gray-400 shrink-0">{r.latency_ms}ms</span>
                {r.error_type && (
                  <span className="text-xs text-red-400 shrink-0">{r.error_type}</span>
                )}
                <button
                  onClick={() => navigator.clipboard.writeText(r.model)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-700"
                  title="复制模型名称"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-hidden">
      <div className="flex-shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">API Configurations</h2>
          <p className="text-gray-500 text-xs mt-0.5">Manage your LLM API keys and base URLs.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 h-7 bg-white border border-gray-200 rounded-md px-2 shadow-sm">
            <Filter className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="border-0 shadow-none bg-transparent text-xs text-gray-700 h-auto py-0 px-0 focus:ring-0 w-auto min-w-[72px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="valid">Valid</SelectItem>
                <SelectItem value="invalid">Invalid</SelectItem>
                <SelectItem value="untested">Untested</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-gray-400 border-l border-gray-200 pl-1.5">{filteredConfigs.length}/{configs.length}</span>
            <button
              onClick={retestAll}
              disabled={isRetestingAll}
              className="text-gray-400 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="重新测试所有连通性"
            >
              <RefreshCw className={`w-3 h-3 ${isRetestingAll ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {allTags.length > 0 && (
            <div className="flex items-center gap-1.5 h-7 bg-white border border-gray-200 rounded-md px-2 shadow-sm">
              <Tag className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <Select value={selectedTag} onValueChange={setSelectedTag}>
                <SelectTrigger className="border-0 shadow-none bg-transparent text-xs text-gray-700 h-auto py-0 px-0 focus:ring-0 w-auto min-w-[60px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tags</SelectItem>
                  {allTags.map((tag: any) => (
                    <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex h-7 bg-gray-100 p-0.5 rounded-md">
            <button
              onClick={() => setViewMode('card')}
              className={`px-1.5 rounded transition-colors ${viewMode === 'card' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-700'}`}
              title="Card View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-700'}`}
              title="List View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            onClick={() => { setEditingConfig(null); setIsModalOpen(true); }}
            className="flex items-center gap-1.5 h-7 px-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium whitespace-nowrap transition-colors ml-auto sm:ml-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        {configs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
          <Database className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No configurations yet</h3>
          <p className="text-gray-500 text-sm mb-4">Add your first API key and base URL to get started.</p>
          <Button
            variant="ghost"
            onClick={() => { setEditingConfig(null); setIsModalOpen(true); }}
            className="text-blue-600 font-medium text-sm hover:text-blue-700 p-0 h-auto"
          >
            + Add Configuration
          </Button>
        </div>
      ) : filteredConfigs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
          <Tag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No configurations found</h3>
          <p className="text-gray-500 text-sm mb-4">No configurations match the selected tag.</p>
          <Button
            variant="ghost"
            onClick={() => setSelectedTag('all')}
            className="text-blue-600 font-medium text-sm hover:text-blue-700 p-0 h-auto"
          >
            Clear Filter
          </Button>
        </div>
      ) : viewMode === 'list' ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Billing</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredConfigs.map((config: LLMConfig) => (
                <React.Fragment key={config.id}>
                <TableRow>
                  <TableCell className="font-medium text-gray-900">
                    <div className="flex items-center gap-1">
                      {config.name}
                      <div title={`Status: ${config.status || 'untested'}`}>
                        {getStatusIcon(config.status, config.id)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-600">{config.provider}</TableCell>
                  <TableCell>
                    <Badge variant={config.billingType === 'free' ? 'free' : 'paid'}>
                      {config.billingType === 'free' ? 'Free' : 'Paid'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {config.tags?.map(tag => (
                        <Badge key={tag} variant="tag">{tag}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => toggleModelExpanded(config.id, config)} className={`p-1 hover:bg-blue-50 ${modelExpanded[config.id] ? 'text-blue-600' : 'text-gray-400 hover:text-blue-600'}`} title="Show Models">
                        {modelExpanded[config.id] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => testConnection(config)} disabled={testingIds[config.id]} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50" title="Test Connection">
                        <Play className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeployConfig(config)} className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50" title="Deploy to Target">
                        <Send className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { setEditingConfig(config); setIsModalOpen(true); }} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50">
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setConfigToDelete(config)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {modelExpanded[config.id] && (
                  <TableRow key={`${config.id}-models`} className="bg-gray-50 hover:bg-gray-50">
                    <TableCell colSpan={5} className="px-6 py-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Models</span>
                        {modelResults[config.id] && (
                          <span className="text-xs text-gray-400">
                            ({modelResults[config.id].filter(r => r.status === 'ok').length}/{modelResults[config.id].length} available)
                          </span>
                        )}
                        {testingModels[config.id] && <Loader2 className="w-3 h-3 animate-spin text-blue-500" />}
                        <div className="ml-auto flex items-center gap-1.5">
                          {modelCheckedAt[config.id] && !testingModels[config.id] && (
                            <span className="text-xs text-gray-300">{formatCheckedAt(modelCheckedAt[config.id])}</span>
                          )}
                          <button onClick={() => testModels(config)} className="text-gray-400 hover:text-blue-500" title="Refresh">
                            <RefreshCw className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      {testingModels[config.id] && !modelResults[config.id] && (
                        <p className="text-xs text-gray-400">Checking models...</p>
                      )}
                      <div className="flex flex-col gap-1">
                        {modelResults[config.id] && [...modelResults[config.id]].sort((a, b) => {
                          if (a.status !== b.status) return a.status === 'ok' ? -1 : 1;
                          return a.model.localeCompare(b.model);
                        }).map(r => (
                          <div key={r.model} className="group flex items-center gap-1.5">
                            {r.status === 'ok'
                              ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                              : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                            <span className="text-xs font-mono text-gray-700">{r.model}</span>
                            <span className="text-xs text-gray-400">{r.latency_ms}ms</span>
                            <button
                              onClick={() => setDeployConfig({ ...config, defaultModel: r.model })}
                              disabled={r.status !== 'ok'}
                              className={`opacity-0 group-hover:opacity-100 transition-opacity ${r.status === 'ok' ? 'text-gray-400 hover:text-green-600' : 'text-gray-200 cursor-not-allowed'}`}
                              title={r.status === 'ok' ? 'Deploy this model' : 'Model unavailable; cannot deploy'}
                            >
                              <Send className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => navigator.clipboard.writeText(r.model)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-700"
                              title="复制模型名称"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredConfigs.map((config: LLMConfig) => (
            <div key={config.id} className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-semibold text-gray-900">{config.name}</h3>
                    <div title={`Status: ${config.status || 'untested'}`}>
                      {getStatusIcon(config.status, config.id)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="inline-block px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded font-medium">
                      {config.provider}
                    </span>
                    <span className={`inline-block px-1.5 py-0.5 text-xs rounded font-medium ${config.billingType === 'free' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
                      {config.billingType === 'free' ? 'Free' : 'Paid'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-0.5">
                  <Button variant="ghost" size="icon" onClick={() => testConnection(config)} disabled={testingIds[config.id]} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50" title="Test Connection">
                    <Play className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeployConfig(config)} className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50" title="Deploy to Target">
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => { setEditingConfig(config); setIsModalOpen(true); }} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50">
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setConfigToDelete(config)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <div>
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Base URL</label>
                  <div className="flex items-center gap-1 mt-0.5">
                    <code className="flex-1 bg-gray-50 px-2 py-1 rounded text-xs text-gray-800 border border-gray-100 truncate">
                      {config.baseUrl || 'Default'}
                    </code>
                    <Button variant="ghost" size="icon" onClick={() => copyToClipboard(config.baseUrl, `${config.id}-url`)} className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100">
                      {copiedId === `${config.id}-url` ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>
                
                <div>
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">API Key</label>
                  <div className="flex items-center gap-1 mt-0.5">
                    <code className="flex-1 bg-gray-50 px-2 py-1 rounded text-xs text-gray-800 border border-gray-100 truncate font-mono">
                      {visibleKeys[config.id] ? config.apiKey : '•'.repeat(Math.min(config.apiKey.length, 24))}
                    </code>
                    <Button variant="ghost" size="icon" onClick={() => toggleKeyVisibility(config.id)} className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100">
                      {visibleKeys[config.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => copyToClipboard(config.apiKey, `${config.id}-key`)} className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100">
                      {copiedId === `${config.id}-key` ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>

                {config.tags && config.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {config.tags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full border border-gray-200">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {renderModelHealth(config)}
              </div>
            </div>
          ))}
        </div>
      )}

      </div>

      {isModalOpen && (
        <ConfigModal
          config={editingConfig}
          configs={configs}
          onClose={() => setIsModalOpen(false)}
          onSave={(data: any) => {
            if (editingConfig) {
              updateConfig(editingConfig.id, data);
            } else {
              addConfig(data);
            }
            setIsModalOpen(false);
          }}
        />
      )}

      {deployConfig && (
        <DeployModal
          config={deployConfig}
          targets={targets}
          onClose={() => setDeployConfig(null)}
        />
      )}

      {configToDelete && (
        <ConfirmModal
          title="Delete Configuration"
          message={`Are you sure you want to delete the configuration "${configToDelete.name}"? This action cannot be undone.`}
          onConfirm={() => {
            removeHealthCache(configToDelete.id);
            deleteConfig(configToDelete.id);
            setConfigToDelete(null);
          }}
          onCancel={() => setConfigToDelete(null)}
        />
      )}
    </div>
  );
}
