import * as vscode from 'vscode';
import { CodeChatAgent } from '../../core/chat/CodeChatAgent';

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'semanticKG.chatView';
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _chatAgent: CodeChatAgent
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.getHtmlForWebview();

    // Listen for messages from the UI
    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'askQuestion': {
          // Send a "thinking" message back to UI immediately
          this._view?.webview.postMessage({ type: 'thinking' });

          // Get answer from our RAG agent
          const answer = await this._chatAgent.askQuery(data.value);

          // Send the result back to the UI
          this._view?.webview.postMessage({ type: 'addResponse', value: answer });
          break;
        }
      }
    });
  }

  private getHtmlForWebview(): string {
    // A simple HTML/CSS/JS interface for the chat
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
              body { font-family: var(--vscode-font-family); padding: 10px; display: flex; flex-direction: column; height: 100vh; box-sizing: border-box; }
              #chat-container { flex-grow: 1; overflow-y: auto; margin-bottom: 10px; display: flex; flex-direction: column; gap: 10px; }
              .message { padding: 8px; border-radius: 5px; background: var(--vscode-editor-inactiveSelectionBackground); }
              .user-message { background: var(--vscode-button-background); color: var(--vscode-button-foreground); align-self: flex-end; }
              .ai-message { background: var(--vscode-editorWidget-background); border: 1px solid var(--vscode-widget-border); align-self: flex-start; }
              #input-container { display: flex; gap: 5px; padding-bottom: 20px;}
              input { flex-grow: 1; padding: 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); outline: none; }
              button { padding: 8px 12px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; cursor: pointer; }
              button:hover { background: var(--vscode-button-hoverBackground); }
          </style>
      </head>
      <body>
          <div id="chat-container">
            <div class="message ai-message">Hello! Ask me anything about this codebase.</div>
          </div>
          <div id="input-container">
              <input type="text" id="query-input" placeholder="e.g. How does GraphStore work?" />
              <button id="send-btn">Send</button>
          </div>

          <script>
              const vscode = acquireVsCodeApi();
              const chatContainer = document.getElementById('chat-container');
              const input = document.getElementById('query-input');
              const sendBtn = document.getElementById('send-btn');
              let thinkingDiv = null;

              function addMessage(text, isUser) {
                  const msg = document.createElement('div');
                  msg.className = 'message ' + (isUser ? 'user-message' : 'ai-message');
                  msg.innerText = text; // In a real app, you'd use a markdown parser here
                  chatContainer.appendChild(msg);
                  chatContainer.scrollTop = chatContainer.scrollHeight;
              }

              sendBtn.addEventListener('click', () => {
                  const text = input.value.trim();
                  if (text) {
                      addMessage(text, true);
                      vscode.postMessage({ type: 'askQuestion', value: text });
                      input.value = '';
                  }
              });

              input.addEventListener('keypress', (e) => {
                  if (e.key === 'Enter') sendBtn.click();
              });

              window.addEventListener('message', event => {
                  const message = event.data;
                  if (message.type === 'thinking') {
                      thinkingDiv = document.createElement('div');
                      thinkingDiv.className = 'message ai-message';
                      thinkingDiv.innerText = 'Thinking...';
                      chatContainer.appendChild(thinkingDiv);
                      chatContainer.scrollTop = chatContainer.scrollHeight;
                  } else if (message.type === 'addResponse') {
                      if (thinkingDiv) thinkingDiv.remove();
                      addMessage(message.value, false);
                  }
              });
          </script>
      </body>
      </html>
    `;
  }
}