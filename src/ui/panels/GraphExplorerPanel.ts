/**
 * GraphExplorerPanel — VS Code Webview panel rendering an interactive
 * D3 force-directed graph of the codebase knowledge graph.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { GraphStore } from '../../core/graph/GraphStore';

export class GraphExplorerPanel implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly store: GraphStore
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri],
    };
    webviewView.webview.html = this.buildHtml(webviewView.webview);

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage(async msg => {
      if (msg.type === 'ready') {
        this.sendGraphData();
      }
      if (msg.type === 'search') {
        const results = this.store.searchKeyword(msg.query, 20);
        webviewView.webview.postMessage({ type: 'searchResults', results });
      }
      if (msg.type === 'nodeClick') {
        const node = this.store.getNode(msg.id);
        const neighbours = this.store.getNeighbours(msg.id);
        webviewView.webview.postMessage({ type: 'nodeDetail', node, neighbours });
      }
    });
  }

  refresh(): void {
    if (this.view) this.sendGraphData();
  }

  private sendGraphData(): void {
    const nodes = this.store.getAllNodes().slice(0, 500); // cap for performance
    const edges = this.store.getAllEdges().slice(0, 1000);
    this.view?.webview.postMessage({ type: 'graphData', nodes, edges });
  }

  private buildHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
             script-src 'nonce-${nonce}' https://d3js.org;
             style-src 'unsafe-inline';
             connect-src 'none';">
  <style>
    :root {
      --bg: #0d1117;
      --surface: #161b22;
      --border: #30363d;
      --accent: #58a6ff;
      --accent2: #3fb950;
      --warn: #f0883e;
      --text: #c9d1d9;
      --muted: #8b949e;
      --node-fn: #58a6ff;
      --node-cls: #3fb950;
      --node-file: #f0883e;
      --node-iface: #bc8cff;
      --node-method: #79c0ff;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;
      font-size: 12px;
      overflow: hidden;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }

    #toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }

    #search {
      flex: 1;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 4px;
      color: var(--text);
      padding: 4px 8px;
      font-family: inherit;
      font-size: 11px;
      outline: none;
    }
    #search:focus { border-color: var(--accent); }
    #search::placeholder { color: var(--muted); }

    #stats {
      color: var(--muted);
      font-size: 10px;
      white-space: nowrap;
    }

    #main {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    #graph-container {
      flex: 1;
      position: relative;
      overflow: hidden;
      cursor: grab;
    }
    #graph-container:active { cursor: grabbing; }

    #graph-container svg {
      width: 100%;
      height: 100%;
    }

    /* Node detail sidebar */
    #detail {
      width: 220px;
      background: var(--surface);
      border-left: 1px solid var(--border);
      padding: 12px;
      overflow-y: auto;
      font-size: 11px;
      flex-shrink: 0;
      transition: width 0.2s;
    }
    #detail.hidden { width: 0; padding: 0; overflow: hidden; }

    #detail h3 {
      color: var(--accent);
      margin-bottom: 8px;
      font-size: 12px;
      word-break: break-all;
    }

    .detail-row {
      margin-bottom: 8px;
    }
    .detail-label {
      color: var(--muted);
      text-transform: uppercase;
      font-size: 9px;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    .detail-value {
      color: var(--text);
      word-break: break-all;
    }
    .detail-value.code {
      background: var(--bg);
      border-radius: 3px;
      padding: 4px 6px;
      color: var(--accent2);
    }

    .neighbours-section { margin-top: 10px; }
    .neighbour-chip {
      display: inline-block;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 3px;
      padding: 2px 5px;
      margin: 2px 2px 0 0;
      color: var(--accent);
      cursor: pointer;
      font-size: 10px;
    }
    .neighbour-chip:hover { border-color: var(--accent); }

    /* Legend */
    #legend {
      display: flex;
      gap: 10px;
      align-items: center;
      padding: 0 8px;
    }
    .legend-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 3px;
      font-size: 10px;
      color: var(--muted);
    }

    /* Tooltip */
    #tooltip {
      position: absolute;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 6px 10px;
      font-size: 11px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s;
      max-width: 200px;
      z-index: 10;
      white-space: nowrap;
    }

    .highlighted { filter: brightness(1.8); }
  </style>
</head>
<body>

