export interface LLMConfig {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  apiKey: string;
  defaultModel?: string;
  models?: string;
  headers?: Record<string, string>;
  tags?: string[];
  billingType?: 'free' | 'paid';
  notes?: string;
  status?: 'untested' | 'valid' | 'invalid';
  createdAt: string;
  updatedAt: string;
}

export interface ExportTarget {
  id: string;
  name: string;
  isRemote: boolean;
  sshCommand: string;
  bashScript: string;
  isBuiltin?: boolean;
}

export type Provider = 'OpenAI' | 'Anthropic' | 'DeepSeek' | 'Google' | 'Ollama' | 'Custom';

export interface ModelHealthResult {
  config_id: string;
  model: string;
  status: 'ok' | 'fail';
  latency_ms: number;
  error_type: string | null;
  checked_at: string;
}
