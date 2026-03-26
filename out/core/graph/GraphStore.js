"use strict";
/**
 * GraphStore — SQLite-backed knowledge graph storage via sql.js (WASM).
 *
 * Uses sql.js instead of better-sqlite3 to avoid native C++ bindings
 * and Electron ABI mismatch issues on Windows.
 *
 * sql.js runs entirely in-memory; we load from disk on init and
 * persist back to disk after every write batch (debounced to 2s).
 *
 * Tables:
 *   nodes      — functions, classes, methods, files
 *   edges      — CONTAINS, CALLS, IMPORTS, EXTENDS, IMPLEMENTS
 *   embeddings — 384-dim vectors stored as BLOBs
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
            const fileBuffer = fs.readFileSync(this.dbPath);
            this.db = new SQL.Database(fileBuffer);
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
        updated_at        INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS edges (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id     TEXT NOT NULL,
        target_id     TEXT NOT NULL,
        relation_type TEXT NOT NULL,
        UNIQUE(source_id, target_id, relation_type)
      );

      CREATE INDEX IF NOT EXISTS idx_nodes_file   ON nodes(file_path);
      CREATE INDEX IF NOT EXISTS idx_nodes_type   ON nodes(type);
      CREATE INDEX IF NOT EXISTS idx_nodes_name   ON nodes(name);
      CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
      CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);

      CREATE TABLE IF NOT EXISTS embeddings (
        node_id TEXT PRIMARY KEY,
        vector  BLOB NOT NULL,
        dims    INTEGER NOT NULL DEFAULT 384
      );
    `);
    }
    // ── Write operations ───────────────────────────────────────────────────────
    async upsertNodes(nodes) {
        const sql = `
      INSERT INTO nodes
        (id, type, name, file_path, signature, docstring,
         community_id, checksum, is_auto_generated, start_line, end_line, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
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
        updated_at        = excluded.updated_at
    `;
        const stmt = this.db.prepare(sql);
        const now = Math.floor(Date.now() / 1000);
        for (const n of nodes) {
            stmt.run([
                n.id, n.type, n.name, n.filePath,
                n.signature, n.docstring, n.communityId,
                n.checksum, n.isAutoGenerated ? 1 : 0,
                n.startLine, n.endLine, now,
            ]);
        }
        stmt.free();
        this.schedulePersist();
    }
    upsertEdges(edges) {
        const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO edges (source_id, target_id, relation_type)
      VALUES (?, ?, ?)
    `);
        for (const e of edges) {
            stmt.run([e.sourceId, e.targetId, e.relationType]);
        }
        stmt.free();
        this.schedulePersist();
    }
    storeEmbedding(nodeId, vector) {
        const buf = Buffer.from(vector.buffer);
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO embeddings (node_id, vector, dims) VALUES (?, ?, ?)
    `);
        stmt.run([nodeId, buf, vector.length]);
        stmt.free();
        this.schedulePersist();
    }
    updateDocstring(nodeId, docstring, isAutoGenerated) {
        const stmt = this.db.prepare(`UPDATE nodes SET docstring = ?, is_auto_generated = ? WHERE id = ?`);
        stmt.run([docstring, isAutoGenerated ? 1 : 0, nodeId]);
        stmt.free();
        this.schedulePersist();
    }
    removeFile(filePath) {
        const nodeIds = this.query(`SELECT id FROM nodes WHERE file_path = ?`, [filePath]).map(r => r.id);
        for (const id of nodeIds) {
            this.run(`DELETE FROM edges WHERE source_id = ? OR target_id = ?`, [id, id]);
        }
        this.run(`DELETE FROM embeddings WHERE node_id IN (SELECT id FROM nodes WHERE file_path = ?)`, [filePath]);
        this.run(`DELETE FROM nodes WHERE file_path = ?`, [filePath]);
        this.schedulePersist();
    }
    // ── Read operations ────────────────────────────────────────────────────────
    getNode(id) {
        const rows = this.query(`SELECT * FROM nodes WHERE id = ?`, [id]);
        return rows.length ? this.rowToNode(rows[0]) : null;
    }
    getNodesByFile(filePath) {
        return this.query(`SELECT * FROM nodes WHERE file_path = ?`, [filePath]).map(this.rowToNode);
    }
    getNeighbours(nodeId) {
        const callees = this.query(`
      SELECT n.* FROM nodes n
      JOIN edges e ON e.target_id = n.id
      WHERE e.source_id = ? AND e.relation_type = 'CALLS'
    `, [nodeId]).map(this.rowToNode);
        const callers = this.query(`
      SELECT n.* FROM nodes n
      JOIN edges e ON e.source_id = n.id
      WHERE e.target_id = ? AND e.relation_type = 'CALLS'
    `, [nodeId]).map(this.rowToNode);
        return { callers, callees };
    }
    getBlastRadius(nodeId, maxDepth = 10) {
        return this.query(`
      WITH RECURSIVE blast(id, depth) AS (
        SELECT ?, 0
        UNION ALL
        SELECT e.target_id, blast.depth + 1
        FROM edges e
        JOIN blast ON blast.id = e.source_id
        WHERE blast.depth < ? AND e.relation_type IN ('CALLS','IMPORTS')
      )
      SELECT DISTINCT n.* FROM nodes n JOIN blast ON blast.id = n.id
    `, [nodeId, maxDepth]).map(this.rowToNode);
    }
    searchKeyword(query, limit = 20) {
        const like = `%${query}%`;
        return this.query(`
      SELECT * FROM nodes WHERE name LIKE ? OR docstring LIKE ? OR signature LIKE ? LIMIT ?
    `, [like, like, like, limit]).map(this.rowToNode);
    }
    searchSemantic(queryVector, limit = 10) {
        const rows = this.query(`SELECT n.*, e.vector FROM nodes n JOIN embeddings e ON e.node_id = n.id`, []);
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
      SELECT n.* FROM nodes n
      LEFT JOIN embeddings e ON e.node_id = n.id
      WHERE e.node_id IS NULL AND n.type != 'file'
    `, []).map(this.rowToNode);
    }
    getNodesWithoutDocstrings() {
        return this.query(`
      SELECT * FROM nodes WHERE (docstring IS NULL OR docstring = '') AND type IN ('function','method','class')
    `, []).map(this.rowToNode);
    }
    getAllNodes() {
        return this.query(`SELECT * FROM nodes`, []).map(this.rowToNode);
    }
    getAllEdges() {
        return this.query(`SELECT * FROM edges`, []).map(r => ({
            sourceId: r.source_id,
            targetId: r.target_id,
            relationType: r.relation_type,
        }));
    }
    getStats() {
        return {
            nodes: this.query(`SELECT COUNT(*) as c FROM nodes`, [])[0]?.c ?? 0,
            edges: this.query(`SELECT COUNT(*) as c FROM edges`, [])[0]?.c ?? 0,
            withEmbeddings: this.query(`SELECT COUNT(*) as c FROM embeddings`, [])[0]?.c ?? 0,
        };
    }
    close() {
        this.persist();
        this.db?.close();
    }
    // ── Persistence (sql.js is in-memory; we write to disk manually) ──────────
    persist() {
        if (!this.db)
            return;
        try {
            const data = this.db.export();
            fs.writeFileSync(this.dbPath, Buffer.from(data));
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
    run(sql, params) {
        const stmt = this.db.prepare(sql);
        stmt.run(params);
        stmt.free();
    }
    query(sql, params) {
        const stmt = this.db.prepare(sql);
        stmt.bind(params);
        const results = [];
        while (stmt.step()) {
            results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
    }
    rowToNode(row) {
        return {
            id: row.id,
            type: row.type,
            name: row.name,
            filePath: row.file_path,
            signature: row.signature || '',
            docstring: row.docstring || '',
            communityId: row.community_id || 0,
            checksum: row.checksum || '',
            isAutoGenerated: Boolean(row.is_auto_generated),
            startLine: row.start_line || 0,
            endLine: row.end_line || 0,
        };
    }
}
exports.GraphStore = GraphStore;
function cosineSimilarity(a, b) {
    if (a.length !== b.length)
        return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
}
//# sourceMappingURL=GraphStore.js.map