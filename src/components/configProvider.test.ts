import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveProvider } from './configProvider.ts';

test('resolveProvider keeps explicit Ollama provider', () => {
  assert.equal(
    resolveProvider({
      provider: 'Ollama',
      baseUrl: 'http://localhost:11434/v1',
      apiKey: '',
    }),
    'Ollama'
  );
});

test('resolveProvider normalizes lowercase ollama', () => {
  assert.equal(
    resolveProvider({
      provider: 'ollama',
      baseUrl: 'http://localhost:11434/v1',
      apiKey: '',
    }),
    'Ollama'
  );
});

test('resolveProvider infers Ollama from localhost endpoint', () => {
  assert.equal(
    resolveProvider({
      provider: '',
      baseUrl: 'http://127.0.0.1:11434/v1',
      apiKey: '',
    }),
    'Ollama'
  );
});

test('resolveProvider infers Anthropic from apiKey regardless of case', () => {
  assert.equal(
    resolveProvider({
      provider: '',
      baseUrl: '',
      apiKey: 'SK-ANT-EXAMPLE',
    }),
    'Anthropic'
  );
});

test('resolveProvider infers Google from apiKey regardless of case', () => {
  assert.equal(
    resolveProvider({
      provider: '',
      baseUrl: '',
      apiKey: 'aIzAsyFakeKey',
    }),
    'Google'
  );
});

test('resolveProvider falls back to Custom when no signal is available', () => {
  assert.equal(
    resolveProvider({
      provider: '',
      baseUrl: 'https://api.example.com/v1',
      apiKey: '',
    }),
    'Custom'
  );
});
