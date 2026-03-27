/**
 * LLMClient — thin wrapper over OpenAI, Anthropic, Ollama, Gemini, and Groq APIs.
 * Used for docstring generation, commit message generation, and chat.
 */
export declare class LLMClient {
    private readonly provider;
    private readonly apiKey;
    private readonly model;
    private readonly ollamaUrl;
    constructor(provider: string, apiKey: string, model: string, ollamaUrl?: string);
    complete(prompt: string, maxTokens?: number): Promise<string>;
    private groq;
    private gemini;
    private anthropic;
    private openai;
    private ollama;
    private post;
}
