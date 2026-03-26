"use strict";
/**
 * LLMClient — thin wrapper over OpenAI, Anthropic, and Ollama APIs.
 * Used for docstring generation and commit message generation.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMClient = void 0;
const https = __importStar(require("https"));
const http = __importStar(require("http"));
class LLMClient {
    constructor(provider, apiKey, model, ollamaUrl = 'http://localhost:11434') {
        this.provider = provider;
        this.apiKey = apiKey;
        this.model = model;
        this.ollamaUrl = ollamaUrl;
    }
    async complete(prompt, maxTokens = 500) {
        switch (this.provider) {
            case 'anthropic': return this.anthropic(prompt, maxTokens);
            case 'openai': return this.openai(prompt, maxTokens);
            case 'ollama': return this.ollama(prompt, maxTokens);
            default: throw new Error(`Unknown LLM provider: ${this.provider}`);
        }
    }
    // ── Anthropic ──────────────────────────────────────────────────────────────
    async anthropic(prompt, maxTokens) {
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
    async openai(prompt, maxTokens) {
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
    async ollama(prompt, maxTokens) {
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
    post(url, body, headers) {
        return new Promise((resolve, reject) => {
            const parsed = new URL(url);
            const lib = parsed.protocol === 'https:' ? https : http;
            const req = lib.request({
                hostname: parsed.hostname,
                port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
                path: parsed.pathname + parsed.search,
                method: 'POST',
                headers: { ...headers, 'Content-Length': Buffer.byteLength(body) },
            }, res => {
                let data = '';
                res.on('data', chunk => (data += chunk));
                res.on('end', () => resolve(data));
            });
            req.on('error', reject);
            req.write(body);
            req.end();
        });
    }
}
exports.LLMClient = LLMClient;
//# sourceMappingURL=LLMClient.js.map