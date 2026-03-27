"use strict";
/**
 * GraphUIServer — localhost web UI for the knowledge graph.
 *
 * Features:
 *   - Node labels always visible (not just on hover)
 *   - Edge labels showing relation type
 *   - Filter by node type / community
 *   - Semantic + keyword search
 *   - Node expansion on click (highlight call paths)
 *   - Community color coding
 *   - Stats panel
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
exports.GraphUIServer = void 0;
const http = __importStar(require("http"));
const Logger_1 = require("../utils/Logger");
class GraphUIServer {
    constructor(store, port = 3580) {
        this.store = store;
        this.port = port;
        this.server = null;
    }
    start() {
        this.server = http.createServer((req, res) => {
            res.setHeader('Access-Control-Allow-Origin', '*');
            const url = req.url ?? '/';
            if (url === '/' || url === '/index.html') {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(this.buildHtml());
                return;
            }
            if (url === '/api/data') {
                const nodes = this.store.getAllNodes();
                const edges = this.store.getAllEdges();
                const stats = this.store.getStats();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ nodes, edges, stats }));
                return;
            }
            if (url.startsWith('/api/search?')) {
                const q = new URL(url, 'http://localhost').searchParams.get('q') ?? '';
                const results = this.store.searchKeyword(q, 30);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(results));
                return;
            }
            if (url.startsWith('/api/node/')) {
                const id = decodeURIComponent(url.replace('/api/node/', ''));
                const node = this.store.getNode(id);
                const neighbours = node ? this.store.getNeighbours(id) : { callers: [], callees: [] };
                const blast = node ? this.store.getBlastRadius(id, 3) : [];
                // Fetch the link using the method we added to GraphStore
                const editorLink = node ? this.store.getNodeEditorLink(id, 'vscode') : null;
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ node, neighbours, blast, editorLink }));
                return;
            }
            res.writeHead(404);
            res.end('Not found');
        });
        this.server.listen(this.port, '127.0.0.1', () => {
            Logger_1.Logger.info(`Graph UI → http://localhost:${this.port}`);
        });
    }
    stop() { this.server?.close(); }
    buildHtml() {
        return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Semantic Code Knowledge Graph</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap');

  :root {
    --bg:       #0d1117;
    --surface:  #161b22;
    --surface2: #1c2128;
    --border:   #30363d;
    --accent:   #58a6ff;
    --green:    #3fb950;
    --orange:   #f0883e;
    --purple:   #bc8cff;
    --teal:     #39d3c3;
    --red:      #f85149;
    --text:     #c9d1d9;
    --muted:    #8b949e;
    --font:     'JetBrains Mono', 'Cascadia Code', monospace;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--text); font-family: var(--font); font-size: 12px; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }

  /* ── Toolbar ─────────────────────────────────────────────────── */
  #toolbar {
    flex-shrink: 0;
    display: flex; align-items: center; gap: 10px;
    padding: 8px 14px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
  }
  #toolbar h1 { font-size: 13px; color: var(--accent); letter-spacing: 0.5px; white-space: nowrap; }
  #search {
    flex: 1; max-width: 280px;
    background: var(--bg); border: 1px solid var(--border); border-radius: 5px;
    color: var(--text); padding: 5px 10px; font-family: var(--font); font-size: 11px; outline: none;
  }
  #search:focus { border-color: var(--accent); }
  #search::placeholder { color: var(--muted); }

  .filter-group { display: flex; gap: 4px; }
  .filter-btn {
    background: var(--bg); border: 1px solid var(--border); border-radius: 4px;
    color: var(--muted); padding: 4px 8px; font-family: var(--font); font-size: 10px;
    cursor: pointer; transition: all 0.15s;
  }
  .filter-btn:hover { border-color: var(--accent); color: var(--text); }
  .filter-btn.active { background: var(--accent); color: #000; border-color: var(--accent); font-weight: 600; }

  #stats-bar { color: var(--muted); font-size: 10px; white-space: nowrap; margin-left: auto; }

  /* ── Main layout ─────────────────────────────────────────────── */
  #main { flex: 1; display: flex; overflow: hidden; }

  /* ── Graph ───────────────────────────────────────────────────── */
  #graph-wrap { flex: 1; position: relative; overflow: hidden; cursor: grab; background: var(--bg); }
  #graph-wrap:active { cursor: grabbing; }
  #graph-wrap svg { width: 100%; height: 100%; }

  /* ── Legend ──────────────────────────────────────────────────── */
  #legend {
    position: absolute; bottom: 14px; left: 14px;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 6px; padding: 8px 12px;
    display: flex; flex-direction: column; gap: 5px;
    font-size: 10px; pointer-events: none;
  }
  .legend-row { display: flex; align-items: center; gap: 6px; color: var(--muted); }
  .l-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
  .l-line { width: 18px; height: 2px; flex-shrink: 0; }

  /* ── Tooltip ─────────────────────────────────────────────────── */
  #tooltip {
    position: absolute; background: var(--surface); border: 1px solid var(--border);
    border-radius: 5px; padding: 8px 12px; font-size: 11px;
    pointer-events: none; opacity: 0; transition: opacity 0.15s;
    z-index: 20; max-width: 240px;
  }

  /* ── Sidebar ─────────────────────────────────────────────────── */
  #sidebar {
    width: 270px; flex-shrink: 0;
    background: var(--surface); border-left: 1px solid var(--border);
    display: flex; flex-direction: column; overflow: hidden;
  }
  #sidebar-header {
    padding: 10px 14px; border-bottom: 1px solid var(--border);
    font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px;
  }
  #sidebar-content { flex: 1; overflow-y: auto; padding: 12px; }

  .node-card { border-bottom: 1px solid var(--border); padding-bottom: 12px; margin-bottom: 12px; }
  .nc-name { font-size: 14px; font-weight: 600; color: var(--accent); word-break: break-all; margin-bottom: 4px; }
  .nc-type { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 9px; font-weight: 600; margin-bottom: 8px; text-transform: uppercase; }

  .row { margin-bottom: 6px; }
  .row-label { color: var(--muted); font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
  .row-val { color: var(--text); word-break: break-all; }
  .row-val.code { background: var(--bg); padding: 4px 6px; border-radius: 3px; color: var(--green); }
  .row-val.doc { color: var(--muted); font-style: italic; }

  .open-editor-btn {
    display: block;
    background: var(--surface2);
    border: 1px solid var(--border);
    color: var(--accent);
    padding: 6px 10px;
    border-radius: 4px;
    text-decoration: none;
    font-weight: 600;
    font-size: 10px;
    margin-top: 12px;
    text-align: center;
    transition: all 0.15s;
    cursor: pointer;
  }
  .open-editor-btn:hover {
    background: var(--border);
    color: #fff;
  }

  .section-title { color: var(--muted); font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; margin: 10px 0 5px; }
  .chip {
    display: inline-block; background: var(--bg); border: 1px solid var(--border);
    border-radius: 3px; padding: 2px 6px; margin: 2px 2px 0 0;
    color: var(--accent); cursor: pointer; font-size: 10px; transition: border-color 0.1s;
  }
  .chip:hover { border-color: var(--accent); }
  .chip.callee { color: var(--green); }
  .chip.caller { color: var(--orange); }
  .chip.blast  { color: var(--purple); }

  .empty-state { color: var(--muted); text-align: center; padding: 40px 20px; line-height: 1.6; }

  /* ── Search results overlay ──────────────────────────────────── */
  #search-results {
    position: absolute; top: 46px; left: 100px; z-index: 30;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 5px; max-height: 300px; overflow-y: auto;
    min-width: 280px; display: none;
  }
  .sr-item {
    padding: 7px 12px; cursor: pointer; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 8px;
  }
  .sr-item:hover { background: var(--surface2); }
  .sr-type { font-size: 9px; padding: 1px 5px; border-radius: 3px; font-weight: 600; text-transform: uppercase; }
  .sr-name { color: var(--text); }
  .sr-path { color: var(--muted); font-size: 10px; }

  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: var(--bg); }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
