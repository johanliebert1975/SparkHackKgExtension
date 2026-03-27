"use strict";
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
exports.MCPServer = void 0;
const http = __importStar(require("http"));
const Logger_1 = require("../../utils/Logger");
class MCPServer {
    constructor(store, embeddingEngine, port) {
        this.server = null;
        this.listeners = [];
        this.store = store;
        this.embeddingEngine = embeddingEngine;
        this.port = port;
    }
    onQuery(listener) {
        this.listeners.push(listener);
    }
    emit(event) {
        this.listeners.forEach(l => l(event));
    }
    async start() {
        this.server = http.createServer(async (req, res) => {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            if (req.method === 'OPTIONS') {
                res.writeHead(204);
                res.end();
                return;
            }
            if (req.url === '/mcp' && req.method === 'POST') {
                const body = await readBody(req);
                const response = await this.handleMCPRequest(body);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(response));
                return;
            }
            if (req.url === '/mcp/manifest' && req.method === 'GET') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(this.buildManifest()));
                return;
            }
            res.writeHead(404);
            res.end('Not found');
        });
        await new Promise((resolve, reject) => {
            this.server.listen(this.port, '0.0.0.0', () => resolve());
            this.server.on('error', reject);
        });
    }
    stop() {
        this.server?.close();
    }
    // ── MCP request handler ────────────────────────────────────────────────────
    async handleMCPRequest(rawBody) {
        let parsed;
        try {
            parsed = JSON.parse(rawBody);
        }
        catch {
            return { error: 'Invalid JSON' };
        }
        const { tool, params } = parsed;
        const start = Date.now();
        try {
            let result;
            switch (tool) {
                case 'explore_symbol':
                    result = await this.toolExploreSymbol(params);
                    break;
                case 'search_intent':
                    result = await this.toolSearchIntent(params);
                    break;
                case 'get_blast_radius':
                    result = await this.toolGetBlastRadius(params);
                    break;
                case 'suggest_commit_message':
                    result = await this.toolSuggestCommitMessage(params);
                    break;
                default:
                    return { error: `Unknown tool: ${tool}` };
            }
            const resultCount = Array.isArray(result) ? result.length : (result ? 1 : 0);
            this.emit({ tool, params, resultCount, timestamp: start });
            Logger_1.Logger.info(`MCP [${tool}] → ${resultCount} results in ${Date.now() - start}ms`);
            return { result };
        }
        catch (err) {
            Logger_1.Logger.error(`MCP tool error [${tool}]`, err);
            return { error: String(err) };
        }
    }
    // ── Tool implementations ───────────────────────────────────────────────────
    /**
     * explore_symbol: Return node + 1-hop callers/callees.
     */
    async toolExploreSymbol(params) {
        const node = this.store.getNode(params.symbol_id);
        if (!node)
            return null;
        const { callers, callees } = this.store.getNeighbours(params.symbol_id);
        return { node, callers, callees };
    }
    /**
     * search_intent: Embed query → cosine search in DB.
     */
    async toolSearchIntent(params) {
        const { query, limit = 10 } = params;
        // Try semantic search first
        try {
            const vector = await this.embeddingEngine.embed(query);
            const results = this.store.searchSemantic(vector, limit);
            return results;
        }
        catch {
            // Fall back to keyword search if embeddings not available
            Logger_1.Logger.warn('Semantic search unavailable, falling back to keyword search');
            return this.store.searchKeyword(query, limit);
        }
    }
    /**
     * get_blast_radius: BFS from a node to find all dependents.
     */
    async toolGetBlastRadius(params) {
        const { symbol_id, max_depth = 8 } = params;
        const nodes = this.store.getBlastRadius(symbol_id, max_depth);
        return nodes;
    }
    /**
     * suggest_commit_message: Delegated to CommitDiffEngine via dynamic import.
     */
    async toolSuggestCommitMessage(_params) {
        // CommitDiffEngine requires VS Code context — return signal to front-end
        return { action: 'run_command', command: 'semanticKG.suggestCommitMessage' };
    }
    // ── MCP Manifest ──────────────────────────────────────────────────────────
    buildManifest() {
        return {
            name: 'semantic-kg',
            version: '0.1.0',
            description: 'Local codebase knowledge graph for AI coding assistants',
            tools: [
                {
                    name: 'explore_symbol',
                    description: 'Get a symbol\'s intent, signature, file path, and its 1-hop call graph (callers and callees).',
                    parameters: {
                        type: 'object',
                        properties: {
                            symbol_id: { type: 'string', description: 'Node ID e.g. src/foo.ts:MyClass.myMethod' }
                        },
                        required: ['symbol_id']
                    }
                },
                {
                    name: 'search_intent',
                    description: 'Semantic search across all indexed symbols using natural language.',
                    parameters: {
                        type: 'object',
                        properties: {
                            query: { type: 'string', description: 'Natural language description of intent' },
                            limit: { type: 'number', description: 'Max results (default 10)' }
                        },
                        required: ['query']
                    }
                },
                {
                    name: 'get_blast_radius',
                    description: 'Returns all functions and files transitively dependent on a symbol (BFS).',
                    parameters: {
                        type: 'object',
                        properties: {
                            symbol_id: { type: 'string' },
                            max_depth: { type: 'number', description: 'BFS depth limit (default 8)' }
                        },
                        required: ['symbol_id']
                    }
                },
                {
                    name: 'suggest_commit_message',
                    description: 'Generates a semantic commit message based on structural graph diff of staged changes.',
                    parameters: { type: 'object', properties: {} }
                }
            ]
        };
    }
}
exports.MCPServer = MCPServer;
function readBody(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => (data += chunk));
        req.on('end', () => resolve(data));
        req.on('error', reject);
    });
}
//# sourceMappingURL=MCPServer.js.map