/**
 * ContextInspectorPanel — "Dev Mode" transparency panel.
 * Updates in real-time whenever the AI queries the MCP server.
 */
import * as vscode from 'vscode';
import { GraphStore } from '../../core/graph/GraphStore';
import { MCPQueryEvent } from '../../core/mcp/MCPServer';
export declare class ContextInspectorPanel implements vscode.WebviewViewProvider {
    private readonly context;
    private readonly store;
    private view?;
    private events;
    constructor(context: vscode.ExtensionContext, store: GraphStore);
    resolveWebviewView(webviewView: vscode.WebviewView): void;
    /** Called by MCPServer when a tool is invoked */
    onMCPQuery(event: MCPQueryEvent): void;
    private sendStats;
    private sendEvents;
    private buildHtml;
}