</style>
</head>
<body>

<div id="toolbar">
  <h1>⬡ Knowledge Graph</h1>

  <input id="search" placeholder="Search symbols…" autocomplete="off">
  <div id="search-results"></div>

  <div class="filter-group" id="type-filters">
    <button class="filter-btn active" data-type="all">All</button>
    <button class="filter-btn" data-type="file" style="color:#f0883e">file</button>
    <button class="filter-btn" data-type="class" style="color:#3fb950">class</button>
    <button class="filter-btn" data-type="function" style="color:#58a6ff">fn</button>
    <button class="filter-btn" data-type="method" style="color:#79c0ff">method</button>
    <button class="filter-btn" data-type="interface" style="color:#bc8cff">iface</button>
  </div>

  <div class="filter-group" id="edge-filters">
    <button class="filter-btn active" data-edge="CALLS">CALLS</button>
    <button class="filter-btn active" data-edge="CONTAINS">CONTAINS</button>
    <button class="filter-btn active" data-edge="EXTENDS">EXTENDS</button>
    <button class="filter-btn active" data-edge="IMPLEMENTS">IMPLEMENTS</button>
  </div>

  <div id="stats-bar">Loading…</div>
</div>

<div id="main">
  <div id="graph-wrap">
    <svg id="svg"></svg>
    <div id="tooltip"></div>
    <div id="legend">
      <div class="legend-row"><div class="l-dot" style="background:#f0883e"></div>file</div>
      <div class="legend-row"><div class="l-dot" style="background:#3fb950"></div>class</div>
      <div class="legend-row"><div class="l-dot" style="background:#58a6ff"></div>function</div>
      <div class="legend-row"><div class="l-dot" style="background:#79c0ff"></div>method</div>
      <div class="legend-row"><div class="l-dot" style="background:#bc8cff"></div>interface</div>
      <div style="height:6px"></div>
      <div class="legend-row"><div class="l-line" style="background:#58a6ff88"></div>CALLS</div>
      <div class="legend-row"><div class="l-line" style="background:#8b949e55"></div>CONTAINS</div>
      <div class="legend-row"><div class="l-line" style="background:#3fb95088"></div>EXTENDS</div>
      <div class="legend-row"><div class="l-line" style="background:#f0883e88"></div>IMPLEMENTS</div>
    </div>
  </div>

  <div id="sidebar">
    <div id="sidebar-header">Node Inspector</div>
    <div id="sidebar-content">
      <div class="empty-state">Click a node to inspect it.<br><br>Orange = files<br>Green = classes<br>Blue = functions<br>Teal = methods<br>Purple = interfaces</div>
    </div>
  </div>
