import { LLMResponse, LLMConfig, LLMProvider } from './llm.js';

function normalizeOllamaUrl(value: string | undefined): string {
  const url = (value || 'http://localhost:11434').replace(/\/+$/, '');
  return url.endsWith('/v1') ? url.slice(0, -3) : url;
}

const OLLAMA_BASE_URL = normalizeOllamaUrl(process.env.OLLAMA_BASE_URL || process.env.OLLAMA_HOST);

interface OllamaResponse {
  model: string;
  response: string;
  done: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
}

export class OllamaProvider implements LLMProvider {
  name = 'ollama';
  models = ['qwen2.5-coder:14b', 'phi4'];
  supportsStreaming = true;

  async isAvailable(): Promise<boolean> {
    try {
      const base = normalizeOllamaUrl(process.env.OLLAMA_HOST || process.env.OLLAMA_BASE_URL);
      return (await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(3000) })).ok;
    } catch {
      return false;
    }
  }

  async complete(prompt: string, config?: Partial<LLMConfig>): Promise<LLMResponse> {
    const model = config?.model || 'qwen2.5-coder:14b';
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(config?.timeout_ms ?? 120000),
      body: JSON.stringify({
        model, prompt, stream: false,
        options: { temperature: config?.temperature ?? 0.7, num_predict: config?.max_tokens ?? 4096 },
      }),
    });
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} - ${(await response.text()).slice(0, 500)}`);
    }
    const data = await response.json() as OllamaResponse;
    return {
      content: data.response || '',
      model: data.model || model,
      usage: {
        prompt_tokens: data.prompt_eval_count || 0,
        completion_tokens: data.eval_count || 0,
        total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      },
      finish_reason: data.done ? 'stop' : 'length',
    };
  }

  async *stream(prompt: string, config?: Partial<LLMConfig>): AsyncGenerator<{ delta: string; model: string; done: boolean }> {
    const model = config?.model || 'qwen2.5-coder:14b';
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(config?.timeout_ms ?? 120000),
      body: JSON.stringify({
        model, prompt, stream: true,
        options: { temperature: config?.temperature ?? 0.7, num_predict: config?.max_tokens ?? 4096 },
      }),
    });
    if (!response.ok) throw new Error(`Ollama streaming error: ${response.status} - ${(await response.text()).slice(0, 500)}`);
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Ollama returned an empty response body');

    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const data = JSON.parse(line) as OllamaResponse;
          yield { delta: data.response || '', model: data.model || model, done: Boolean(data.done) };
          if (data.done) return;
        }
      }
      if (buffer.trim()) {
        const data = JSON.parse(buffer) as OllamaResponse;
        yield { delta: data.response || '', model: data.model || model, done: Boolean(data.done) };
      }
    } finally {
      reader.releaseLock();
    }
  }
}

export class LLMManager {
  private providers = new Map<string, LLMProvider>();
  private primaryProvider: LLMProvider;

  constructor() {
    const ollama = new OllamaProvider();
    this.providers.set('ollama', ollama);
    this.primaryProvider = ollama;
  }

  async complete(prompt: string, config?: Partial<LLMConfig>): Promise<LLMResponse> {
    const model = config?.model;
    if (model && model.includes('claude') && process.env.OPENROUTER_API_KEY) return this.completeWithOpenRouter(prompt, config);
    if (model?.startsWith('hf-') && process.env.HF_TOKEN) return this.completeWithHuggingFace(prompt, config);
    return this.primaryProvider.complete(prompt, config);
  }

  async *stream(prompt: string, config?: Partial<LLMConfig>): AsyncGenerator<{ delta: string; model: string; done: boolean }> {
    const stream = this.primaryProvider.stream;
    if (!stream) throw new Error('Provider does not support streaming');
    yield* stream.call(this.primaryProvider, prompt, config);
  }

  private async completeWithOpenRouter(prompt: string, config?: Partial<LLMConfig>): Promise<LLMResponse> {
    const model = config?.model || 'anthropic/claude-3-haiku-20240307';
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
      signal: AbortSignal.timeout(config?.timeout_ms ?? 120000),
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: config?.temperature ?? 0.7, max_tokens: config?.max_tokens ?? 4096 }),
    });
    const data = await response.json() as any;
    if (!response.ok || data.error) throw new Error(`OpenRouter request failed: ${String(data.error?.message || response.statusText).slice(0, 300)}`);
    return { content: data.choices?.[0]?.message?.content || '', model: data.model || model, usage: data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }, finish_reason: data.choices?.[0]?.finish_reason || 'stop' };
  }

  private async completeWithHuggingFace(prompt: string, config?: Partial<LLMConfig>): Promise<LLMResponse> {
    const model = config?.model?.replace(/^hf-/, '') || 'meta-llama/Llama-3.1-8B-Instruct';
    const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.HF_TOKEN}` },
      signal: AbortSignal.timeout(config?.timeout_ms ?? 120000),
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: config?.temperature ?? 0.7, max_tokens: config?.max_tokens ?? 4096 }),
    });
    const data = await response.json() as any;
    if (!response.ok || data.error) throw new Error(`Hugging Face request failed: ${String(data.error?.message || response.statusText).slice(0, 300)}`);
    return { content: data.choices?.[0]?.message?.content || '', model: data.model || model, usage: data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }, finish_reason: data.choices?.[0]?.finish_reason || 'stop' };
  }

  async checkHealth(): Promise<boolean> {
    return this.primaryProvider.isAvailable();
  }
}

export const llmManager = new LLMManager();
export default llmManager;
