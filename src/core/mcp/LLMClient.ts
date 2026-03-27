/**
 * LLMClient — thin wrapper over OpenAI, Anthropic, Ollama, Gemini, and Groq APIs.
 * Used for docstring generation, commit message generation, and chat.
 */

import * as https from 'https';
import * as http from 'http';
import { Logger } from '../../utils/Logger';

export class LLMClient {
  constructor(
    private readonly provider: string,
    private readonly apiKey: string,
    private readonly model: string,
    private readonly ollamaUrl = 'http://localhost:11434'
  ) {}

  async complete(prompt: string, maxTokens = 500): Promise<string> {
    if (!this.apiKey && this.provider !== 'ollama') {
      throw new Error(`API key is missing for provider: ${this.provider}`);
    }

    switch (this.provider) {
      case 'anthropic': return this.anthropic(prompt, maxTokens);
      case 'openai':    return this.openai(prompt, maxTokens);
      case 'ollama':    return this.ollama(prompt, maxTokens);
      case 'gemini':    return this.gemini(prompt, maxTokens);
      case 'groq':      return this.groq(prompt, maxTokens); // <-- Added Groq
      default:          throw new Error(`Unknown LLM provider: ${this.provider}`);
    }
  }
  
  // ── Groq ───────────────────────────────────────────────────────────────────

  private async groq(prompt: string, maxTokens: number): Promise<string> {
    const body = JSON.stringify({
      model: this.model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });

    // Groq uses the exact same payload structure as OpenAI!
    const res = await this.post('https://api.groq.com/openai/v1/chat/completions', body, {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    });

    const json = JSON.parse(res);
    if (json.error) {
      throw new Error(json.error.message || json.error);
    }
    return json.choices?.[0]?.message?.content ?? '';
  }

  // ── Gemini ─────────────────────────────────────────────────────────────────

  private async gemini(prompt: string, maxTokens: number): Promise<string> {
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens }
    });

    const url = `https://generativelanguage.googleapis.com/v1/models/${this.model}:generateContent?key=${this.apiKey}`;
    
    try {
      const res = await this.post(url, body, { 'Content-Type': 'application/json' });
      const json = JSON.parse(res);
      
      if (json.error) {
        throw new Error(json.error.message);
      }

      return json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    } catch (err) {
      Logger.error(`[LLMClient] Gemini API error: ${err}`);
      throw err;
    }
  }

  // ── Anthropic ──────────────────────────────────────────────────────────────

  private async anthropic(prompt: string, maxTokens: number): Promise<string> {
    const body = JSON.stringify({
      model: this.model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });

    const res = await this.post('https://api.anthropic.com/v1/messages', body, {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01',
    });

    const json = JSON.parse(res);
    return json.content?.[0]?.text ?? '';
  }

  // ── OpenAI ─────────────────────────────────────────────────────────────────

  private async openai(prompt: string, maxTokens: number): Promise<string> {
    const body = JSON.stringify({
      model: this.model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });

    const res = await this.post('https://api.openai.com/v1/chat/completions', body, {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    });

    const json = JSON.parse(res);
    return json.choices?.[0]?.message?.content ?? '';
  }

  // ── Ollama ─────────────────────────────────────────────────────────────────

  private async ollama(prompt: string, maxTokens: number): Promise<string> {
    const body = JSON.stringify({
      model: this.model,
      prompt,
      stream: false,
      options: { num_predict: maxTokens },
    });

    const url = `${this.ollamaUrl}/api/generate`;
    const res = await this.post(url, body, { 'Content-Type': 'application/json' });
    const json = JSON.parse(res);
    return json.response ?? '';
  }

  // ── HTTP helper ────────────────────────────────────────────────────────────

  private post(url: string, body: string, headers: Record<string, string>): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const lib = parsed.protocol === 'https:' ? https : http;

      const req = lib.request(
        {
          hostname: parsed.hostname,
          port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
          path: parsed.pathname + parsed.search,
          method: 'POST',
          headers: { ...headers, 'Content-Length': Buffer.byteLength(body) },
        },
        res => {
          let data = '';
          res.on('data', chunk => (data += chunk));
          res.on('end', () => resolve(data));
        }
      );

      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }
}