</div>

<script src="https://d3js.org/d3.v7.min.js"></script>
<script>
// ── Constants ─────────────────────────────────────────────────────────────────
const NODE_COLORS = {
  file:      '#f0883e',
  class:     '#3fb950',
  function:  '#58a6ff',
  method:    '#79c0ff',
  interface: '#bc8cff',
};
const EDGE_COLORS = {
  CALLS:      '#58a6ff',
  CONTAINS:   '#8b949e',
  EXTENDS:    '#3fb950',
  IMPLEMENTS: '#f0883e',
  IMPORTS:    '#bc8cff',
};
const NODE_RADIUS = { file: 7, class: 9, function: 6, method: 5, interface: 7 };

// Community palette (20 distinct colors)
const COM_PALETTE = [
  '#58a6ff','#3fb950','#f0883e','#bc8cff','#39d3c3',
  '#f85149','#ffa657','#d2a8ff','#7ee787','#a5d6ff',
  '#e3b341','#79c0ff','#ff7b72','#56d364','#d29922',
  '#8b949e','#b08800','#1f6feb','#388bfd','#2ea043',
];

// ── State ─────────────────────────────────────────────────────────────────────
let allNodes = [], allEdges = [];
let activeTypes = new Set(['file','class','function','method','interface']);
let activeEdges = new Set(['CALLS','CONTAINS','EXTENDS','IMPLEMENTS']);
let highlightedIds = null; // Set of node IDs to highlight, or null for all
let simulation = null;

// ── SVG setup ─────────────────────────────────────────────────────────────────
const svg     = d3.select('#svg');
const tooltip = document.getElementById('tooltip');
const g       = svg.append('g');

svg.call(d3.zoom().scaleExtent([0.03, 6]).on('zoom', e => g.attr('transform', e.transform)));

// Marker definitions (one per edge type)
const defs = svg.append('defs');
Object.entries(EDGE_COLORS).forEach(([type, color]) => {
  defs.append('marker')
    .attr('id', 'arr-' + type)
    .attr('viewBox', '0 -4 8 8').attr('refX', 20).attr('refY', 0)
    .attr('markerWidth', 5).attr('markerHeight', 5).attr('orient', 'auto')
    .append('path').attr('d', 'M0,-4L8,0L0,4').attr('fill', color);
});

