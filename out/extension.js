"use strict";
/**
 * Semantic Code Knowledge Graph — VS Code Extension
 * Entry point: registers commands, starts watchers, boots MCP server.
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
const GraphExplorerPanel_1 = require("./ui/panels/GraphExplorerPanel");
const ContextInspectorPanel_1 = require("./ui/panels/ContextInspectorPanel");
const StatusBar_1 = require("./utils/StatusBar");
const Logger_1 = require("./utils/Logger");
let graphStore = null;
let mcpServer = null;
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
    const storagePath = context.globalStorageUri.fsPath;
    graphStore = new GraphStore_1.GraphStore(storagePath, workspaceRoot);
    await graphStore.initialize();
    const parser = new FileParser_1.FileParser(workspaceRoot, context.extensionUri.fsPath);
    const embeddingEngine = new EmbeddingEngine_1.EmbeddingEngine(graphStore);
    const diffEngine = new CommitDiffEngine_1.CommitDiffEngine(workspaceRoot, graphStore);
    // ── Status bar ────────────────────────────────────────────────────────────
    statusBar = new StatusBar_1.IndexingStatusBar();
    context.subscriptions.push(statusBar);
    // ── Initial index ─────────────────────────────────────────────────────────
    await runFullIndex(workspaceRoot, parser, embeddingEngine, graphStore, statusBar);
    // ── MCP server ────────────────────────────────────────────────────────────
    const config = vscode.workspace.getConfiguration('semanticKG');
    const mcpPort = config.get('mcpPort', 3579);
    mcpServer = new MCPServer_1.MCPServer(graphStore, embeddingEngine, mcpPort);
    await mcpServer.start();
    Logger_1.Logger.info(`MCP server listening on port ${mcpPort}`);
    // ── File watcher ──────────────────────────────────────────────────────────
    const autoRebuild = config.get('autoRebuildOnSave', true);
    if (autoRebuild) {
        const watcher = vscode.workspace.createFileSystemWatcher('**/*.{ts,js,py,tsx,jsx,java,go,rs,cpp,c,h}');
        watcher.onDidChange(uri => onFileChanged(uri, parser, embeddingEngine, graphStore, statusBar));
        watcher.onDidCreate(uri => onFileChanged(uri, parser, embeddingEngine, graphStore, statusBar));
        watcher.onDidDelete(uri => graphStore.removeFile(uri.fsPath));
        context.subscriptions.push(watcher);
    }
    // ── Webview panels ────────────────────────────────────────────────────────
    const graphExplorerProvider = new GraphExplorerPanel_1.GraphExplorerPanel(context, graphStore);
    const contextInspectorProvider = new ContextInspectorPanel_1.ContextInspectorPanel(context, graphStore);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('semanticKG.graphExplorer', graphExplorerProvider), vscode.window.registerWebviewViewProvider('semanticKG.contextInspector', contextInspectorProvider));
    // ── Commands ──────────────────────────────────────────────────────────────
    context.subscriptions.push(vscode.commands.registerCommand('semanticKG.rebuildGraph', async () => {
        await runFullIndex(workspaceRoot, parser, embeddingEngine, graphStore, statusBar);
        vscode.window.showInformationMessage('Knowledge graph rebuilt!');
    }), vscode.commands.registerCommand('semanticKG.openGraphExplorer', () => {
        vscode.commands.executeCommand('semanticKG.graphExplorer.focus');
    }), vscode.commands.registerCommand('semanticKG.openContextInspector', () => {
        vscode.commands.executeCommand('semanticKG.contextInspector.focus');
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
async function runFullIndex(workspaceRoot, parser, embeddingEngine, store, statusBar) {
    statusBar.setStatus('indexing');
    try {
        Logger_1.Logger.info('Starting full workspace index...');
        const nodes = await parser.parseWorkspace();
        await store.upsertNodes(nodes);
        Logger_1.Logger.info(`Indexed ${nodes.length} symbols`);
        statusBar.setStatus('embedding');
        await embeddingEngine.generateMissingEmbeddings();
        Logger_1.Logger.info('Embeddings up to date');
    }
    catch (err) {
        Logger_1.Logger.error('Index failed', err);
        vscode.window.showErrorMessage(`Knowledge graph indexing failed: ${err}`);
    }
    finally {
        statusBar.setStatus('idle');
    }
}
async function onFileChanged(uri, parser, embeddingEngine, store, statusBar) {
    statusBar.setStatus('indexing');
    try {
        const nodes = await parser.parseFile(uri.fsPath);
        await store.upsertNodes(nodes);
        await embeddingEngine.generateMissingEmbeddings();
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
    graphStore?.close();
    Logger_1.Logger.info('Semantic Knowledge Graph extension deactivated.');
}
//# sourceMappingURL=extension.js.map