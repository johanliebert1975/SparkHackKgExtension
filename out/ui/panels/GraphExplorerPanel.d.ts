/**
 * GraphExplorerPanel — VS Code Webview panel rendering an interactive
 * D3 force-directed graph of the codebase knowledge graph.
 */
import * as vscode from 'vscode';
import { GraphStore } from '../../core/graph/GraphStore';
export declare class GraphExplorerPanel implements vscode.WebviewViewProvider {
    private readonly context;
    private readonly store;
    private view?;
    constructor(context: vscode.ExtensionContext, store: GraphStore);
    resolveWebviewView(webviewView: vscode.WebviewView): void;
    refresh(): void;
    private sendGraphData;
    private buildHtml;
}