// ── Load data ─────────────────────────────────────────────────────────────────
fetch('/api/data')
  .then(r => r.json())
  .then(data => {
    allNodes = data.nodes;
    allEdges = data.edges;
    const s = data.stats;
    document.getElementById('stats-bar').textContent =
      s.nodes + ' nodes | ' + s.edges + ' edges | ' +
      Object.entries(s.byType || {}).map(([t,c]) => t+':'+c).join(' ');
    renderGraph();
  })
  .catch(err => {
    document.getElementById('stats-bar').textContent = 'Error: ' + err;
  });

// ── Main render ───────────────────────────────────────────────────────────────
function renderGraph() {
  g.selectAll('*').remove();
  if (simulation) simulation.stop();

  const visibleTypes   = activeTypes;
  const visibleEdges   = activeEdges;

  const nodes = allNodes.filter(n => visibleTypes.has(n.type));
  const nodeSet = new Set(nodes.map(n => n.id));

  // If we have highlighted IDs, dim everything else
  const highlighted = highlightedIds;

  const edges = allEdges.filter(e =>
    visibleEdges.has(e.relationType) &&
    nodeSet.has(e.sourceId) && nodeSet.has(e.targetId)
  );

  const d3nodes = nodes.map(n => ({ ...n }));
  const nodeById = new Map(d3nodes.map(n => [n.id, n]));

  const d3links = edges.map(e => ({
    source: e.sourceId, target: e.targetId, type: e.relationType
  }));

  const w = document.getElementById('graph-wrap').clientWidth;
  const h = document.getElementById('graph-wrap').clientHeight;

  simulation = d3.forceSimulation(d3nodes)
    .force('link', d3.forceLink(d3links).id(d => d.id).distance(d =>
      d.type === 'CONTAINS' ? 50 : d.type === 'CALLS' ? 90 : 70
    ).strength(d => d.type === 'CONTAINS' ? 0.6 : 0.3))
    .force('charge', d3.forceManyBody().strength(-200))
    .force('center', d3.forceCenter(w/2, h/2))
    .force('collision', d3.forceCollide(d => NODE_RADIUS[d.type] + 12));

  // ── Edges ──────────────────────────────────────────────────────────────────
  const linkSel = g.append('g').attr('class','links')
    .selectAll('line').data(d3links).join('line')
    .attr('stroke', d => EDGE_COLORS[d.type] ?? '#8b949e')
    .attr('stroke-opacity', d => {
      if (!highlighted) return d.type === 'CONTAINS' ? 0.2 : 0.55;
      return (highlighted.has(d.source?.id ?? d.source) || highlighted.has(d.target?.id ?? d.target))
        ? 0.8 : 0.05;
    })
    .attr('stroke-width', d => d.type === 'CALLS' ? 1.5 : 1)
    .attr('marker-end', d => 'url(#arr-' + d.type + ')');

  // Edge labels for non-CONTAINS edges
  const edgeLabelSel = g.append('g').attr('class','edge-labels')
    .selectAll('text')
    .data(d3links.filter(l => l.type !== 'CONTAINS'))
    .join('text')
    .attr('fill', d => EDGE_COLORS[d.type] ?? '#8b949e')
    .attr('font-size', '8px')
    .attr('text-anchor', 'middle')
    .attr('font-family', 'JetBrains Mono, monospace')
    .attr('opacity', 0.6)
    .text(d => d.type);

  // ── Nodes ──────────────────────────────────────────────────────────────────
  const nodeG = g.append('g').attr('class','nodes')
    .selectAll('g').data(d3nodes).join('g')
    .attr('class', 'node-g')
    .call(d3.drag()
      .on('start', (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx=d.x; d.fy=d.y; })
      .on('drag',  (e, d) => { d.fx=e.x; d.fy=e.y; })
      .on('end',   (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx=null; d.fy=null; })
    )
    .on('click',     (e, d) => { e.stopPropagation(); selectNode(d.id); })
    .on('mouseover', (e, d) => showTooltip(e, d))
    .on('mousemove', (e)    => moveTooltip(e))
    .on('mouseout',  ()     => { tooltip.style.opacity = 0; });

  // Node circle
  nodeG.append('circle')
    .attr('r', d => NODE_RADIUS[d.type] ?? 6)
    .attr('fill', d => {
      if (d.communityId > 0) return COM_PALETTE[d.communityId % COM_PALETTE.length];
      return NODE_COLORS[d.type] ?? '#8b949e';
    })
    .attr('fill-opacity', d => {
      if (!highlighted) return 0.85;
      return highlighted.has(d.id) ? 1 : 0.15;
    })
    .attr('stroke', d => NODE_COLORS[d.type] ?? '#8b949e')
    .attr('stroke-width', d => highlighted?.has(d.id) ? 2.5 : 1)
    .attr('stroke-opacity', 0.8);

  // Node labels — always visible, size by importance
  nodeG.append('text')
    .attr('dx', d => NODE_RADIUS[d.type] + 3)
    .attr('dy', '0.35em')
    .attr('fill', d => {
      if (!highlighted) return d.type === 'file' ? '#8b949e' : '#c9d1d9';
      return highlighted.has(d.id) ? '#ffffff' : '#30363d';
    })
    .attr('font-size', d => {
      if (d.type === 'class' || d.type === 'interface') return '10px';
      if (d.type === 'file') return '8px';
      return '9px';
    })
    .attr('font-family', 'JetBrains Mono, monospace')
    .attr('font-weight', d => (d.type === 'class' || d.type === 'interface') ? '600' : '400')
    .text(d => {
      const label = d.name ?? d.id.split('/').pop() ?? '';
      return label.length > 22 ? label.slice(0, 20) + '…' : label;
    });

  // Tick
  simulation.on('tick', () => {
    // Dynamically select elements so newly filtered nodes/edges are animated!
    d3.selectAll('.links line')
      .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x).attr('y2', d => d.target.y);

    d3.selectAll('.edge-labels text')
      .attr('x', d => ((d.source.x ?? 0) + (d.target.x ?? 0)) / 2)
      .attr('y', d => ((d.source.y ?? 0) + (d.target.y ?? 0)) / 2 - 4);

    d3.selectAll('.node-g')
      .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');
  });

  // Click on background → clear highlight
  svg.on('click', () => {
    highlightedIds = null;
    updateHighlighting();  // Just update highlights, don't re-render
    document.getElementById('sidebar-content').innerHTML =
      '<div class="empty-state">Click a node to inspect it.</div>';
  });
}

