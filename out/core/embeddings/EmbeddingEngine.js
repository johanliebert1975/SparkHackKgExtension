"use strict";
/**
 * EmbeddingEngine
 *
 * 1. Generates 384-dim vectors using Xenova/all-MiniLM-L6-v2 (ONNX, no Python).
 * 2. Detects nodes without docstrings and queues background LLM generation.
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
exports.EmbeddingEngine = void 0;
const vscode = __importStar(require("vscode"));
const LLMClient_1 = require("../mcp/LLMClient");
const Logger_1 = require("../../utils/Logger");
class EmbeddingEngine {
    constructor(store) {
        this.pipeline = null;
        this.generating = false;
        this.store = store;
    }
    async getPipeline() {
        if (this.pipeline)
            return this.pipeline;
        try {
            const { pipeline } = await Promise.resolve().then(() => __importStar(require('@xenova/transformers')));
            this.pipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
            Logger_1.Logger.info('Embedding model loaded (Xenova/all-MiniLM-L6-v2)');
        }
        catch (err) {
            Logger_1.Logger.warn(`Could not load @xenova/transformers: ${err}. Embeddings disabled.`);
            throw err;
        }
        return this.pipeline;
    }
    async embed(text) {
        const pipe = await this.getPipeline();
        const output = await pipe(text, { pooling: 'mean', normalize: true });
        return output.data;
    }
    /**
     * Embeds any node missing an embedding.
     * Runs silently in the background — errors per-node are swallowed.
     */
    async generateMissingEmbeddings() {
        if (this.generating)
            return;
        this.generating = true;
        try {
            const nodes = this.store.getNodesWithoutEmbeddings();
            if (nodes.length === 0)
                return;
            Logger_1.Logger.info(`Generating embeddings for ${nodes.length} nodes...`);
            for (const node of nodes) {
                try {
                    const text = this.buildEmbeddingText(node);
                    const vector = await this.embed(text);
                    this.store.storeEmbedding(node.id, vector);
                }
                catch {
                    // skip node — embedding will be retried next cycle
                }
            }
            Logger_1.Logger.info('Embedding generation complete');
        }
        finally {
            this.generating = false;
        }
    }
    /**
     * Generates docstrings for functions/methods/classes that have none.
     * Uses the user's configured LLM provider.
     */
    async generateMissingDocstrings() {
        const config = vscode.workspace.getConfiguration('semanticKG');
        const provider = config.get('llmProvider', 'anthropic');
        const apiKey = config.get('llmApiKey', '');
        const model = config.get('llmModel', 'claude-sonnet-4-20250514');
        if (!apiKey && provider !== 'ollama') {
            Logger_1.Logger.warn('No LLM API key configured — skipping docstring generation');
            return;
        }
        const nodes = this.store.getNodesWithoutDocstrings();
        if (nodes.length === 0)
            return;
        Logger_1.Logger.info(`Auto-generating docstrings for ${nodes.length} nodes...`);
        const client = new LLMClient_1.LLMClient(provider, apiKey, model);
        for (const node of nodes) {
            try {
                const prompt = this.buildDocstringPrompt(node);
                const docstring = await client.complete(prompt, 150);
                if (docstring.trim()) {
                    this.store.updateDocstring(node.id, docstring.trim(), true);
                }
            }
            catch (err) {
                Logger_1.Logger.warn(`Docstring gen failed for ${node.id}: ${err}`);
            }
        }
    }
    buildEmbeddingText(node) {
        const parts = [node.name, node.signature, node.docstring].filter(Boolean);
        return parts.join(' | ');
    }
    buildDocstringPrompt(node) {
        return (`You are a senior developer. Write a concise 1-2 sentence docstring for the following ${node.type}. ` +
            `Reply with ONLY the docstring text — no code fences, no prefix, no quotes.\n\n` +
            `Name: ${node.name}\n` +
            `Signature: ${node.signature}\n` +
            `File: ${node.filePath}`);
    }
}
exports.EmbeddingEngine = EmbeddingEngine;
//# sourceMappingURL=EmbeddingEngine.js.map