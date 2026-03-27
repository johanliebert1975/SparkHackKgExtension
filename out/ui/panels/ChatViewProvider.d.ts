import * as vscode from 'vscode';
import { CodeChatAgent } from '../../core/chat/CodeChatAgent';
export declare class ChatViewProvider implements vscode.WebviewViewProvider {
    private readonly _extensionUri;
    private readonly _chatAgent;
    static readonly viewType = "semanticKG.chatView";
    private _view?;
    constructor(_extensionUri: vscode.Uri, _chatAgent: CodeChatAgent);
    resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, _token: vscode.CancellationToken): void;
    private getHtmlForWebview;
}