// ── Node selection ────────────────────────────────────────────────────────────
function selectNode(id) {
  fetch('/api/node/' + encodeURIComponent(id))
    .then(r => r.json())
    .then(({ node, neighbours, blast, editorLink }) => { // Extract editorLink
      if (!node) return;

      // Highlight: selected + callers + callees + blast (don't re-render, just update)
      const ids = new Set([id,
        ...neighbours.callers.map(n => n.id),
        ...neighbours.callees.map(n => n.id),
        ...blast.map(n => n.id),
      ]);
      highlightedIds = ids;
      updateHighlighting();  // Update highlighting without full re-render
      renderSidebar(node, neighbours, blast, editorLink); // Pass it to renderSidebar
    });
}

// Update node and edge highlighting without re-rendering the entire graph
function updateHighlighting() {
  const highlighted = highlightedIds;
  
  // Update node circles
  d3.selectAll('.node-g circle')
    .attr('fill-opacity', d => {
      if (!highlighted) return 0.85;
      return highlighted.has(d.id) ? 1 : 0.15;
    })
    .attr('stroke-width', d => highlighted?.has(d.id) ? 2.5 : 1);
  
  // Update node labels
  d3.selectAll('.node-g text')
    .attr('fill', d => {
      if (!highlighted) return d.type === 'file' ? '#8b949e' : '#c9d1d9';
      return highlighted.has(d.id) ? '#ffffff' : '#30363d';
    });
  
  // Update edges  
  d3.selectAll('.links line')
    .attr('stroke-opacity', d => {
      if (!highlighted) return d.type === 'CONTAINS' ? 0.2 : 0.55;
      return (highlighted.has(d.source?.id ?? d.source) || highlighted.has(d.target?.id ?? d.target))
        ? 0.8 : 0.05;
    });
  
  // Update edge labels
  d3.selectAll('.edge-labels text')
    .attr('opacity', d => {
      if (!highlighted) return 0.6;
      return (highlighted.has(d.source?.id ?? d.source) || highlighted.has(d.target?.id ?? d.target))
        ? 1 : 0.1;
    });
}

