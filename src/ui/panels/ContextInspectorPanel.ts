/**
 * ContextInspectorPanel — "Dev Mode" transparency panel.
 * Updates in real-time whenever the AI queries the MCP server.
 */

import * as vscode from 'vscode';
import { GraphStore } from '../../core/graph/GraphStore';
import { MCPQueryEvent } from '../../core/mcp/MCPServer';

export class ContextInspectorPanel implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private events: MCPQueryEvent[] = [];

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly store: GraphStore
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.buildHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(msg => {
      if (msg.type === 'ready') {
        this.sendStats();
        this.sendEvents();
      }
      if (msg.type === 'clearEvents') {
        this.events = [];
        this.sendEvents();
      }
    });
  }

  /** Called by MCPServer when a tool is invoked */
  onMCPQuery(event: MCPQueryEvent): void {
    this.events.unshift(event); // newest first
    if (this.events.length > 50) this.events.pop();
    this.sendEvents();
    this.sendStats();
  }

  private sendStats(): void {
    const stats = this.store.getStats();
    this.view?.webview.postMessage({ type: 'stats', stats });
  }

  private sendEvents(): void {
    this.view?.webview.postMessage({ type: 'events', events: this.events });
  }

  private buildHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
  <style>
    :root {
      --bg: #0d1117;
      --surface: #161b22;
      --border: #30363d;
      --accent: #58a6ff;
      --green: #3fb950;
      --orange: #f0883e;
      --purple: #bc8cff;
      --text: #c9d1d9;
      --muted: #8b949e;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'SF Mono', 'Cascadia Code', monospace;
      font-size: 11px;
      padding: 10px;
    }

    h2 {
      font-size: 11px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }

    /* Stats bar */
    #stats-bar {
      display: flex;
      gap: 12px;
      margin-bottom: 12px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 8px 12px;
    }

    .stat {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .stat-value {
      font-size: 18px;
      font-weight: 700;
      color: var(--accent);
    }
    .stat-label {
      color: var(--muted);
      font-size: 9px;
      text-transform: uppercase;
    }

    /* MCP status */
    #mcp-status {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 12px;
      font-size: 10px;
      color: var(--muted);
    }
    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--green);
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%,100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    /* Events list */
    #events-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }

    button#clear {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--muted);
      border-radius: 3px;
      padding: 2px 6px;
      font-size: 9px;
      cursor: pointer;
      font-family: inherit;
    }
    button#clear:hover { border-color: var(--accent); color: var(--accent); }

    #events-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .event-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 5px;
      padding: 7px 10px;
      border-left: 3px solid var(--accent);
      animation: slideIn 0.2s ease;
    }
    @keyframes slideIn {
      from { opacity: 0; transform: translateX(-6px); }
      to { opacity: 1; transform: translateX(0); }
    }

    .event-card.tool-search_intent     { border-left-color: var(--purple); }
    .event-card.tool-get_blast_radius  { border-left-color: var(--orange); }
    .event-card.tool-explore_symbol    { border-left-color: var(--accent); }
    .event-card.tool-suggest_commit_message { border-left-color: var(--green); }

    .event-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    .event-tool {
      font-weight: 600;
      color: var(--accent);
      font-size: 11px;
    }
    .event-time {
      color: var(--muted);
      font-size: 9px;
    }

    .event-params {
      color: var(--muted);
      font-size: 10px;
      background: var(--bg);
      border-radius: 3px;
      padding: 3px 5px;
      margin-top: 3px;
      word-break: break-all;
    }

    .event-results {
      display: inline-block;
      margin-top: 4px;
      background: var(--green);
      color: #000;
      border-radius: 3px;
      padding: 1px 5px;
      font-size: 9px;
      font-weight: 700;
    }

    .empty-state {
      color: var(--muted);
      text-align: center;
      padding: 24px 0;
      font-size: 10px;
    }
  </style>
</head>
<body>

<div id="stats-bar">
  <div class="stat">
    <div class="stat-value" id="stat-nodes">—</div>
    <div class="stat-label">Nodes</div>
  </div>
  <div class="stat">
    <div class="stat-value" id="stat-edges">—</div>
    <div class="stat-label">Edges</div>
  </div>
  <div class="stat">
    <div class="stat-value" id="stat-emb">—</div>
    <div class="stat-label">Embedded</div>
  </div>
</div>

<div id="mcp-status">
  <div class="dot"></div>
  MCP server active — AI agents can connect
</div>

<div id="events-header">
  <h2>AI Context Queries</h2>
  <button id="clear">Clear</button>
</div>

<div id="events-list">
  <div class="empty-state">No AI queries yet.<br>The AI's MCP tool calls will appear here in real-time.</div>
</div>

<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();

  document.getElementById('clear').onclick = () => {
    vscode.postMessage({ type: 'clearEvents' });
  };

  function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString();
  }

  function renderEvents(events) {
    const list = document.getElementById('events-list');
    if (events.length === 0) {
      list.innerHTML = '<div class="empty-state">No AI queries yet.<br>The AI\'s MCP tool calls will appear here in real-time.</div>';
      return;
    }
    list.innerHTML = events.map(ev => {
      const params = JSON.stringify(ev.params, null, 0);
      const shortParams = params.length > 80 ? params.slice(0, 78) + '…' : params;
      return '<div class="event-card tool-' + ev.tool + '">' +
        '<div class="event-header">' +
          '<span class="event-tool">' + escHtml(ev.tool) + '</span>' +
          '<span class="event-time">' + formatTime(ev.timestamp) + '</span>' +
        '</div>' +
        '<div class="event-params">' + escHtml(shortParams) + '</div>' +
        '<span class="event-results">' + ev.resultCount + ' result' + (ev.resultCount !== 1 ? 's' : '') + '</span>' +
      '</div>';
    }).join('');
  }

  window.addEventListener('message', ev => {
    const msg = ev.data;
    if (msg.type === 'stats') {
      document.getElementById('stat-nodes').textContent = msg.stats.nodes;
      document.getElementById('stat-edges').textContent = msg.stats.edges;
      document.getElementById('stat-emb').textContent = msg.stats.withEmbeddings;
    }
    if (msg.type === 'events') {
      renderEvents(msg.events);
    }
  });

  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  vscode.postMessage({ type: 'ready' });
</script>
</body>
</html>`;
  }
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
