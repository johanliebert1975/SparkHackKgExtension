/**
 * MCPServer — exposes 4 MCP tools to external AI agents via HTTP.
 *
 * Tools:
 *   explore_symbol     → 1-hop graph around a symbol
 *   search_intent      → semantic vector search
 *   get_blast_radius   → BFS dependency impact via recursive CTE
 *   suggest_commit_message → semantic graph diff → commit message
 *
 * Implements a minimal MCP-compatible HTTP transport.
 * AI agents connect to http://localhost:<port>/mcp
 */
import { GraphStore } from '../graph/GraphStore';
import { EmbeddingEngine } from '../embeddings/EmbeddingEngine';
export type MCPQueryEvent = {
    tool: string;
    params: unknown;
    resultCount: number;
    timestamp: number;
};
export type MCPEventListener = (event: MCPQueryEvent) => void;
export declare class MCPServer {
    private server;
    private readonly store;
    private readonly embeddingEngine;
    private readonly port;
    private readonly listeners;
    constructor(store: GraphStore, embeddingEngine: EmbeddingEngine, port: number);
    onQuery(listener: MCPEventListener): void;
    private emit;
    start(): Promise<void>;
    stop(): void;
    private handleMCPRequest;
    /**
     * explore_symbol: Return node + 1-hop callers/callees.
     */
    private toolExploreSymbol;
    /**
     * search_intent: Embed query → cosine search in DB.
     */
    private toolSearchIntent;
    /**
     * get_blast_radius: BFS from a node to find all dependents.
     */
    private toolGetBlastRadius;
    /**
     * suggest_commit_message: Delegated to CommitDiffEngine via dynamic import.
     */
    private toolSuggestCommitMessage;
    private buildManifest;
}
