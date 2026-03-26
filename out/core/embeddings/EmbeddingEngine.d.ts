/**
 * EmbeddingEngine
 *
 * 1. Generates 384-dim vectors using Xenova/all-MiniLM-L6-v2 (ONNX, no Python).
 * 2. Detects nodes without docstrings and queues background LLM generation.
 */
import { GraphStore } from '../graph/GraphStore';
export declare class EmbeddingEngine {
    private pipeline;
    private readonly store;
    private generating;
    constructor(store: GraphStore);
    private getPipeline;
    embed(text: string): Promise<Float32Array>;
    /**
     * Embeds any node missing an embedding.
     * Runs silently in the background — errors per-node are swallowed.
     */
    generateMissingEmbeddings(): Promise<void>;
    /**
     * Generates docstrings for functions/methods/classes that have none.
     * Uses the user's configured LLM provider.
     */
    generateMissingDocstrings(): Promise<void>;
    private buildEmbeddingText;
    private buildDocstringPrompt;
}
