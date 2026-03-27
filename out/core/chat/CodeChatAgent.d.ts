import { GraphStore } from '../graph/GraphStore';
import { EmbeddingEngine } from '../embeddings/EmbeddingEngine';
import { LLMClient } from '../mcp/LLMClient';
export interface ChatResponse {
    answer: string;
    contextUsed: {
        name: string;
        type: string;
        filePath: string;
    }[];
}
export declare class CodeChatAgent {
    private readonly graphStore;
    private readonly embeddingEngine;
    private readonly llmClient;
    constructor(graphStore: GraphStore, embeddingEngine: EmbeddingEngine, llmClient: LLMClient);
    askQuery(userQuery: string): Promise<ChatResponse>;
}
