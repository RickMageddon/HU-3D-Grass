import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Laad server/.env, ongeacht vanuit welke map de server gestart wordt.
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env'), quiet: true });

export type Provider = 'anthropic' | 'openai' | 'none';

function provider(): Provider {
  const p = (process.env.LLM_PROVIDER ?? 'auto').toLowerCase();
  if (p === 'anthropic' || p === 'openai' || p === 'none') return p;
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.OPENAI_BASE_URL) return 'openai';
  return 'none';
}

export const config = {
  port: Number(process.env.PORT ?? 8787),
  provider: provider(),
  anthropicModel: process.env.ANTHROPIC_MODEL ?? 'claude-opus-5-5',
  /** OpenAI-compatibele API, bijv. Ollama (http://localhost:11434/v1), LM Studio of Groq. */
  openaiBaseUrl: (process.env.OPENAI_BASE_URL ?? 'http://localhost:11434/v1').replace(/\/$/, ''),
  openaiModel: process.env.OPENAI_MODEL ?? 'llama3.1',
  llmTimeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? 20000),
};

export function llmModel(): string | null {
  if (config.provider === 'anthropic') return config.anthropicModel;
  if (config.provider === 'openai') return config.openaiModel;
  return null;
}
