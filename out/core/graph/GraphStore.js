"use strict";
/**
 * GraphStore — sql.js (WASM) backed knowledge graph.
 *
 * Schema v2 additions:
 *   nodes.modifiers     — JSON array of keywords (public, static, async, etc.)
 *   nodes.class_name    — enclosing class name (for methods)
 *   nodes.package_name  — package/module name
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
exports.GraphStore = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const Logger_1 = require("../../utils/Logger");
class GraphStore {
    constructor(storagePath, _workspaceRoot) {
        this.db = null;
        this.saveTimer = null;
        fs.mkdirSync(storagePath, { recursive: true });
        this.dbPath = path.join(storagePath, 'knowledge-graph.db');
    }
    async initialize() {
        const sqlJsPath = require.resolve('sql.js');
        const sqlJsDir = path.dirname(sqlJsPath);
        const wasmPath = path.join(sqlJsDir, 'sql-wasm.wasm');
        const initSqlJs = require('sql.js');
        const SQL = await initSqlJs({ locateFile: () => wasmPath });
        if (fs.existsSync(this.dbPath)) {
            this.db = new SQL.Database(fs.readFileSync(this.dbPath));
            Logger_1.Logger.info(`GraphStore loaded from ${this.dbPath}`);
        }
        else {
            this.db = new SQL.Database();
            Logger_1.Logger.info(`GraphStore created at ${this.dbPath}`);
        }
        this.exec('PRAGMA foreign_keys = ON;');
        this.runMigrations();
        this.persist();
    }
    columnExists(tableName, columnName) {
        try {
            const result = this.query(`PRAGMA table_info(${tableName})`, []);
            return result.some(col => col.name === columnName);
        }
        catch {
            return false;
        }
    }
    runMigrations() {
        this.exec(`
      CREATE TABLE IF NOT EXISTS nodes (
        id                TEXT PRIMARY KEY,
        type              TEXT NOT NULL,
        name              TEXT NOT NULL,
        file_path         TEXT NOT NULL,
        signature         TEXT DEFAULT '',
        docstring         TEXT DEFAULT '',
        community_id      INTEGER DEFAULT 0,
        checksum          TEXT DEFAULT '',
        is_auto_generated INTEGER DEFAULT 0,
        start_line        INTEGER DEFAULT 0,
        end_line          INTEGER DEFAULT 0,
        modifiers         TEXT DEFAULT '[]',
        class_name        TEXT DEFAULT NULL,
        package_name      TEXT DEFAULT NULL,
        updated_at        INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS edges (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id     TEXT NOT NULL,
        target_id     TEXT NOT NULL,
        relation_type TEXT NOT NULL,
        UNIQUE(source_id, target_id, relation_type)
      );

      CREATE INDEX IF NOT EXISTS idx_nodes_file    ON nodes(file_path);
      CREATE INDEX IF NOT EXISTS idx_nodes_type    ON nodes(type);
      CREATE INDEX IF NOT EXISTS idx_nodes_name    ON nodes(name);
      CREATE INDEX IF NOT EXISTS idx_nodes_class   ON nodes(class_name);
      CREATE INDEX IF NOT EXISTS idx_nodes_pkg     ON nodes(package_name);
      CREATE INDEX IF NOT EXISTS idx_edges_source  ON edges(source_id);
      CREATE INDEX IF NOT EXISTS idx_edges_target  ON edges(target_id);
      CREATE INDEX IF NOT EXISTS idx_edges_type    ON edges(relation_type);

      CREATE TABLE IF NOT EXISTS embeddings (
        node_id TEXT PRIMARY KEY,
        vector  BLOB NOT NULL,
        dims    INTEGER NOT NULL DEFAULT 384
      );
    `);
        // Add new columns to existing DB if upgrading from v1
        if (!this.columnExists('nodes', 'modifiers')) {
            this.exec(`ALTER TABLE nodes ADD COLUMN modifiers TEXT DEFAULT '[]'`);
        }
        if (!this.columnExists('nodes', 'class_name')) {
            this.exec(`ALTER TABLE nodes ADD COLUMN class_name TEXT DEFAULT NULL`);
        }
        if (!this.columnExists('nodes', 'package_name')) {
            this.exec(`ALTER TABLE nodes ADD COLUMN package_name TEXT DEFAULT NULL`);
        }
    }
    // ── Write operations ───────────────────────────────────────────────────────
    async upsertNodes(nodes) {
        if (nodes.length === 0)
            return;
        const sql = `
      INSERT INTO nodes
        (id, type, name, file_path, signature, docstring, community_id,
         checksum, is_auto_generated, start_line, end_line,
         modifiers, class_name, package_name, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        type              = excluded.type,
        name              = excluded.name,
        file_path         = excluded.file_path,
        signature         = excluded.signature,
        docstring         = CASE WHEN excluded.docstring != '' THEN excluded.docstring ELSE nodes.docstring END,
        checksum          = excluded.checksum,
        is_auto_generated = excluded.is_auto_generated,
        start_line        = excluded.start_line,
        end_line          = excluded.end_line,
        modifiers         = excluded.modifiers,
        class_name        = excluded.class_name,
        package_name      = excluded.package_name,
        updated_at        = excluded.updated_at
    `;
        const stmt = this.db.prepare(sql);
        const now = Math.floor(Date.now() / 1000);
        for (const n of nodes) {
            stmt.run([
                n.id, n.type, n.name, n.filePath, n.signature, n.docstring,
                n.communityId, n.checksum, n.isAutoGenerated ? 1 : 0,
                n.startLine, n.endLine,
                JSON.stringify(n.modifiers ?? []),
                n.className ?? null,
                n.packageName ?? null,
                now,
            ]);
        }
        stmt.free();
        this.schedulePersist();
    }
    upsertEdges(edges) {
        if (edges.length === 0)
            return;
        const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO edges (source_id, target_id, relation_type) VALUES (?,?,?)
    `);
        for (const e of edges)
            stmt.run([e.sourceId, e.targetId, e.relationType]);
        stmt.free();
        this.schedulePersist();
    }
    storeEmbedding(nodeId, vector) {
        const stmt = this.db.prepare(`INSERT OR REPLACE INTO embeddings (node_id, vector, dims) VALUES (?,?,?)`);
        stmt.run([nodeId, Buffer.from(vector.buffer), vector.length]);
        stmt.free();
        this.schedulePersist();
    }
    updateDocstring(nodeId, docstring, isAutoGenerated) {
        const stmt = this.db.prepare(`UPDATE nodes SET docstring=?, is_auto_generated=? WHERE id=?`);
        stmt.run([docstring, isAutoGenerated ? 1 : 0, nodeId]);
        stmt.free();
        this.schedulePersist();
    }
    updateCommunityId(nodeId, communityId) {
        const stmt = this.db.prepare(`UPDATE nodes SET community_id=? WHERE id=?`);
        stmt.run([communityId, nodeId]);
        stmt.free();
    }
    removeFile(filePath) {
        const ids = this.query(`SELECT id FROM nodes WHERE file_path=?`, [filePath]).map(r => r.id);
        for (const id of ids) {
            this.run(`DELETE FROM edges WHERE source_id=? OR target_id=?`, [id, id]);
            this.run(`DELETE FROM embeddings WHERE node_id=?`, [id]);
        }
        this.run(`DELETE FROM nodes WHERE file_path=?`, [filePath]);
        this.schedulePersist();
    }
    // ── Read operations ────────────────────────────────────────────────────────
    getNode(id) {
        const rows = this.query(`SELECT * FROM nodes WHERE id=?`, [id]);
        return rows.length ? this.rowToNode(rows[0]) : null;
    }
    // ── Utility operations ─────────────────────────────────────────────────────
    /**
     * Generates a clickable link/URI for a specific node to open it in an editor.
     * * @param id The ID of the CodeNode
     * @param editor The target editor/environment (defaults to 'vscode')
     * @returns A formatted string link, or null if the node doesn't exist
     */
    getNodeEditorLink(id, editor = 'vscode') {
        const node = this.getNode(id);
        if (!node)
            return null;
        // Resolve absolute path if your UI requires it (assuming _workspaceRoot is stored)
        // If your filePath is already absolute, you can skip path.resolve
        const absolutePath = path.resolve(this.dbPath, '../../', node.filePath); // Adjust based on your workspace root logic
        switch (editor) {
            case 'vscode':
                // Example: vscode://file/c:/projects/my-app/src/main.ts:42
                return `vscode://file/${absolutePath}:${node.startLine}`;
            case 'terminal':
                // Example: src/main.ts:42
                return `${node.filePath}:${node.startLine}`;
            case 'github':
                // Example: src/main.ts#L42
                return `${node.filePath}#L${node.startLine}`;
            default:
                return `${node.filePath}:${node.startLine}`;
        }
    }
    getNodesByFile(filePath) {
        return this.query(`SELECT * FROM nodes WHERE file_path=?`, [filePath]).map(r => this.rowToNode(r));
    }
    getNeighbours(nodeId) {
        const callees = this.query(`
      SELECT n.* FROM nodes n JOIN edges e ON e.target_id=n.id
      WHERE e.source_id=? AND e.relation_type='CALLS'
    `, [nodeId]).map(r => this.rowToNode(r));
        const callers = this.query(`
      SELECT n.* FROM nodes n JOIN edges e ON e.source_id=n.id
      WHERE e.target_id=? AND e.relation_type='CALLS'
    `, [nodeId]).map(r => this.rowToNode(r));
        return { callers, callees };
    }
    getBlastRadius(nodeId, maxDepth = 10) {
        return this.query(`
      WITH RECURSIVE blast(id, depth) AS (
        SELECT ?, 0
        UNION ALL
        SELECT e.target_id, blast.depth+1
        FROM edges e JOIN blast ON blast.id=e.source_id
        WHERE blast.depth < ? AND e.relation_type IN ('CALLS','IMPORTS')
      )
      SELECT DISTINCT n.* FROM nodes n JOIN blast ON blast.id=n.id
    `, [nodeId, maxDepth]).map(r => this.rowToNode(r));
    }
    searchKeyword(query, limit = 20) {
        const like = `%${query}%`;
        return this.query(`SELECT * FROM nodes WHERE name LIKE ? OR docstring LIKE ? OR signature LIKE ? LIMIT ?`, [like, like, like, limit]).map(r => this.rowToNode(r));
    }
    searchSemantic(queryVector, limit = 10) {
        const rows = this.query(`SELECT n.*, e.vector FROM nodes n JOIN embeddings e ON e.node_id=n.id`, []);
        return rows
            .map(row => ({
            node: this.rowToNode(row),
            score: cosineSimilarity(queryVector, new Float32Array(row.vector.buffer)),
        }))
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }
    getNodesWithoutEmbeddings() {
        return this.query(`
      SELECT n.* FROM nodes n LEFT JOIN embeddings e ON e.node_id=n.id
      WHERE e.node_id IS NULL AND n.type != 'file'
    `, []).map(r => this.rowToNode(r));
    }
    getNodesWithoutDocstrings() {
        return this.query(`SELECT * FROM nodes WHERE (docstring IS NULL OR docstring='') AND type IN ('function','method','class')`, []).map(r => this.rowToNode(r));
    }
    getAllNodes() {
        return this.query(`SELECT * FROM nodes`, []).map(r => this.rowToNode(r));
    }
    getAllEdges() {
        return this.query(`SELECT * FROM edges`, []).map(r => ({
            sourceId: r.source_id,
            targetId: r.target_id,
            relationType: r.relation_type,
        }));
    }
    getEdgesByType(type) {
        return this.query(`SELECT * FROM edges WHERE relation_type=?`, [type]).map(r => ({
            sourceId: r.source_id,
            targetId: r.target_id,
            relationType: r.relation_type,
        }));
    }
    getStats() {
        const nodes = this.query(`SELECT COUNT(*) as c FROM nodes`, [])[0]?.c ?? 0;
        const edges = this.query(`SELECT COUNT(*) as c FROM edges`, [])[0]?.c ?? 0;
        const withEmbeddings = this.query(`SELECT COUNT(*) as c FROM embeddings`, [])[0]?.c ?? 0;
        const byTypeRows = this.query(`SELECT type, COUNT(*) as c FROM nodes GROUP BY type`, []);
        const byType = {};
        byTypeRows.forEach(r => { byType[r.type] = r.c; });
        return { nodes, edges, withEmbeddings, byType };
    }
    close() {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }
        this.persist();
        this.db?.close();
    }
    // ── Persistence ────────────────────────────────────────────────────────────
    persist() {
        if (!this.db)
            return;
        try {
            fs.writeFileSync(this.dbPath, Buffer.from(this.db.export()));
        }
        catch (err) {
            Logger_1.Logger.warn(`GraphStore persist failed: ${err}`);
        }
    }
    schedulePersist() {
        if (this.saveTimer)
            clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => { this.persist(); this.saveTimer = null; }, 2000);
    }
    // ── sql.js helpers ─────────────────────────────────────────────────────────
    exec(sql) { this.db.run(sql); }
    tryExec(sql) {
        try {
            this.db.run(sql);
        }
        catch { /* column already exists */ }
    }
    run(sql, params) {
        const stmt = this.db.prepare(sql);
        stmt.run(params);
        stmt.free();
    }
    query(sql, params) {
        const stmt = this.db.prepare(sql);
        stmt.bind(params);
        const results = [];
        while (stmt.step())
            results.push(stmt.getAsObject());
        stmt.free();
        return results;
    }
    rowToNode(row) {
        let modifiers = [];
        try {
            modifiers = JSON.parse(row.modifiers ?? '[]');
        }
        catch {
            modifiers = [];
        }
        return {
            id: row.id,
            type: row.type,
            name: row.name,
            filePath: row.file_path,
            signature: row.signature ?? '',
            docstring: row.docstring ?? '',
            communityId: row.community_id ?? 0,
            checksum: row.checksum ?? '',
            isAutoGenerated: Boolean(row.is_auto_generated),
            startLine: row.start_line ?? 0,
            endLine: row.end_line ?? 0,
            modifiers,
            className: row.class_name ?? null,
            packageName: row.package_name ?? null,
        };
    }
}
exports.GraphStore = GraphStore;
function cosineSimilarity(a, b) {
    if (a.length !== b.length)
        return 0;
    let dot = 0, nA = 0, nB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        nA += a[i] * a[i];
        nB += b[i] * b[i];
    }
    const d = Math.sqrt(nA) * Math.sqrt(nB);
    return d === 0 ? 0 : dot / d;
}
//# sourceMappingURL=GraphStore.js.map