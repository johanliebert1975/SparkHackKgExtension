/**
 * EmbeddingEngine
 *
 * 1. Generates 384-dim vectors using Xenova/all-MiniLM-L6-v2 (ONNX, no Python).
 * 2. Detects nodes without docstrings and queues background LLM generation.
 */

import * as vscode from 'vscode';
import { GraphStore, CodeNode } from '../graph/GraphStore';
import { LLMClient } from '../mcp/LLMClient';
import { Logger } from '../../utils/Logger';

export class EmbeddingEngine {
  private pipeline: any = null;
  private readonly store: GraphStore;
  private generating = false;

  constructor(store: GraphStore) {
    this.store = store;
  }

  private async getPipeline(): Promise<any> {
    if (this.pipeline) return this.pipeline;

    try {
      const { pipeline } = await import('@xenova/transformers');
      this.pipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      Logger.info('Embedding model loaded (Xenova/all-MiniLM-L6-v2)');
    } catch (err) {
      Logger.warn(`Could not load @xenova/transformers: ${err}. Embeddings disabled.`);
      throw err;
    }

    return this.pipeline;
  }

  async embed(text: string): Promise<Float32Array> {
    const pipe = await this.getPipeline();
    const output = await pipe(text, { pooling: 'mean', normalize: true });
    return output.data as Float32Array;
  }

  /**
   * Embeds any node missing an embedding.
   * Runs silently in the background — errors per-node are swallowed.
   */
  async generateMissingEmbeddings(): Promise<void> {
    if (this.generating) return;
    this.generating = true;

    try {
      const nodes = this.store.getNodesWithoutEmbeddings();
      if (nodes.length === 0) return;

      Logger.info(`Generating embeddings for ${nodes.length} nodes...`);

      for (const node of nodes) {
        try {
          const text = this.buildEmbeddingText(node);
          const vector = await this.embed(text);
          this.store.storeEmbedding(node.id, vector);
        } catch {
          // skip node — embedding will be retried next cycle
        }
      }

      Logger.info('Embedding generation complete');
    } finally {
      this.generating = false;
    }
  }

  /**
   * Generates docstrings for functions/methods/classes that have none.
   * Uses the user's configured LLM provider.
   */
  async generateMissingDocstrings(): Promise<void> {
    const config = vscode.workspace.getConfiguration('semanticKG');
    const provider: string = config.get('llmProvider', 'anthropic');
    const apiKey: string = config.get('llmApiKey', '');
    const model: string = config.get('llmModel', 'claude-sonnet-4-20250514');

    if (!apiKey && provider !== 'ollama') {
      Logger.warn('No LLM API key configured — skipping docstring generation');
      return;
    }

    const nodes = this.store.getNodesWithoutDocstrings();
    if (nodes.length === 0) return;

    Logger.info(`Auto-generating docstrings for ${nodes.length} nodes...`);
    const client = new LLMClient(provider, apiKey, model);

    for (const node of nodes) {
      try {
        const prompt = this.buildDocstringPrompt(node);
        const docstring = await client.complete(prompt, 150);
        if (docstring.trim()) {
          this.store.updateDocstring(node.id, docstring.trim(), true);
        }
      } catch (err) {
        Logger.warn(`Docstring gen failed for ${node.id}: ${err}`);
      }
    }
  }

  private buildEmbeddingText(node: CodeNode): string {
    const parts = [node.name, node.signature, node.docstring].filter(Boolean);
    return parts.join(' | ');
  }

  private buildDocstringPrompt(node: CodeNode): string {
    return (
      `You are a senior developer. Write a concise 1-2 sentence docstring for the following ${node.type}. ` +
      `Reply with ONLY the docstring text — no code fences, no prefix, no quotes.\n\n` +
      `Name: ${node.name}\n` +
      `Signature: ${node.signature}\n` +
      `File: ${node.filePath}`
    );
  }
}
