/**
 * Semantic Code Knowledge Graph — VS Code Extension
 * Entry point: registers commands, starts watchers, boots MCP server.
 */

import * as vscode from 'vscode';
import { GraphStore } from './core/graph/GraphStore';
import { FileParser } from './core/parser/FileParser';
import { EmbeddingEngine } from './core/embeddings/EmbeddingEngine';
import { MCPServer } from './core/mcp/MCPServer';
import { CommitDiffEngine } from './core/diff/CommitDiffEngine';
import { GraphExplorerPanel } from './ui/panels/GraphExplorerPanel';
import { ContextInspectorPanel } from './ui/panels/ContextInspectorPanel';
import { IndexingStatusBar } from './utils/StatusBar';
import { Logger } from './utils/Logger';

let graphStore: GraphStore | null = null;
let mcpServer: MCPServer | null = null;
let statusBar: IndexingStatusBar | null = null;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  Logger.init(context);
  Logger.info('Semantic Knowledge Graph extension activating...');

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    Logger.warn('No workspace folder open — extension idle.');
    return;
  }

  // ── Core modules ──────────────────────────────────────────────────────────
  const storagePath = context.globalStorageUri.fsPath;
  graphStore = new GraphStore(storagePath, workspaceRoot);
  await graphStore.initialize();

  const parser = new FileParser(workspaceRoot, context.extensionUri.fsPath);
  const embeddingEngine = new EmbeddingEngine(graphStore);
  const diffEngine = new CommitDiffEngine(workspaceRoot, graphStore);

  // ── Status bar ────────────────────────────────────────────────────────────
  statusBar = new IndexingStatusBar();
  context.subscriptions.push(statusBar);

  // ── Initial index ─────────────────────────────────────────────────────────
  await runFullIndex(workspaceRoot, parser, embeddingEngine, graphStore, statusBar);

  // ── MCP server ────────────────────────────────────────────────────────────
  const config = vscode.workspace.getConfiguration('semanticKG');
  const mcpPort: number = config.get('mcpPort', 3579);
  mcpServer = new MCPServer(graphStore, embeddingEngine, mcpPort);
  await mcpServer.start();
  Logger.info(`MCP server listening on port ${mcpPort}`);

  // ── File watcher ──────────────────────────────────────────────────────────
  const autoRebuild: boolean = config.get('autoRebuildOnSave', true);
  if (autoRebuild) {
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.{ts,js,py,tsx,jsx,java,go,rs,cpp,c,h}');
    watcher.onDidChange(uri => onFileChanged(uri, parser, embeddingEngine, graphStore!, statusBar!));
    watcher.onDidCreate(uri => onFileChanged(uri, parser, embeddingEngine, graphStore!, statusBar!));
    watcher.onDidDelete(uri => graphStore!.removeFile(uri.fsPath));
    context.subscriptions.push(watcher);
  }

  // ── Webview panels ────────────────────────────────────────────────────────
  const graphExplorerProvider = new GraphExplorerPanel(context, graphStore);
  const contextInspectorProvider = new ContextInspectorPanel(context, graphStore);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('semanticKG.graphExplorer', graphExplorerProvider),
    vscode.window.registerWebviewViewProvider('semanticKG.contextInspector', contextInspectorProvider)
  );

  // ── Commands ──────────────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('semanticKG.rebuildGraph', async () => {
      await runFullIndex(workspaceRoot, parser, embeddingEngine, graphStore!, statusBar!);
      vscode.window.showInformationMessage('Knowledge graph rebuilt!');
    }),

    vscode.commands.registerCommand('semanticKG.openGraphExplorer', () => {
      vscode.commands.executeCommand('semanticKG.graphExplorer.focus');
    }),

    vscode.commands.registerCommand('semanticKG.openContextInspector', () => {
      vscode.commands.executeCommand('semanticKG.contextInspector.focus');
    }),

    vscode.commands.registerCommand('semanticKG.suggestCommitMessage', async () => {
      statusBar?.setStatus('thinking');
      try {
        const message = await diffEngine.generateCommitMessage();
        if (message) {
          const action = await vscode.window.showInformationMessage(
            `Suggested: ${message}`,
            'Copy to Clipboard',
            'Use in SCM'
          );
          if (action === 'Copy to Clipboard') {
            await vscode.env.clipboard.writeText(message);
          } else if (action === 'Use in SCM') {
            await vscode.commands.executeCommand('workbench.view.scm');
          }
        }
      } catch (err) {
        vscode.window.showErrorMessage(`Commit message generation failed: ${err}`);
      } finally {
        statusBar?.setStatus('idle');
      }
    })
  );

  Logger.info('Semantic Knowledge Graph extension active ✓');
}

async function runFullIndex(
  workspaceRoot: string,
  parser: FileParser,
  embeddingEngine: EmbeddingEngine,
  store: GraphStore,
  statusBar: IndexingStatusBar
): Promise<void> {
  statusBar.setStatus('indexing');
  try {
    Logger.info('Starting full workspace index...');
    const nodes = await parser.parseWorkspace();
    await store.upsertNodes(nodes);
    Logger.info(`Indexed ${nodes.length} symbols`);

    statusBar.setStatus('embedding');
    await embeddingEngine.generateMissingEmbeddings();
    Logger.info('Embeddings up to date');
  } catch (err) {
    Logger.error('Index failed', err);
    vscode.window.showErrorMessage(`Knowledge graph indexing failed: ${err}`);
  } finally {
    statusBar.setStatus('idle');
  }
}

async function onFileChanged(
  uri: vscode.Uri,
  parser: FileParser,
  embeddingEngine: EmbeddingEngine,
  store: GraphStore,
  statusBar: IndexingStatusBar
): Promise<void> {
  statusBar.setStatus('indexing');
  try {
    const nodes = await parser.parseFile(uri.fsPath);
    await store.upsertNodes(nodes);
    await embeddingEngine.generateMissingEmbeddings();
  } catch (err) {
    Logger.warn(`Incremental update failed for ${uri.fsPath}: ${err}`);
  } finally {
    statusBar.setStatus('idle');
  }
}

export function deactivate(): void {
  mcpServer?.stop();
  graphStore?.close();
  Logger.info('Semantic Knowledge Graph extension deactivated.');
}
