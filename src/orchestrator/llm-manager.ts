import { readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';
import { LLMResponse, LLMConfig, LLMProvider, ModelRouting, classifyTask } from './llm.js';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://ollama:11434/v1';

interface OllamaResponse {
  model: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export class OllamaProvider implements LLMProvider {
  name = 'ollama';
  models = ['qwen2.5-coder:14b', 'phi4'];
  supportsStreaming = true;

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${process.env.OLLAMA_HOST || 'http://localhost:11434'}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async complete(prompt: string, config?: Partial<LLMConfig>): Promise<LLMResponse> {
    const model = config?.model || 'qwen2.5-coder:14b';
    const temperature = config?.temperature ?? 0.7;
    const maxTokens = config?.max_tokens ?? 4096;

    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          temperature,
          max_tokens: maxTokens,
          stream: false,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${error}`);
      }

      const data: OllamaResponse = await response.json();
      
      return {
        content: data.response,
        model: data.model,
        usage: {
          prompt_tokens: data.prompt_eval_count || 0,
          completion_tokens: data.eval_count || 0,
          total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        },
        finish_reason: data.done ? 'stop' : 'length',
      };
    } catch (error) {
      console.error('Ollama completion error:', error);
      throw error;
    }
  }

  async *stream(prompt: string, config?: Partial<LLMConfig>): AsyncGenerator<{ delta: string; model: string; done: boolean }> {
    const model = config?.model || 'qwen2.5-coder:14b';
    
    const response = await fetch(`${OLLAMA_BASE_URL}/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        temperature: config?.temperature ?? 0.7,
        max_tokens: config?.max_tokens ?? 4096,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama streaming error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const data = JSON.parse(line);
            yield {
              delta: data.response || '',
              model: data.model,
              done: data.done || false,
            };
            if (data.done) return;
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
  }
}

export class LLMManager {
  private providers: Map<string, LLMProvider> = new Map();
  private primaryProvider: LLMProvider;

  constructor() {
    const ollama = new OllamaProvider();
    this.providers.set('ollama', ollama);
    this.primaryProvider = ollama;
  }

  async complete(
    prompt: string,
    config?: Partial<LLMConfig>
  ): Promise<LLMResponse> {
    const model = config?.model;
    
    if (model && model.includes('claude') && process.env.OPENROUTER_API_KEY) {
      return this.completeWithOpenRouter(prompt, config);
    }
    
    if (model && model.includes('hf-')) {
      return this.completeWithHuggingFace(prompt, config);
    }
    
    return this.primaryProvider.complete(prompt, config);
  }

  async *stream(
    prompt: string,
    config?: Partial<LLMConfig>
  ): AsyncGenerator<{ delta: string; model: string; done: boolean }> {
    yield* this.primaryProvider.stream(prompt, config);
  }

  private async completeWithOpenRouter(
    prompt: string,
    config?: Partial<LLMConfig>
  ): Promise<LLMResponse> {
    const model = config?.model || 'anthropic/claude-3-haiku-20240307';
    
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: config?.temperature ?? 0.7,
          max_tokens: config?.max_tokens ?? 4096,
        }),
      });

      const data = await response.json();
      
      if (data.error) {
        const errorMsg = data.error.message || data.error.code;
        if (errorMsg.includes('does not support pdf')) {
          throw new Error('PDF input not supported. Please convert PDF to text or use a different model.');
        }
        throw new Error(`AI Error: ${errorMsg}`);
      }
      
      return {
        content: data.choices?.[0]?.message?.content || '',
        model: data.model,
        usage: data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        finish_reason: data.choices?.[0]?.finish_reason || 'stop',
      };
    } catch (error: any) {
      if (error.message.includes('does not support')) {
        throw new Error('This AI model does not support PDF/document input. Please convert to text first.');
      }
      throw error;
    }
  }

  private async completeWithHuggingFace(
    prompt: string,
    config?: Partial<LLMConfig>
  ): Promise<LLMResponse> {
    const model = config?.model || 'meta-llama/Llama-3.1-8B-Instruct';
    
    const response = await fetch(
      `https://api-inference.huggingface.co/v1/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.HF_TOKEN}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: config?.temperature ?? 0.7,
          max_tokens: config?.max_tokens ?? 4096,
        }),
      }
    );

    const data = await response.json();
    return {
      content: data.choices?.[0]?.message?.content || '',
      model: data.model,
      usage: data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      finish_reason: data.choices?.[0]?.finish_reason || 'stop',
    };
  }

  async checkHealth(): Promise<boolean> {
    return this.primaryProvider.isAvailable();
  }
}

export const llmManager = new LLMManager();
export default llmManager;