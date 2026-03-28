import { useState, useEffect } from 'react';
import { X, Wand2, Activity, Eye, EyeOff, Clipboard, ChevronDown, ChevronRight, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { LLMConfig, Provider, ModelHealthResult } from '../types';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/Select';
import { Input } from './ui/Input';
import { Textarea } from './ui/Textarea';
import { Button } from './ui/Button';
import { saveHealthCache, loadHealthCache, formatCheckedAt } from '../utils/healthCache';
import { DEFAULT_URLS, PROVIDERS, resolveProvider } from './configProvider';

export default function ConfigModal({ config, configs = [], onClose, onSave }: any) {
  const [formData, setFormData] = useState({
    name: '',
    provider: 'Custom' as Provider,
    baseUrl: '',
    apiKey: '',
    models: '',
    status: 'untested' as 'untested' | 'valid' | 'invalid',
    tags: '',
    billingType: '' as '' | 'free' | 'paid',
    notes: ''
  });
  const [smartText, setSmartText] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{valid: boolean, message?: string} | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelResults, setModelResults] = useState<ModelHealthResult[]>([]);
  const [isTestingModels, setIsTestingModels] = useState(false);
  const [modelsExpanded, setModelsExpanded] = useState(false);
  const [modelCheckedAt, setModelCheckedAt] = useState<number | null>(null);

  useEffect(() => {
    if (config) {
      const provider = resolveProvider(config);
      setFormData({
        name: config.name,
        provider,
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        models: config.models || '',
        status: config.status || 'untested',
        tags: config.tags ? config.tags.join(', ') : '',
        billingType: config.billingType ?? '',
        notes: config.notes || ''
      });
      loadHealthCache(config.id).then(cache => {
        if (cache) {
          setModelResults(cache.results);
          setModelCheckedAt(cache.checkedAt);
          setModelsExpanded(true);
        }
      });
    }
  }, [config]);

  const handleProviderChange = (provider: Provider) => {
    setFormData(prev => ({
      ...prev,
      provider,
      baseUrl: DEFAULT_URLS[provider] || prev.baseUrl,
    }));
  };

  const handleSmartParse = () => {
    if (!smartText.trim()) return;

    let newFormData = { ...formData };

    // Extract URL
    const urlMatch = smartText.match(/https?:\/\/[^\s"']+/);
    if (urlMatch) {
      let url = urlMatch[0];
      url = url.replace(/\/chat\/completions$/, '');
      newFormData.baseUrl = url;
    }

    // Extract API Key
    const keyMatch = smartText.match(/(sk-[a-zA-Z0-9_]{20,}|AIza[0-9A-Za-z-_]{35})/);
    if (keyMatch) {
      newFormData.apiKey = keyMatch[0];
    }

    // Guess Provider
    newFormData.provider = resolveProvider(newFormData);

    if (!newFormData.name && newFormData.provider !== 'Custom') {
      newFormData.name = `${newFormData.provider} Auto-parsed`;
    }

    if (!newFormData.notes && smartText.trim()) {
      newFormData.notes = smartText.trim();
    }

    setFormData(newFormData);
    setSmartText('');
  };

  const handleTestConnection = async () => {
    if (!formData.baseUrl || (formData.provider !== 'Ollama' && !formData.apiKey)) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const result: any = await invoke('test_connection', {
        provider: formData.provider,
        baseUrl: formData.baseUrl,
        apiKey: formData.apiKey,
        models: formData.models || null,
      });
      if (result.status === 'ok') {
        setTestResult({ valid: true, message: result.message || 'Connection successful!' });
        setFormData(prev => ({ ...prev, status: 'valid' }));
      } else {
        setTestResult({ valid: false, message: result.message || 'Connection failed.' });
        setFormData(prev => ({ ...prev, status: 'invalid' }));
      }
    } catch (e: any) {
      setTestResult({ valid: false, message: e.toString() });
      setFormData(prev => ({ ...prev, status: 'invalid' }));
    } finally {
      setIsTesting(false);
    }
  };

  const handleProbeModels = async () => {
    if (!formData.baseUrl || (formData.provider !== 'Ollama' && !formData.apiKey)) return;
    setIsTestingModels(true);
    setModelResults([]);
    setModelsExpanded(true);
    try {
      console.log('[probe] calling with:', { provider: formData.provider, baseUrl: formData.baseUrl, apiKey: formData.apiKey, models: formData.models || null });
      const results: ModelHealthResult[] = await invoke('probe_models_adhoc', {
        provider: formData.provider,
        baseUrl: formData.baseUrl,
        apiKey: formData.apiKey,
        models: formData.models || null,
      });
      setModelResults(results);
      if (config?.id) {
        await saveHealthCache(config.id, results);
        const cached = await loadHealthCache(config.id);
        if (cached) setModelCheckedAt(cached.checkedAt);
      }
    } catch (e: any) {
      setModelResults([]);
      console.error('[probe_models_adhoc] error:', e);
    } finally {
      setIsTestingModels(false);
    }
  };

  const handleAutoFillName = () => {
    if (!formData.baseUrl) return;
    try {
      const hostname = new URL(formData.baseUrl).hostname;
      const date = new Date();
      const yyyyMMdd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
      setFormData(prev => ({ ...prev, name: `${hostname}-${yyyyMMdd}` }));
    } catch {
      // invalid URL, do nothing
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.billingType) {
      setError('请选择 Billing Type。');
      return;
    }

    const isDuplicate = configs.some((c: LLMConfig) =>
      c.id !== config?.id &&
      (c.apiKey === formData.apiKey && c.baseUrl === formData.baseUrl)
    );

    if (isDuplicate) {
      setError('该 Base URL + API Key 组合已存在。');
      return;
    }

    const finalData = {
      ...formData,
      tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean)
    };

    onSave(finalData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-5 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">
            {config ? 'Edit Configuration' : 'Add Configuration'}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-400 hover:text-gray-600 h-7 w-7">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {!config && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <label className="block text-xs font-medium text-blue-900 mb-2 flex items-center gap-2">
                <Wand2 className="w-3.5 h-3.5" />
                Smart Parse (Paste raw text here)
              </label>
              <Textarea
                value={smartText}
                onChange={e => setSmartText(e.target.value)}
                placeholder="Paste email, docs, or chat text containing URL and API key..."
                className="border-blue-200 focus:ring-blue-500 focus:border-blue-500 bg-white h-16 text-xs"
              />
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigator.clipboard.readText().then(text => setSmartText(text))}
                  className="border-blue-300 text-blue-700 hover:bg-blue-100"
                >
                  <Clipboard className="w-3.5 h-3.5" />
                  从剪贴板填充
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSmartParse}
                  className="flex-1"
                >
                  Parse & Fill
                </Button>
              </div>
            </div>
          )}

          <form id="config-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
              <div className="relative">
                <Input
                  required
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., My DeepSeek API"
                  className="h-7 text-xs pr-7"
                />
                <button
                  type="button"
                  onClick={handleAutoFillName}
                  disabled={!formData.baseUrl}
                  title="根据域名自动填充名称"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Provider</label>
              <Select key={formData.provider} value={formData.provider} onValueChange={val => handleProviderChange(val as Provider)}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Base URL</label>
              <Input
                required
                type="url"
                value={formData.baseUrl}
                onChange={e => setFormData({ ...formData, baseUrl: e.target.value })}
                placeholder="https://api.example.com/v1"
                className="h-7 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">API Key</label>
              <div className="relative">
                <Input
                  required
                  type={showApiKey ? "text" : "password"}
                  value={formData.apiKey}
                  onChange={e => setFormData({ ...formData, apiKey: e.target.value })}
                  placeholder="sk-..."
                  className="h-7 text-xs font-mono pr-8"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 text-gray-400 hover:text-gray-600"
                >
                  {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Custom Models (Optional)</label>
              <Input
                type="text"
                value={formData.models}
                onChange={e => setFormData({ ...formData, models: e.target.value })}
                placeholder="gpt-4, claude-3, deepseek-chat"
                className="h-7 text-xs"
              />
              <p className="text-xs text-gray-500 mt-1">Comma-separated list of models if required by the tool.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Billing Type</label>
                <Select key={formData.billingType} value={formData.billingType || undefined} onValueChange={val => setFormData({ ...formData, billingType: val as 'free' | 'paid' })}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="请选择" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tags (Optional)</label>
                <Input
                  type="text"
                  value={formData.tags}
                  onChange={e => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="e.g., work, personal"
                  className="h-7 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">备注 (Optional)</label>
              <Textarea
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Add any notes about this configuration..."
                className="h-16 text-xs"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="pt-2 space-y-2">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTestConnection}
                  disabled={isTesting || !formData.baseUrl || (formData.provider !== 'Ollama' && !formData.apiKey)}
                  className="flex-1"
                >
                  {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                  {isTesting ? 'Testing...' : 'Test Connection'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleProbeModels}
                  disabled={isTestingModels || !formData.baseUrl || (formData.provider !== 'Ollama' && !formData.apiKey)}
                  className="flex-1 border-purple-300 text-purple-700 hover:bg-purple-50"
                >
                  {isTestingModels ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                  {isTestingModels ? 'Probing...' : 'Probe Models'}
                </Button>
              </div>

              {testResult && (
                <div className={`p-3 rounded-lg text-sm ${
                  testResult.valid
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {testResult.valid ? '✓' : '✗'} {testResult.message}
                </div>
              )}

              {(modelResults.length > 0 || isTestingModels) && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setModelsExpanded(!modelsExpanded)}
                    className="w-full flex items-center justify-between px-3 bg-gray-50 text-gray-700 hover:bg-gray-100"
                  >
                    <span className="flex items-center gap-2">
                      {modelsExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      Model Health
                      {modelResults.length > 0 && (
                        <span className="text-xs text-gray-500">
                          ({modelResults.filter(r => r.status === 'ok').length}/{modelResults.length} ok)
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-2">
                      {isTestingModels && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
                      {modelCheckedAt && !isTestingModels && (
                        <span className="text-xs text-gray-400">{formatCheckedAt(modelCheckedAt)}</span>
                      )}
                    </span>
                  </Button>
                  {modelsExpanded && (
                    <div className="divide-y divide-gray-100">
                      {isTestingModels && modelResults.length === 0 && (
                        <div className="px-3 py-2 text-sm text-gray-500 flex items-center gap-2">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Probing models...
                        </div>
                      )}
                      {[...modelResults].sort((a, b) => {
                        if (a.status !== b.status) return a.status === 'ok' ? -1 : 1;
                        return a.model.localeCompare(b.model);
                      }).map(r => (
                        <div key={r.model} className="flex items-center justify-between px-3 py-2 text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            {r.status === 'ok'
                              ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                              : <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                            <span className="font-mono text-xs text-gray-800 truncate" title={r.model}>{r.model}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            {r.status === 'ok' && (
                              <span className="text-xs text-gray-500">{r.latency_ms}ms</span>
                            )}
                            {r.status === 'fail' && r.error_type && (
                              <span className="text-xs text-red-500 max-w-[100px] truncate" title={r.error_type}>{r.error_type}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </form>
        </div>

        <div className="p-5 border-t border-gray-100 flex gap-3 flex-shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="config-form"
            size="sm"
            className="flex-1"
          >
            {config ? 'Save Changes' : 'Add Configuration'}
          </Button>
        </div>
      </div>
    </div>
  );
}
