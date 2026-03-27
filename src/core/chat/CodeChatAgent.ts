import { GraphStore } from '../graph/GraphStore';
import { EmbeddingEngine } from '../embeddings/EmbeddingEngine';
import { LLMClient } from '../mcp/LLMClient';
import { Logger } from '../../utils/Logger';

export interface ChatResponse {
  answer: string;
  contextUsed: { name: string; type: string; filePath: string }[];
}

export class CodeChatAgent {
  constructor(
    private readonly graphStore: GraphStore,
    private readonly embeddingEngine: EmbeddingEngine,
    private readonly llmClient: LLMClient
  ) {}

  public async askQuery(userQuery: string): Promise<ChatResponse> {
    try {
      Logger.info(`[ChatAgent] Processing query: "${userQuery}"`);

      // 1. Embed the user's query
      const queryVector = await this.embeddingEngine.embed(userQuery); 

      // 2. Retrieve relevant context from the Knowledge Graph
      const searchResults = this.graphStore.searchSemantic(queryVector, 5);

      const contextUsed = searchResults.map(result => ({
        name: result.node.name,
        type: result.node.type,
        filePath: result.node.filePath
      }));

      if (searchResults.length === 0) {
        return {
          answer: "I couldn't find any relevant code in the graph to answer your question. Make sure the workspace is fully indexed.",
          contextUsed: []
        };
      }

      // 3. Format the retrieved nodes into a readable context block
      const contextBlocks = searchResults.map(result => {
        const n = result.node;
        return `
---
File: ${n.filePath}
Type: ${n.type} | Name: ${n.name}
Signature: ${n.signature}
Docstring: ${n.docstring}
Modifiers: ${n.modifiers.join(', ')}
---`.trim();
      });

      const systemPrompt = `You are an expert AI coding assistant. Answer the user's question using ONLY the provided codebase context. 
If the context does not contain the answer, politely say so. Do not hallucinate code that isn't in the context. Format your response in Markdown.

CODEBASE CONTEXT:
${contextBlocks.join('\n\n')}

USER QUESTION:
${userQuery}

ANSWER:`;

      // 4. Call the LLM with the context-aware prompt
      const answer = await this.llmClient.complete(systemPrompt, 1500);
      
      return { answer, contextUsed };

    } catch (error) {
      Logger.error(`[ChatAgent] Error answering query: ${error}`);
      return {
        answer: `Sorry, I encountered an error: ${error instanceof Error ? error.message : error}`,
        contextUsed: []
      };
    }
  }
}