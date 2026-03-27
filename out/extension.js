"use strict";
/**
 * Semantic Code Knowledge Graph — VS Code Extension
 * Entry point: registers commands, starts watchers, boots MCP + UI servers.
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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const GraphStore_1 = require("./core/graph/GraphStore");
const FileParser_1 = require("./core/parser/FileParser");
const EmbeddingEngine_1 = require("./core/embeddings/EmbeddingEngine");
const MCPServer_1 = require("./core/mcp/MCPServer");
const CommitDiffEngine_1 = require("./core/diff/CommitDiffEngine");
const CallResolver_1 = require("./core/analysis/CallResolver");
const CommunityDetector_1 = require("./core/analysis/CommunityDetector");
const GraphUIServer_1 = require("./ui/GraphUIServer");
const StatusBar_1 = require("./utils/StatusBar");
const Logger_1 = require("./utils/Logger");
let graphStore = null;
let mcpServer = null;
let uiServer = null;
let statusBar = null;
async function activate(context) {
    Logger_1.Logger.init(context);
    Logger_1.Logger.info('Semantic Knowledge Graph extension activating...');
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
        Logger_1.Logger.warn('No workspace folder open — extension idle.');
        return;
    }
    // ── Core modules ──────────────────────────────────────────────────────────
    const storagePath = context.storageUri?.fsPath ?? context.globalStorageUri.fsPath;
    graphStore = new GraphStore_1.GraphStore(storagePath, workspaceRoot);
    await graphStore.initialize();
    const extensionRoot = context.extensionUri.fsPath;
    const parser = new FileParser_1.FileParser(workspaceRoot, extensionRoot);
    const callResolver = new CallResolver_1.CallResolver(workspaceRoot, extensionRoot);
    const communityDetector = new CommunityDetector_1.CommunityDetector(graphStore);
    const embeddingEngine = new EmbeddingEngine_1.EmbeddingEngine(graphStore);
    const diffEngine = new CommitDiffEngine_1.CommitDiffEngine(workspaceRoot, graphStore);
    // ── Status bar ────────────────────────────────────────────────────────────
    statusBar = new StatusBar_1.IndexingStatusBar();
    context.subscriptions.push(statusBar);
    // ── Initial full index ────────────────────────────────────────────────────
    await runFullIndex(workspaceRoot, parser, callResolver, communityDetector, embeddingEngine, graphStore, statusBar);
    // ── MCP server ────────────────────────────────────────────────────────────
    const config = vscode.workspace.getConfiguration('semanticKG');
    const mcpPort = config.get('mcpPort', 3579);
    mcpServer = new MCPServer_1.MCPServer(graphStore, embeddingEngine, mcpPort);
    await mcpServer.start();
    Logger_1.Logger.info(`MCP server → http://localhost:${mcpPort}/mcp`);
    // ── Graph UI server ───────────────────────────────────────────────────────
    const uiPort = config.get('uiPort', 3580);
    uiServer = new GraphUIServer_1.GraphUIServer(graphStore, uiPort);
    uiServer.start();
    Logger_1.Logger.info(`Graph UI  → http://localhost:${uiPort}`);
    vscode.window.showInformationMessage(`Knowledge Graph ready! Open http://localhost:${uiPort} to explore.`, 'Open in Browser').then(action => {
        if (action === 'Open in Browser') {
            vscode.env.openExternal(vscode.Uri.parse(`http://localhost:${uiPort}`));
        }
    });
    // ── File watcher ──────────────────────────────────────────────────────────
    const autoRebuild = config.get('autoRebuildOnSave', true);
    if (autoRebuild) {
        const watcher = vscode.workspace.createFileSystemWatcher('**/*.{ts,js,py,tsx,jsx,java,go,rs,cpp,c,h,mjs}');
        watcher.onDidChange(uri => onFileChanged(uri, parser, callResolver, embeddingEngine, graphStore, statusBar));
        watcher.onDidCreate(uri => onFileChanged(uri, parser, callResolver, embeddingEngine, graphStore, statusBar));
        watcher.onDidDelete(uri => graphStore.removeFile(uri.fsPath));
        context.subscriptions.push(watcher);
    }
    // ── Subscriptions / cleanup ───────────────────────────────────────────────
    context.subscriptions.push({ dispose: () => uiServer?.stop() });
    // ── Commands ──────────────────────────────────────────────────────────────
    context.subscriptions.push(vscode.commands.registerCommand('semanticKG.rebuildGraph', async () => {
        await runFullIndex(workspaceRoot, parser, callResolver, communityDetector, embeddingEngine, graphStore, statusBar);
        vscode.window.showInformationMessage('Knowledge graph rebuilt!');
    }), vscode.commands.registerCommand('semanticKG.openGraphExplorer', () => {
        vscode.env.openExternal(vscode.Uri.parse(`http://localhost:${uiPort}`));
    }), vscode.commands.registerCommand('semanticKG.runCommunityDetection', async () => {
        statusBar?.setStatus('thinking');
        try {
            await communityDetector.detect();
            vscode.window.showInformationMessage('Community detection complete!');
        }
        finally {
            statusBar?.setStatus('idle');
        }
    }), vscode.commands.registerCommand('semanticKG.suggestCommitMessage', async () => {
        statusBar?.setStatus('thinking');
        try {
            const message = await diffEngine.generateCommitMessage();
            if (message) {
                const action = await vscode.window.showInformationMessage(`Suggested: ${message}`, 'Copy to Clipboard', 'Use in SCM');
                if (action === 'Copy to Clipboard') {
                    await vscode.env.clipboard.writeText(message);
                }
                else if (action === 'Use in SCM') {
                    await vscode.commands.executeCommand('workbench.view.scm');
                }
            }
        }
        catch (err) {
            vscode.window.showErrorMessage(`Commit message generation failed: ${err}`);
        }
        finally {
            statusBar?.setStatus('idle');
        }
    }));
    Logger_1.Logger.info('Semantic Knowledge Graph extension active ✓');
}
// ── Full index pipeline ────────────────────────────────────────────────────────
// Phase 1: Parse → nodes + structural edges (CONTAINS, EXTENDS, IMPLEMENTS)
// Phase 2: Resolve CALL edges
// Phase 3: Community detection
// Phase 4: Generate embeddings for missing nodes
async function runFullIndex(workspaceRoot, parser, callResolver, communityDetector, embeddingEngine, store, statusBar) {
    statusBar.setStatus('indexing');
    try {
        // Phase 1 — symbol extraction
        Logger_1.Logger.info('[Phase 1] Parsing workspace symbols...');
        const { nodes, edges: structuralEdges } = await parser.parseWorkspace();
        await store.upsertNodes(nodes);
        store.upsertEdges(structuralEdges);
        const stats1 = store.getStats();
        Logger_1.Logger.info(`[Phase 1] Done: ${stats1.nodes} nodes, ${stats1.edges} structural edges. ` +
            `By type: ${JSON.stringify(stats1.byType)}`);
        // Phase 2 — CALL edge resolution
        Logger_1.Logger.info('[Phase 2] Resolving CALL edges...');
        const callEdges = await callResolver.resolveWorkspace(store);
        store.upsertEdges(callEdges);
        // --> ADD THIS LINE TO FIX HERITAGE <--
        await callResolver.resolveHeritage(store);
        const stats2 = store.getStats();
        Logger_1.Logger.info(`[Phase 2] Done: ${callEdges.length} CALL edges added (total edges: ${stats2.edges})`);
        // Phase 3 — community detection
        Logger_1.Logger.info('[Phase 3] Running community detection...');
        statusBar.setStatus('thinking');
        await communityDetector.detect();
        Logger_1.Logger.info('[Phase 3] Done');
        // Phase 4 — embeddings
        Logger_1.Logger.info('[Phase 4] Generating embeddings...');
        statusBar.setStatus('embedding');
        await embeddingEngine.generateMissingEmbeddings();
        Logger_1.Logger.info('[Phase 4] Done');
        // --> ADD THIS ENTIRE BLOCK FOR DEVELOPER INTENT <--
        // Phase 5 — Developer Intent (LLM Docstrings)
        Logger_1.Logger.info('[Phase 5] Generating missing docstrings via LLM...');
        statusBar.setStatus('thinking');
        await embeddingEngine.generateMissingDocstrings();
        Logger_1.Logger.info('[Phase 5] Done');
        store.persist();
    }
    catch (err) {
        Logger_1.Logger.error('Full index failed', err);
        vscode.window.showErrorMessage(`Knowledge graph indexing failed: ${err}`);
    }
    finally {
        statusBar.setStatus('idle');
    }
}
// ── Incremental update on file save ───────────────────────────────────────────
async function onFileChanged(uri, parser, callResolver, embeddingEngine, store, statusBar) {
    statusBar.setStatus('indexing');
    try {
        const { nodes, edges: structuralEdges } = await parser.parseFile(uri.fsPath);
        await store.upsertNodes(nodes);
        store.upsertEdges(structuralEdges);
        // Re-resolve CALL edges only for this file
        const callEdges = await callResolver.resolveWorkspace(store);
        store.upsertEdges(callEdges);
        await embeddingEngine.generateMissingEmbeddings();
        Logger_1.Logger.info(`Incremental update: ${uri.fsPath}`);
    }
    catch (err) {
        Logger_1.Logger.warn(`Incremental update failed for ${uri.fsPath}: ${err}`);
    }
    finally {
        statusBar.setStatus('idle');
    }
}
function deactivate() {
    mcpServer?.stop();
    uiServer?.stop();
    graphStore?.close();
    Logger_1.Logger.info('Semantic Knowledge Graph extension deactivated.');
}
//# sourceMappingURL=extension.js.map