// Update graph when filters change — preserves node positions and D3 simulation state
function updateGraphFilters() {
  if (!simulation || !allNodes.length) return;

  const visibleTypes = activeTypes;
  const visibleEdges = activeEdges;

  const filteredNodes = allNodes.filter(n => visibleTypes.has(n.type));
  const nodeSet = new Set(filteredNodes.map(n => n.id));
  
  const filteredEdges = allEdges.filter(e =>
    visibleEdges.has(e.relationType) &&
    nodeSet.has(e.sourceId) &&
    nodeSet.has(e.targetId)
  );

  // Create D3-compatible link objects with proper key function
  const d3links = filteredEdges.map(e => ({
    source: e.sourceId,
    target: e.targetId,
    type: e.relationType,
    _key: e.sourceId + '→' + e.targetId
  }));

  // Update the force simulation's nodes and links FIRST
  simulation.nodes(filteredNodes);
  simulation.force('link', d3.forceLink(d3links)
    .id(d => d.id)
    .distance(d => d.type === 'CONTAINS' ? 50 : d.type === 'CALLS' ? 90 : 70)
    .strength(d => d.type === 'CONTAINS' ? 0.6 : 0.3));
  simulation.force('collision', d3.forceCollide(d => NODE_RADIUS[d.type] + 12));

  // ── Update nodes with proper enter/update/exit pattern ────────────────────────
  const nodeGSelection = d3.select('.nodes').selectAll('.node-g').data(filteredNodes, d => d.id);
  nodeGSelection.exit().remove();
  
  // Create new node groups for filtered-in nodes
  const nodeGEnter = nodeGSelection.enter().append('g')
    .attr('class', 'node-g')
    .call(d3.drag()
      .on('start', (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx=d.x; d.fy=d.y; })
      .on('drag',  (e, d) => { d.fx=e.x; d.fy=e.y; })
      .on('end',   (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx=null; d.fy=null; })
    )
    .on('click',     (e, d) => { e.stopPropagation(); selectNode(d.id); })
    .on('mouseover', (e, d) => showTooltip(e, d))
    .on('mousemove', (e)    => moveTooltip(e))
    .on('mouseout',  ()     => { tooltip.style.opacity = 0; });

  // Add circles to new nodes
  nodeGEnter.append('circle')
    .attr('r', d => NODE_RADIUS[d.type] ?? 6)
    .attr('fill', d => {
      if (d.communityId > 0) return COM_PALETTE[d.communityId % COM_PALETTE.length];
      return NODE_COLORS[d.type] ?? '#8b949e';
    })
    .attr('stroke', d => NODE_COLORS[d.type] ?? '#8b949e')
    .attr('stroke-width', 1)
    .attr('stroke-opacity', 0.8);

  // Add text labels to new nodes
  nodeGEnter.append('text')
    .attr('dx', d => NODE_RADIUS[d.type] + 3)
    .attr('dy', '0.35em')
    .attr('font-size', d => {
      if (d.type === 'class' || d.type === 'interface') return '10px';
      if (d.type === 'file') return '8px';
      return '9px';
    })
    .attr('font-family', 'JetBrains Mono, monospace')
    .attr('font-weight', d => (d.type === 'class' || d.type === 'interface') ? '600' : '400')
    .text(d => {
      const label = d.name ?? d.id.split('/').pop() ?? '';
      return label.length > 22 ? label.slice(0, 20) + '…' : label;
    });

  // Merge and update all nodes (both new and existing)
  const nodeGMerged = nodeGEnter.merge(nodeGSelection);
  nodeGMerged.select('circle')
    .attr('fill-opacity', d => {
      if (!highlightedIds) return 0.85;
      return highlightedIds.has(d.id) ? 1 : 0.15;
    })
    .attr('stroke-width', d => highlightedIds?.has(d.id) ? 2.5 : 1);
  
  nodeGMerged.select('text')
    .attr('fill', d => {
      if (!highlightedIds) return d.type === 'file' ? '#8b949e' : '#c9d1d9';
      return highlightedIds.has(d.id) ? '#ffffff' : '#30363d';
    });

  // ── Update edges with proper enter/update/exit pattern ────────────────────────
  const linkSelection = d3.select('.links').selectAll('line').data(d3links, d => d._key);
  linkSelection.exit().remove();
  
  // Create new edge lines for filtered-in edges
  const linkEnter = linkSelection.enter().append('line')
    .attr('stroke', d => EDGE_COLORS[d.type] ?? '#8b949e')
    .attr('stroke-width', d => d.type === 'CALLS' ? 1.5 : 1)
    .attr('marker-end', d => 'url(#arr-' + d.type + ')');

  // Merge and update all edges
  linkEnter.merge(linkSelection).attr('stroke-opacity', d => {
    if (!highlightedIds) return d.type === 'CONTAINS' ? 0.2 : 0.55;
    return (highlightedIds.has(d.source?.id ?? d.source) || highlightedIds.has(d.target?.id ?? d.target))
      ? 0.8 : 0.05;
  });

  // ── Update edge labels with proper enter/update/exit pattern ────────────────────
  const edgeLabelSelection = d3.select('.edge-labels').selectAll('text')
    .data(d3links.filter(l => l.type !== 'CONTAINS'), d => d._key);
  edgeLabelSelection.exit().remove();
  
  // Create new edge labels for filtered-in edges
  const edgeLabelEnter = edgeLabelSelection.enter().append('text')
    .attr('fill', d => EDGE_COLORS[d.type] ?? '#8b949e')
    .attr('font-size', '8px')
    .attr('text-anchor', 'middle')
    .attr('font-family', 'JetBrains Mono, monospace')
    .text(d => d.type);

  // Merge and update all edge labels
  edgeLabelEnter.merge(edgeLabelSelection).attr('opacity', d => {
    if (!highlightedIds) return 0.6;
    return (highlightedIds.has(d.source?.id ?? d.source) || highlightedIds.has(d.target?.id ?? d.target))
      ? 1 : 0.1;
  });

  // Warm restart
  simulation.alpha(0.3).restart();
}

