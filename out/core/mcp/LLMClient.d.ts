/**
 * LLMClient — thin wrapper over OpenAI, Anthropic, and Ollama APIs.
 * Used for docstring generation and commit message generation.
 */
export declare class LLMClient {
    private readonly provider;
    private readonly apiKey;
    private readonly model;
    private readonly ollamaUrl;
    constructor(provider: string, apiKey: string, model: string, ollamaUrl?: string);
    complete(prompt: string, maxTokens?: number): Promise<string>;
    private anthropic;
    private openai;
    private ollama;
    private post;
}
