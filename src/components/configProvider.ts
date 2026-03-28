import type { Provider } from '../types';

type ProviderLike = {
  provider?: string | null;
  baseUrl?: string | null;
  apiKey?: string | null;
};

export const PROVIDERS: Provider[] = ['OpenAI', 'Anthropic', 'DeepSeek', 'Google', 'Ollama', 'Custom'];

export const DEFAULT_URLS: Record<Provider, string> = {
  OpenAI: 'https://api.openai.com/v1',
  Anthropic: 'https://api.anthropic.com',
  DeepSeek: 'https://api.deepseek.com/v1',
  Google: 'https://generativelanguage.googleapis.com/v1beta',
  Ollama: 'http://localhost:11434/v1',
  Custom: '',
};

const PROVIDER_ALIASES: Record<string, Provider> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  deepseek: 'DeepSeek',
  google: 'Google',
  ollama: 'Ollama',
  custom: 'Custom',
};

export function normalizeProvider(provider?: string | null): Provider | null {
  const normalized = provider?.trim().toLowerCase();
  if (!normalized) return null;
  return PROVIDER_ALIASES[normalized] ?? null;
}

export function inferProvider({ baseUrl, apiKey }: ProviderLike): Provider | null {
  const normalizedBaseUrl = baseUrl?.trim().toLowerCase() ?? '';
  const normalizedApiKey = apiKey?.trim() ?? '';

  if (normalizedBaseUrl.includes('anthropic')) return 'Anthropic';
  if (normalizedBaseUrl.includes('deepseek')) return 'DeepSeek';
  if (normalizedBaseUrl.includes('googleapis')) return 'Google';
  if (normalizedBaseUrl.includes('openai')) return 'OpenAI';
  if (
    normalizedBaseUrl.includes('ollama') ||
    normalizedBaseUrl.includes('localhost') ||
    normalizedBaseUrl.includes('127.0.0.1') ||
    normalizedBaseUrl.includes('0.0.0.0') ||
    normalizedBaseUrl.includes(':11434')
  ) {
    return 'Ollama';
  }

  if (normalizedApiKey.startsWith('sk-ant')) return 'Anthropic';
  if (normalizedApiKey.startsWith('AIza')) return 'Google';

  return null;
}

export function resolveProvider(input: ProviderLike): Provider {
  return normalizeProvider(input.provider) ?? inferProvider(input) ?? 'Custom';
}