function renderSidebar(node, { callers, callees }, blast, editorLink) { // Add editorLink
  const typeColor = NODE_COLORS[node.type] ?? '#8b949e';
  const mods = (node.modifiers ?? []).join(' ');

  let html = '<div class="node-card">';
  html += '<div class="nc-name">' + esc(node.name) + '</div>';
  html += '<span class="nc-type" style="background:' + typeColor + '33;color:' + typeColor + '">' + node.type + '</span>';

  if (mods) html += rowHtml('Modifiers', mods);
  html += rowHtml('File', node.filePath.replace(/\\\\/g, '/').split('/').slice(-2).join('/'));
  if (node.className) html += rowHtml('Class', node.className);
  if (node.packageName) html += rowHtml('Package', node.packageName);
  html += rowHtml('Lines', node.startLine + ' – ' + node.endLine);
  if (node.communityId > 0) html += rowHtml('Community', '#' + node.communityId);
  if (node.signature) html += rowHtml('Signature', node.signature, 'code');
  if (node.docstring)  html += rowHtml('Intent',    node.docstring,  'doc');

  // Add the button right before closing the .node-card div
  if (editorLink) {
    html += '<a href="' + esc(editorLink) + '" class="open-editor-btn">↗ Open in VS Code</a>';
  }

  html += '</div>';

  if (callees.length) {
    html += '<div class="section-title">Calls (' + callees.length + ')</div>';
    html += callees.map(n =>
      '<span class="chip callee" onclick="selectNode(&quot;' + esc(n.id) + '&quot;)">' + esc(n.name) + '</span>'
    ).join('');
  }

  if (callers.length) {
    html += '<div class="section-title" style="margin-top:10px">Called by (' + callers.length + ')</div>';
    html += callers.map(n =>
      '<span class="chip caller" onclick="selectNode(&quot;' + esc(n.id) + '&quot;)">' + esc(n.name) + '</span>'
    ).join('');
  }

  if (blast.length) {
    html += '<div class="section-title" style="margin-top:10px">Blast radius (' + blast.length + ')</div>';
    html += blast.slice(0, 12).map(n =>
      '<span class="chip blast" onclick="selectNode(&quot;' + esc(n.id) + '&quot;)">' + esc(n.name) + '</span>'
    ).join('');
    if (blast.length > 12) html += '<span class="chip blast">+' + (blast.length-12) + ' more</span>';
  }

  document.getElementById('sidebar-header').textContent = 'Node Inspector — ' + node.name;
  document.getElementById('sidebar-content').innerHTML = html;
}

