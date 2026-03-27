"use strict";
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
exports.CodeChatAgent = void 0;
const Logger_1 = require("../../utils/Logger");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class CodeChatAgent {
    constructor(graphStore, embeddingEngine, llmClient, workspaceRoot // Ensure absolute path resolution
    ) {
        this.graphStore = graphStore;
        this.embeddingEngine = embeddingEngine;
        this.llmClient = llmClient;
        this.workspaceRoot = workspaceRoot;
    }
    async askQuery(userQuery) {
        try {
            Logger_1.Logger.info(`[ChatAgent] Processing query: "${userQuery}"`);
            const queryVector = await this.embeddingEngine.embed(userQuery);
            const semanticResults = this.graphStore.searchSemantic(queryVector, 10);
            const keywords = userQuery.replace(/[^a-zA-Z0-9 ]/g, "").split(" ").filter(w => w.length > 3);
            const keywordHits = [];
            for (const kw of keywords) {
                keywordHits.push(...this.graphStore.searchKeyword(kw, 5));
            }
            const nodeScores = new Map();
            semanticResults.forEach(res => {
                nodeScores.set(res.node.id, { node: res.node, score: res.score });
            });
            keywordHits.forEach(node => {
                nodeScores.set(node.id, { node, score: 1.0 });
            });
            const seeds = Array.from(nodeScores.values())
                .sort((a, b) => b.score - a.score)
                .slice(0, 10)
                .map(s => s.node);
            const expandedNodes = new Map();
            for (const seed of seeds) {
                expandedNodes.set(seed.id, seed);
                const neighbors = this.graphStore.getNeighbours(seed.id);
                neighbors.callees.forEach(n => expandedNodes.set(n.id, n));
                neighbors.callers.forEach(n => expandedNodes.set(n.id, n));
                if (seed.type === 'class' || seed.type === 'interface') {
                    const fileNodes = this.graphStore.getNodesByFile(seed.filePath);
                    fileNodes.forEach(n => {
                        if (n.className === seed.name) {
                            expandedNodes.set(n.id, n);
                        }
                    });
                }
            }
            const finalNodes = Array.from(expandedNodes.values()).slice(0, 20);
            if (finalNodes.length === 0) {
                return {
                    answer: "I couldn't find any relevant code in the graph to answer your question. Make sure the workspace is fully indexed.",
                    contextUsed: []
                };
            }
            const fileFrequency = new Map();
            finalNodes.forEach(n => fileFrequency.set(n.filePath, (fileFrequency.get(n.filePath) || 0) + 1));
            const topFiles = Array.from(fileFrequency.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 2) // Reduced from 3 to 2 files to save tokens
                .map(entry => entry[0]);
            let rawFileContext = '';
            for (const filePath of topFiles) {
                try {
                    // FIX: Ensure absolute path so fs.existsSync never fails
                    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(this.workspaceRoot, filePath);
                    if (fs.existsSync(absolutePath)) {
                        const content = fs.readFileSync(absolutePath, 'utf-8');
                        // Limit context to 10,000 chars per file to stay within token limits
                        rawFileContext += `\n\n--- RAW FILE: ${filePath} ---\n${content.substring(0, 10000)}${content.length > 10000 ? '\n...[TRUNCATED]' : ''}`;
                    }
                    else {
                        Logger_1.Logger.warn(`[ChatAgent] File not found at path: ${absolutePath}`);
                    }
                }
                catch (err) {
                    Logger_1.Logger.warn(`[ChatAgent] Could not read file for context: ${filePath}`);
                }
            }
            const contextUsed = finalNodes.map(n => ({
                name: n.name,
                type: n.type,
                filePath: n.filePath
            }));
            const nodeBlocks = finalNodes.map(n => {
                return `Node: ${n.name} (${n.type})\nClass: ${n.className || 'None'}\nFile: ${n.filePath}\nSignature: ${n.signature}\nDocstring: ${n.docstring}`;
            });
            const systemPrompt = `You are an expert AI coding assistant. Answer the user's question using the provided codebase context. 

CRITICAL INSTRUCTIONS:
1. The symbols, classes, and functions listed in the GRAPH NODES definitively exist in the user's project. Do not hallucinate.
2. If asked to list functions of a class or explain a flow, look at BOTH the Graph Nodes and the Raw File contents. The Raw File contents contain the ENTIRE code for those files. Read them completely.
3. Format your response in clean Markdown.

=== GRAPH NODES FOUND (Expanded Context) ===${nodeBlocks.join('\n\n')}

=== ACTUAL FILE CONTENTS (Full Source Code) ===${rawFileContext}

USER QUESTION:${userQuery}

ANSWER:`;
            const answer = await this.llmClient.complete(systemPrompt, 1500); // Reduced to fit within TPM limits
            return { answer, contextUsed };
        }
        catch (error) {
            Logger_1.Logger.error(`[ChatAgent] Error answering query: ${error}`);
            return {
                answer: `Sorry, I encountered an error: ${error instanceof Error ? error.message : error}`,
                contextUsed: []
            };
        }
    }
}
exports.CodeChatAgent = CodeChatAgent;
//# sourceMappingURL=CodeChatAgent.js.map