<div id="toolbar">
  <input id="search" placeholder="Search symbols…" autocomplete="off" />
  <div id="legend">
    <div class="legend-item"><div class="legend-dot" style="background:#58a6ff"></div>fn</div>
    <div class="legend-item"><div class="legend-dot" style="background:#3fb950"></div>class</div>
    <div class="legend-item"><div class="legend-dot" style="background:#f0883e"></div>file</div>
    <div class="legend-item"><div class="legend-dot" style="background:#bc8cff"></div>iface</div>
  </div>
  <div id="stats">Loading…</div>
</div>

<div id="main">
  <div id="graph-container">
    <svg id="svg"></svg>
    <div id="tooltip"></div>
  </div>
  <div id="detail" class="hidden">
    <h3 id="detail-name">—</h3>
    <div id="detail-content"></div>
  </div>
</div>

<script nonce="${nonce}" src="https://d3js.org/d3.v7.min.js"></script>
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const svg = d3.select('#svg');
  const tooltip = document.getElementById('tooltip');
  const statsEl = document.getElementById('stats');
  const detailEl = document.getElementById('detail');
  const detailNameEl = document.getElementById('detail-name');
  const detailContentEl = document.getElementById('detail-content');

  let simulation = null;
  let allNodes = [], allEdges = [];
  let highlighted = new Set();

  const colorMap = {
    file: '#f0883e',
    class: '#3fb950',
    function: '#58a6ff',
    method: '#79c0ff',
    interface: '#bc8cff',
  };

  // ── D3 setup ─────────────────────────────────────────────────────────────
  const g = svg.append('g');

  // Zoom + pan
  svg.call(d3.zoom().scaleExtent([0.05, 4]).on('zoom', e => g.attr('transform', e.transform)));

  // Arrow markers
  svg.append('defs').selectAll('marker')
    .data(['CALLS', 'IMPORTS', 'CONTAINS'])
    .join('marker')
    .attr('id', d => 'arrow-' + d)
    .attr('viewBox', '0 -4 8 8')
    .attr('refX', 18)
    .attr('refY', 0)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-4L8,0L0,4')
    .attr('fill', d => d === 'CALLS' ? '#58a6ff44' : d === 'IMPORTS' ? '#3fb95044' : '#30363d');

  let linkSel, nodeSel, labelSel;

  function renderGraph(nodes, edges) {
    allNodes = nodes;
    allEdges = edges;

    statsEl.textContent = nodes.length + ' nodes · ' + edges.length + ' edges';

    // Build id → node map
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Filter edges to only those with both endpoints present
    const validEdges = edges.filter(e => nodeMap.has(e.sourceId) && nodeMap.has(e.targetId));

    // D3 expects objects with references for simulation
    const d3nodes = nodes.map(n => ({ ...n }));
    const nodeById = new Map(d3nodes.map(n => [n.id, n]));
    const d3links = validEdges.map(e => ({
      source: nodeById.get(e.sourceId),
      target: nodeById.get(e.targetId),
      type: e.relationType,
    })).filter(l => l.source && l.target);

    if (simulation) simulation.stop();

    simulation = d3.forceSimulation(d3nodes)
      .force('link', d3.forceLink(d3links).id(d => d.id).distance(60).strength(0.4))
      .force('charge', d3.forceManyBody().strength(-120))
      .force('center', d3.forceCenter(
        document.getElementById('graph-container').clientWidth / 2,
        document.getElementById('graph-container').clientHeight / 2
      ))
      .force('collision', d3.forceCollide(16));

    // Links
    g.selectAll('.link').remove();
    linkSel = g.append('g').attr('class', 'links')
      .selectAll('line')
      .data(d3links)
      .join('line')
      .attr('stroke', d => d.type === 'CALLS' ? '#58a6ff33' : d.type === 'IMPORTS' ? '#3fb95033' : '#30363d')
      .attr('stroke-width', 1)
      .attr('marker-end', d => 'url(#arrow-' + d.type + ')');

    // Nodes
    g.selectAll('.node-g').remove();
    const nodeG = g.append('g').attr('class', 'nodes')
      .selectAll('g')
      .data(d3nodes)
      .join('g')
      .attr('class', 'node-g')
      .call(d3.drag()
        .on('start', dragStart)
        .on('drag', dragging)
        .on('end', dragEnd)
      )
      .on('click', (event, d) => {
        event.stopPropagation();
        vscode.postMessage({ type: 'nodeClick', id: d.id });
      })
      .on('mouseover', (event, d) => {
        tooltip.style.opacity = '1';
        tooltip.innerHTML = '<strong>' + escHtml(d.name) + '</strong><br><span style="color:#8b949e">' + d.type + '</span>';
      })
      .on('mousemove', event => {
        const box = document.getElementById('graph-container').getBoundingClientRect();
        tooltip.style.left = (event.clientX - box.left + 12) + 'px';
        tooltip.style.top = (event.clientY - box.top + 12) + 'px';
      })
      .on('mouseout', () => { tooltip.style.opacity = '0'; });

    nodeG.append('circle')
      .attr('r', d => d.type === 'file' ? 5 : d.type === 'class' ? 8 : 6)
      .attr('fill', d => colorMap[d.type] || '#8b949e')
      .attr('fill-opacity', 0.85)
      .attr('stroke', d => colorMap[d.type] || '#8b949e')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.4);

    // Labels (only for class/interface nodes to keep it readable)
    nodeG.filter(d => d.type === 'class' || d.type === 'interface')
      .append('text')
      .attr('dx', 10)
      .attr('dy', '0.35em')
      .attr('fill', '#c9d1d9')
      .attr('font-size', '9px')
      .text(d => d.name.length > 16 ? d.name.slice(0, 14) + '…' : d.name);

    simulation.on('tick', () => {
      linkSel
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      nodeG.attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');
    });
  }

  function dragStart(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x; d.fy = d.y;
  }
  function dragging(event, d) { d.fx = event.x; d.fy = event.y; }
  function dragEnd(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null; d.fy = null;
  }

  // ── Node detail panel ─────────────────────────────────────────────────────
  function showDetail(node, neighbours) {
    detailEl.classList.remove('hidden');
    detailNameEl.textContent = node.name;

    let html = '';
    html += row('Type', node.type);
    html += row('File', node.filePath.split('/').slice(-2).join('/'));
    if (node.signature) html += row('Signature', node.signature, true);
    if (node.docstring) html += row('Intent', node.docstring);
    if (node.startLine) html += row('Lines', node.startLine + '–' + node.endLine);

    if (neighbours.callees?.length) {
      html += '<div class="neighbours-section"><div class="detail-label">Calls</div>';
      html += neighbours.callees.map(n =>
        '<span class="neighbour-chip" onclick="clickNeighbour(\'' + escHtml(n.id) + '\')">' + escHtml(n.name) + '</span>'
      ).join('');
      html += '</div>';
    }
    if (neighbours.callers?.length) {
      html += '<div class="neighbours-section"><div class="detail-label">Called by</div>';
      html += neighbours.callers.map(n =>
        '<span class="neighbour-chip" onclick="clickNeighbour(\'' + escHtml(n.id) + '\')">' + escHtml(n.name) + '</span>'
      ).join('');
      html += '</div>';
    }

    detailContentEl.innerHTML = html;
  }

  function clickNeighbour(id) {
    vscode.postMessage({ type: 'nodeClick', id });
  }

  function row(label, value, code = false) {
    return '<div class="detail-row"><div class="detail-label">' + label + '</div>'
         + '<div class="detail-value' + (code ? ' code' : '') + '">' + escHtml(value) + '</div></div>';
  }

  // ── Search ────────────────────────────────────────────────────────────────
  document.getElementById('search').addEventListener('input', e => {
    const q = e.target.value.trim();
    if (q.length < 2) return;
    vscode.postMessage({ type: 'search', query: q });
  });

  // ── Message handler ───────────────────────────────────────────────────────
  window.addEventListener('message', ev => {
    const msg = ev.data;
    if (msg.type === 'graphData') {
      renderGraph(msg.nodes, msg.edges);
    }
    if (msg.type === 'nodeDetail') {
      showDetail(msg.node, msg.neighbours);
    }
    if (msg.type === 'searchResults') {
      // Highlight matched nodes
      const ids = new Set(msg.results.map(n => n.id));
      g.selectAll('.node-g circle')
        .attr('fill-opacity', d => ids.has(d.id) ? 1 : 0.2)
        .attr('r', d => ids.has(d.id) ? 10 : (d.type === 'file' ? 5 : d.type === 'class' ? 8 : 6));
    }
  });

  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // Signal ready
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