function rowHtml(label, value, cls = '') {
  return '<div class="row"><div class="row-label">' + label + '</div>'
       + '<div class="row-val ' + cls + '">' + esc(String(value)) + '</div></div>';
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
function showTooltip(e, d) {
  tooltip.style.opacity = 1;
  tooltip.innerHTML =
    '<strong style="color:' + (NODE_COLORS[d.type]??'#fff') + '">' + esc(d.name) + '</strong>' +
    '<br><span style="color:#8b949e">' + d.type + '</span>' +
    (d.signature ? '<br><code style="color:#3fb950;font-size:10px">' + esc(d.signature.slice(0,80)) + '</code>' : '') +
    (d.docstring  ? '<br><em style="color:#8b949e;font-size:10px">' + esc(d.docstring.slice(0,100)) + '</em>' : '');
}
function moveTooltip(e) {
  const box = document.getElementById('graph-wrap').getBoundingClientRect();
  tooltip.style.left = (e.clientX - box.left + 14) + 'px';
  tooltip.style.top  = (e.clientY - box.top  + 14) + 'px';
}

// ── Search ────────────────────────────────────────────────────────────────────
let searchTimer = null;
const searchInput = document.getElementById('search');
const searchResults = document.getElementById('search-results');

searchInput.addEventListener('input', e => {
  clearTimeout(searchTimer);
  const q = e.target.value.trim();
  if (q.length < 2) { searchResults.style.display = 'none'; return; }
  searchTimer = setTimeout(() => {
    fetch('/api/search?q=' + encodeURIComponent(q))
      .then(r => r.json())
      .then(results => renderSearchResults(results));
  }, 200);
});

function renderSearchResults(results) {
  if (!results.length) { searchResults.style.display = 'none'; return; }
  const col = n => NODE_COLORS[n.type] ?? '#8b949e';
  searchResults.innerHTML = results.slice(0, 15).map(n =>
    '<div class="sr-item" onclick="selectNode(&quot;' + esc(n.id) + '&quot;); searchResults.style.display = &quot;none&quot;; searchInput.value = &quot;&quot;">' +
      '<span class="sr-type" style="background:' + col(n) + '33;color:' + col(n) + '">' + n.type + '</span>' +
      '<span class="sr-name">' + esc(n.name) + '</span>' +
      '<span class="sr-path">' + esc(n.filePath.replace(/\\\\/g, '/').split('/').slice(-2).join('/')) + '</span>' +
    '</div>'
  ).join('');
  searchResults.style.display = 'block';
}

document.addEventListener('click', e => {
  if (!searchResults.contains(e.target) && e.target !== searchInput) {
    searchResults.style.display = 'none';
  }
});

// ── Filters ───────────────────────────────────────────────────────────────────
document.querySelectorAll('.filter-btn[data-type]').forEach(btn => {
  btn.addEventListener('click', () => {
    const type = btn.dataset.type;
    if (type === 'all') {
      activeTypes = new Set(['file','class','function','method','interface']);
      // FIX: Turn ALL buttons on visually
      document.querySelectorAll('.filter-btn[data-type]').forEach(b => b.classList.add('active'));
    } else {
      document.querySelector('.filter-btn[data-type="all"]').classList.remove('active');
      if (activeTypes.has(type)) activeTypes.delete(type);
      else activeTypes.add(type);
      btn.classList.toggle('active', activeTypes.has(type));
    }
    updateGraphFilters();  // Update without destroying simulation
  });
});

document.querySelectorAll('.filter-btn[data-edge]').forEach(btn => {
  btn.addEventListener('click', () => {
    const edge = btn.dataset.edge;
    if (activeEdges.has(edge)) activeEdges.delete(edge);
    else activeEdges.add(edge);
    btn.classList.toggle('active', activeEdges.has(edge));
    updateGraphFilters();  // Update without destroying simulation
  });
});

// ── Utilities ─────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
</script>
</body>
</html>`;
    }
}
exports.GraphUIServer = GraphUIServer;
//# sourceMappingURL=GraphUIServer.js.map