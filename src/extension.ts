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

let graphStore: GraphStore | null = null;
let mcpServer: MCPServer | null = null;
let uiServer: GraphUIServer | null = null;
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

  // ── MCP server ────────────────────────────────────────────────────────────
  const config  = vscode.workspace.getConfiguration('semanticKG');
  const mcpPort: number = config.get('mcpPort', 3579);
  mcpServer = new MCPServer(graphStore, embeddingEngine, mcpPort);
  await mcpServer.start();
  Logger.info(`MCP server → http://localhost:${mcpPort}/mcp`);

  // ── Graph UI server ───────────────────────────────────────────────────────
  const uiPort: number = config.get('uiPort', 3580);
  uiServer = new GraphUIServer(graphStore, uiPort);
  uiServer.start();
  Logger.info(`Graph UI  → http://localhost:${uiPort}`);
  vscode.window.showInformationMessage(
    `Knowledge Graph ready! Open http://localhost:${uiPort} to explore.`,
    'Open in Browser'
  ).then(action => {
    if (action === 'Open in Browser') {
      vscode.env.openExternal(vscode.Uri.parse(`http://localhost:${uiPort}`));
    }
  });

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

// ── Full index pipeline ────────────────────────────────────────────────────────
// Phase 1: Parse → nodes + structural edges (CONTAINS, EXTENDS, IMPLEMENTS)
// Phase 2: Resolve CALL edges
// Phase 3: Community detection
// Phase 4: Generate embeddings for missing nodes

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
    // Phase 1 — symbol extraction
    Logger.info('[Phase 1] Parsing workspace symbols...');
    const { nodes, edges: structuralEdges } = await parser.parseWorkspace();
    await store.upsertNodes(nodes);
    store.upsertEdges(structuralEdges);
    const stats1 = store.getStats();
    Logger.info(
      `[Phase 1] Done: ${stats1.nodes} nodes, ${stats1.edges} structural edges. ` +
      `By type: ${JSON.stringify(stats1.byType)}`
    );

    // Phase 2 — CALL edge resolution
    Logger.info('[Phase 2] Resolving CALL edges...');
    const callEdges = await callResolver.resolveWorkspace(store);
    store.upsertEdges(callEdges);
    
    // --> ADD THIS LINE TO FIX HERITAGE <--
    await callResolver.resolveHeritage(store);
    
    const stats2 = store.getStats();
    Logger.info(`[Phase 2] Done: ${callEdges.length} CALL edges added (total edges: ${stats2.edges})`);

    // Phase 3 — community detection
    Logger.info('[Phase 3] Running community detection...');
    statusBar.setStatus('thinking');
    await communityDetector.detect();
    Logger.info('[Phase 3] Done');

    // Phase 4 — embeddings
    Logger.info('[Phase 4] Generating embeddings...');
    statusBar.setStatus('embedding');
    await embeddingEngine.generateMissingEmbeddings();
    Logger.info('[Phase 4] Done');

    // --> ADD THIS ENTIRE BLOCK FOR DEVELOPER INTENT <--
    // Phase 5 — Developer Intent (LLM Docstrings)
    Logger.info('[Phase 5] Generating missing docstrings via LLM...');
    statusBar.setStatus('thinking');
    await embeddingEngine.generateMissingDocstrings();
    Logger.info('[Phase 5] Done');

    store.persist();

  } catch (err) {
    Logger.error('Full index failed', err);
    vscode.window.showErrorMessage(`Knowledge graph indexing failed: ${err}`);
  } finally {
    statusBar.setStatus('idle');
  }
}

// ── Incremental update on file save ───────────────────────────────────────────

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

    // Re-resolve CALL edges only for this file
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
  graphStore?.close();
  Logger.info('Semantic Knowledge Graph extension deactivated.');
}