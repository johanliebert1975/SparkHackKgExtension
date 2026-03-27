/**
 * Semantic Code Knowledge Graph — VS Code Extension
 * Entry point: registers commands, starts watchers, boots MCP + UI servers.
 */

import * as vscode from 'vscode';
import { GraphStore } from './core/graph/GraphStore';
import { FileParser } from './core/parser/FileParser';
import { EmbeddingEngine } from './core/embeddings/EmbeddingEngine';
import { MCPServer } from './core/mcp/MCPServer';
import { CommitDiffEngine } from './core/diff/CommitDiffEngine';
import { CallResolver } from './core/analysis/CallResolver';
import { CommunityDetector } from './core/analysis/CommunityDetector';
import { GraphUIServer } from './ui/GraphUIServer';
import { IndexingStatusBar } from './utils/StatusBar';
import { Logger } from './utils/Logger';
import { ContextInspectorPanel } from './ui/panels/ContextInspectorPanel';

// Chat Imports
import { LLMClient } from './core/mcp/LLMClient';
import { CodeChatAgent } from './core/chat/CodeChatAgent';
import { ChatUIServer } from './ui/ChatUIServer';

let graphStore: GraphStore | null = null;
let mcpServer: MCPServer | null = null;
let uiServer: GraphUIServer | null = null;
let chatUiServer: ChatUIServer | null = null;
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
  const storagePath = context.storageUri?.fsPath ?? context.globalStorageUri.fsPath;
  graphStore = new GraphStore(storagePath, workspaceRoot);
  await graphStore.initialize();

  const extensionRoot    = context.extensionUri.fsPath;
  const parser           = new FileParser(workspaceRoot, extensionRoot);
  const callResolver     = new CallResolver(workspaceRoot, extensionRoot);
  const communityDetector = new CommunityDetector(graphStore);
  const embeddingEngine  = new EmbeddingEngine(graphStore);
  const diffEngine       = new CommitDiffEngine(workspaceRoot, graphStore);

  // ── Status bar ────────────────────────────────────────────────────────────
  statusBar = new IndexingStatusBar();
  context.subscriptions.push(statusBar);

  // ── Initial full index ────────────────────────────────────────────────────
  await runFullIndex(
    workspaceRoot, parser, callResolver, communityDetector,
    embeddingEngine, graphStore, statusBar
  );

  const config  = vscode.workspace.getConfiguration('semanticKG');
  
  // ── RAG Chat Agent Setup ──────────────────────────────────────────────────
  const provider  = config.get<string>('llmProvider', 'gemini');
  const apiKey    = config.get<string>('llmApiKey', '');
  const model     = config.get<string>('llmModel', 'gemini-2.0-flash');
  const ollamaUrl = config.get<string>('ollamaUrl', 'http://localhost:11434');

  const llmClient = new LLMClient(provider, apiKey, model, ollamaUrl);
  const chatAgent = new CodeChatAgent(graphStore, embeddingEngine, llmClient);

  // ── External Chat UI Server ───────────────────────────────────────────────
  const chatUiPort: number = config.get('chatUiPort', 3581);
  chatUiServer = new ChatUIServer(chatAgent, chatUiPort);
  chatUiServer.start();
  Logger.info(`Chat UI   → http://localhost:${chatUiPort}`);

  // ── MCP server ────────────────────────────────────────────────────────────
  const mcpPort: number = config.get('mcpPort', 3579);
  mcpServer = new MCPServer(graphStore, embeddingEngine, mcpPort);
  await mcpServer.start();
  Logger.info(`MCP server → http://localhost:${mcpPort}/mcp`);

  // ── Context Inspector (Dev Mode) ──────────────────────────────────────────
  const contextInspectorProvider = new ContextInspectorPanel(context, graphStore);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('semanticKG.contextInspector', contextInspectorProvider)
  );

  // Pipe AI queries from the MCP Server directly into the UI Panel!
  mcpServer.onQuery((event) => {
    contextInspectorProvider.onMCPQuery(event);
  });

  // ── Graph UI server ───────────────────────────────────────────────────────
  const uiPort: number = config.get('uiPort', 3580);
  uiServer = new GraphUIServer(graphStore, uiPort);
  uiServer.start();
  Logger.info(`Graph UI  → http://localhost:${uiPort}`);

  // ── File watcher ──────────────────────────────────────────────────────────
  const autoRebuild: boolean = config.get('autoRebuildOnSave', true);
  if (autoRebuild) {
    const watcher = vscode.workspace.createFileSystemWatcher(
      '**/*.{ts,js,py,tsx,jsx,java,go,rs,cpp,c,h,mjs}'
    );
    watcher.onDidChange(uri =>
      onFileChanged(uri, parser, callResolver, embeddingEngine, graphStore!, statusBar!)
    );
    watcher.onDidCreate(uri =>
      onFileChanged(uri, parser, callResolver, embeddingEngine, graphStore!, statusBar!)
    );
    watcher.onDidDelete(uri => graphStore!.removeFile(uri.fsPath));
    context.subscriptions.push(watcher);
  }

  // ── Subscriptions / cleanup ───────────────────────────────────────────────
  context.subscriptions.push({ dispose: () => uiServer?.stop() });
  context.subscriptions.push({ dispose: () => chatUiServer?.stop() });

  // ── Commands ──────────────────────────────────────────────────────────────
  context.subscriptions.push(

    vscode.commands.registerCommand('semanticKG.rebuildGraph', async () => {
      await runFullIndex(
        workspaceRoot, parser, callResolver, communityDetector,
        embeddingEngine, graphStore!, statusBar!
      );
      vscode.window.showInformationMessage('Knowledge graph rebuilt!');
    }),

    vscode.commands.registerCommand('semanticKG.openGraphExplorer', () => {
      vscode.env.openExternal(vscode.Uri.parse(`http://localhost:${uiPort}`));
    }),

    vscode.commands.registerCommand('semanticKG.openChatUI', () => {
      vscode.env.openExternal(vscode.Uri.parse(`http://localhost:${chatUiPort}`));
    }),

    vscode.commands.registerCommand('semanticKG.runCommunityDetection', async () => {
      statusBar?.setStatus('thinking');
      try {
        await communityDetector.detect();
        vscode.window.showInformationMessage('Community detection complete!');
      } finally {
        statusBar?.setStatus('idle');
      }
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
  workspaceRoot:     string,
  parser:            FileParser,
  callResolver:      CallResolver,
  communityDetector: CommunityDetector,
  embeddingEngine:   EmbeddingEngine,
  store:             GraphStore,
  statusBar:         IndexingStatusBar,
): Promise<void> {
  statusBar.setStatus('indexing');

  try {
    Logger.info('[Phase 1] Parsing workspace symbols...');
    const { nodes, edges: structuralEdges } = await parser.parseWorkspace();
    await store.upsertNodes(nodes);
    store.upsertEdges(structuralEdges);
    
    Logger.info('[Phase 2] Resolving CALL edges...');
    const callEdges = await callResolver.resolveWorkspace(store);
    store.upsertEdges(callEdges);
    await callResolver.resolveHeritage(store);
    
    Logger.info('[Phase 3] Running community detection...');
    statusBar.setStatus('thinking');
    await communityDetector.detect();

    Logger.info('[Phase 4] Generating embeddings...');
    statusBar.setStatus('embedding');
    await embeddingEngine.generateMissingEmbeddings();

    // Logger.info('[Phase 5] Generating missing docstrings via LLM...');
    // await embeddingEngine.generateMissingDocstrings();

    store.persist();
    Logger.info('Indexing pipeline complete');

  } catch (err) {
    Logger.error('Full index failed', err);
    vscode.window.showErrorMessage(`Knowledge graph indexing failed: ${err}`);
  } finally {
    statusBar.setStatus('idle');
  }
}

async function onFileChanged(
  uri:            vscode.Uri,
  parser:         FileParser,
  callResolver:   CallResolver,
  embeddingEngine: EmbeddingEngine,
  store:          GraphStore,
  statusBar:      IndexingStatusBar,
): Promise<void> {
  statusBar.setStatus('indexing');
  try {
    const { nodes, edges: structuralEdges } = await parser.parseFile(uri.fsPath);
    await store.upsertNodes(nodes);
    store.upsertEdges(structuralEdges);

    const callEdges = await callResolver.resolveWorkspace(store);
    store.upsertEdges(callEdges);

    await embeddingEngine.generateMissingEmbeddings();
    Logger.info(`Incremental update: ${uri.fsPath}`);
  } catch (err) {
    Logger.warn(`Incremental update failed for ${uri.fsPath}: ${err}`);
  } finally {
    statusBar.setStatus('idle');
  }
}

export function deactivate(): void {
  mcpServer?.stop();
  uiServer?.stop();
  chatUiServer?.stop();
  graphStore?.close();
  Logger.info('Semantic Knowledge Graph extension deactivated.');
}