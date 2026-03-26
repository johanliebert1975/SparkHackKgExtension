"use strict";
/**
 * CallResolver — Phase 2: CALL edge extraction.
 *
 * After FileParser builds the symbol table, this module re-reads each file,
 * finds all call expressions in the AST, and resolves them to known symbols.
 *
 * Resolution strategy (3-tier, in order):
 *   1. Same-class method calls  (this.foo(), self.foo())
 *   2. Same-file function calls (foo())
 *   3. Cross-file imports       (resolve via import statements)
 *
 * CALL edges are: { sourceId: callerNodeId, targetId: calleeNodeId, relationType: 'CALLS' }
 *
 * Handles:
 *   - Direct calls:      foo()
 *   - Method calls:      obj.bar()
 *   - Chained:           a.b.c()  → records 'c' as callee name
 *   - Constructor calls: new Foo()
 *   - Static calls:      ClassName.method()
 *   - Python:            self.method()
 *   - Java:              this.method(), super.method(), ClassName.method()
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
exports.CallResolver = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const Logger_1 = require("../../utils/Logger");
const glob_1 = require("glob");
const LANGUAGE_MAP = {
    typescript: { exts: ['.ts', '.tsx'] },
    javascript: { exts: ['.js', '.jsx', '.mjs'] },
    python: { exts: ['.py'] },
    java: { exts: ['.java'] },
    go: { exts: ['.go'] },
    rust: { exts: ['.rs'] },
    cpp: { exts: ['.cpp', '.cc', '.cxx', '.h', '.hpp', '.c'] },
};
// AST node types that represent a function call
const CALL_EXPRESSION_TYPES = new Set([
    'call_expression', // JS/TS/Go/Rust
    'method_invocation', // Java
    'explicit_generic_invocation', // Java generic method call
    'object_creation_expression', // Java: new Foo()
    'call', // Python (via Tree-sitter)
]);
class CallResolver {
    constructor(workspaceRoot, extensionRoot) {
        this.extensionRoot = extensionRoot;
        this.Parser = null;
        this.languages = new Map();
        this.initialized = false;
        this.workspaceRoot = workspaceRoot;
    }
    async ensureInitialized() {
        if (this.initialized)
            return;
        const ParserClass = require('web-tree-sitter');
        // Emscripten deletes .init() after it runs successfully the first time.
        // If it exists, load the WASM. If it's gone, it's already loaded!
        if (typeof ParserClass.init === 'function') {
            const wasmPath = path.join(this.extensionRoot, 'node_modules', 'web-tree-sitter', 'tree-sitter.wasm');
            await ParserClass.init({ locateFile: () => wasmPath });
        }
        this.Parser = ParserClass;
        this.initialized = true;
    }
    /**
     * Run over the entire workspace, producing CALL edges.
     * Returns only NEW edges not already in the store.
     */
    async resolveWorkspace(store) {
        await this.ensureInitialized();
        const vscode = await Promise.resolve().then(() => __importStar(require('vscode')));
        const config = vscode.workspace.getConfiguration('semanticKG');
        const excludePatterns = config.get('excludePatterns', [
            '**/node_modules/**', '**/.git/**', '**/dist/**', '**/out/**',
            '**/__pycache__/**', '**/target/**', '**/build/**',
        ]);
        const allExts = Object.values(LANGUAGE_MAP).flatMap(l => l.exts);
        const files = await (0, glob_1.glob)(`**/*{${allExts.join(',')}}`, {
            cwd: this.workspaceRoot, ignore: excludePatterns, absolute: true,
        });
        // Build symbol table: name → list of node IDs (multiple files may have same name)
        const symbolTable = this.buildSymbolTable(store);
        // Build import map: file relPath → Map<alias, resolved relPath>
        const importMaps = this.buildImportMaps(files);
        const allEdges = [];
        let resolved = 0, unresolved = 0;
        for (const filePath of files) {
            try {
                const edges = await this.resolveFile(filePath, store, symbolTable, importMaps);
                allEdges.push(...edges);
                resolved += edges.length;
            }
            catch (err) {
                Logger_1.Logger.warn(`CallResolver skip ${path.relative(this.workspaceRoot, filePath)}: ${err}`);
                unresolved++;
            }
        }
        Logger_1.Logger.info(`CallResolver: ${resolved} CALL edges resolved, ${unresolved} files skipped`);
        return allEdges;
    }
    buildSymbolTable(store) {
        const table = new Map();
        for (const node of store.getAllNodes()) {
            if (node.type === 'file')
                continue;
            if (!table.has(node.name))
                table.set(node.name, []);
            table.get(node.name).push(node);
        }
        return table;
    }
    /**
     * Build a per-file import map.
     * import { Foo } from './foo'  →  'Foo' → 'path/to/foo.ts'
     * import * as Bar from './bar' →  'Bar' → 'path/to/bar.ts'
     */
    buildImportMaps(files) {
        const maps = new Map();
        for (const filePath of files) {
            const relPath = path.relative(this.workspaceRoot, filePath).replace(/\\/g, '/');
            const aliases = new Map();
            try {
                const code = fs.readFileSync(filePath, 'utf-8');
                const dir = path.dirname(filePath);
                // ES module imports: import { A, B } from './module'
                const namedImportRe = /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g;
                let m;
                while ((m = namedImportRe.exec(code)) !== null) {
                    const resolved = resolveImportPath(m[2], dir, this.workspaceRoot);
                    if (!resolved)
                        continue;
                    m[1].split(',').forEach(part => {
                        const name = part.trim().split(/\s+as\s+/).pop()?.trim();
                        if (name)
                            aliases.set(name, resolved);
                    });
                }
                // Default / star imports: import Foo from './foo'  OR  import * as Foo from './foo'
                const defaultImportRe = /import\s+(?:\*\s+as\s+)?(\w+)\s+from\s+['"]([^'"]+)['"]/g;
                while ((m = defaultImportRe.exec(code)) !== null) {
                    const resolved = resolveImportPath(m[2], dir, this.workspaceRoot);
                    if (resolved)
                        aliases.set(m[1], resolved);
                }
                // Java imports: import com.example.Foo;
                const javaImportRe = /import\s+(?:static\s+)?([\w.]+);/g;
                while ((m = javaImportRe.exec(code)) !== null) {
                    const parts = m[1].split('.');
                    const className = parts[parts.length - 1];
                    // Map class name to a placeholder path (we'll resolve by name in symbol table)
                    aliases.set(className, m[1].replace(/\./g, '/'));
                }
                // Python imports: from .module import Foo
                const pyImportRe = /from\s+([\w.]+)\s+import\s+([\w,\s*]+)/g;
                while ((m = pyImportRe.exec(code)) !== null) {
                    m[2].split(',').forEach(part => {
                        const name = part.trim();
                        if (name && name !== '*')
                            aliases.set(name, m[1]);
                    });
                }
            }
            catch { /* skip */ }
            maps.set(relPath, aliases);
        }
        return maps;
    }
    async resolveFile(filePath, store, symbolTable, importMaps) {
        const ext = path.extname(filePath).toLowerCase();
        const langEntry = Object.entries(LANGUAGE_MAP).find(([, v]) => v.exts.includes(ext));
        if (!langEntry)
            return [];
        const [langName] = langEntry;
        let code;
        try {
            code = fs.readFileSync(filePath, 'utf-8');
        }
        catch {
            return [];
        }
        const relPath = path.relative(this.workspaceRoot, filePath).replace(/\\/g, '/');
        const nodesInFile = store.getNodesByFile(filePath);
        const importMap = importMaps.get(relPath) ?? new Map();
        // Build a local symbol map: name → nodeId (for this file)
        const localSymbols = new Map();
        for (const n of nodesInFile) {
            if (n.type !== 'file')
                localSymbols.set(n.name, n.id);
        }
        const edges = [];
        // Try tree-sitter; fallback to regex
        try {
            const language = await this.loadLanguage(langName);
            const parser = new this.Parser();
            parser.setLanguage(language);
            const tree = parser.parse(code);
            this.walkForCalls(tree.rootNode, code, relPath, filePath, nodesInFile, localSymbols, symbolTable, importMap, edges);
            tree.delete();
        }
        catch {
            this.regexCallFallback(code, relPath, nodesInFile, localSymbols, symbolTable, edges);
        }
        return edges;
    }
    async loadLanguage(langName) {
        if (this.languages.has(langName))
            return this.languages.get(langName);
        const GRAMMAR_MAP = {
            typescript: 'tree-sitter-typescript.wasm',
            javascript: 'tree-sitter-javascript.wasm',
            python: 'tree-sitter-python.wasm',
            java: 'tree-sitter-java.wasm',
            go: 'tree-sitter-go.wasm',
            rust: 'tree-sitter-rust.wasm',
            cpp: 'tree-sitter-cpp.wasm',
        };
        const p = path.join(this.extensionRoot, 'grammars', GRAMMAR_MAP[langName] ?? '');
        if (!fs.existsSync(p))
            throw new Error(`Grammar not found for ${langName}`);
        const lang = await this.Parser.Language.load(p);
        this.languages.set(langName, lang);
        return lang;
    }
    // ── AST walk for call expressions ──────────────────────────────────────────
    walkForCalls(rootNode, code, relPath, filePath, nodesInFile, localSymbols, symbolTable, importMap, edges) {
        const addedEdges = new Set(); // dedup key = "source→target"
        const walk = (node, enclosingNodeId) => {
            if (!node)
                return;
            const t = node.type ?? '';
            // Track which symbol we're inside (to set the caller)
            let currentNodeId = enclosingNodeId;
            if (this.isSymbolNode(t) && enclosingNodeId !== null) {
                const name = node.childForFieldName?.('name')?.text ??
                    node.children?.find((c) => c.type === 'identifier')?.text;
                if (name) {
                    const candidate = nodesInFile.find(n => n.name === name);
                    if (candidate)
                        currentNodeId = candidate.id;
                }
            }
            if (CALL_EXPRESSION_TYPES.has(t)) {
                const calledName = extractCalledName(node, t);
                if (calledName && currentNodeId) {
                    const calleeId = this.resolveCallee(calledName, currentNodeId, relPath, localSymbols, symbolTable, importMap);
                    if (calleeId && calleeId !== currentNodeId) {
                        const key = `${currentNodeId}→${calleeId}`;
                        if (!addedEdges.has(key)) {
                            addedEdges.add(key);
                            edges.push({ sourceId: currentNodeId, targetId: calleeId, relationType: 'CALLS' });
                        }
                    }
                }
            }
            for (const child of (node.children ?? []))
                walk(child, currentNodeId);
        };
        // Start with file-level context
        walk(rootNode, null);
    }
    isSymbolNode(type) {
        return (type === 'function_declaration' || type === 'function_definition' ||
            type === 'method_definition' || type === 'method_declaration' ||
            type === 'constructor_declaration' || type === 'function_item' ||
            type === 'arrow_function');
    }
    /**
     * Resolve a called name to a node ID using 3-tier strategy:
     * 1. Same file (local symbols)
     * 2. Imported file (import map)
     * 3. Global symbol table (any file, pick best match)
     */
    resolveCallee(calledName, callerId, relPath, localSymbols, symbolTable, importMap) {
        // Tier 1: same file
        if (localSymbols.has(calledName))
            return localSymbols.get(calledName);
        // Tier 2: imported
        if (importMap.has(calledName)) {
            const importedPath = importMap.get(calledName);
            const candidates = symbolTable.get(calledName) ?? [];
            const match = candidates.find(n => n.filePath.includes(importedPath.replace(/\./g, '/')));
            if (match)
                return match.id;
        }
        // Tier 3: global — pick the candidate in the same package/directory first
        const candidates = symbolTable.get(calledName) ?? [];
        if (candidates.length === 0)
            return null;
        if (candidates.length === 1)
            return candidates[0].id;
        // Prefer same directory
        const callerDir = relPath.split('/').slice(0, -1).join('/');
        const sameDir = candidates.find(n => n.filePath.includes(callerDir));
        return sameDir?.id ?? candidates[0].id;
    }
    // ── Regex fallback for call resolution ────────────────────────────────────
    regexCallFallback(code, relPath, nodesInFile, localSymbols, symbolTable, edges) {
        // Find all call patterns: identifier(  or  obj.method(
        const callRe = /(?:(\w+)\.)?(\w+)\s*\(/g;
        let m;
        const added = new Set();
        while ((m = callRe.exec(code)) !== null) {
            const calledName = m[2];
            if (!calledName || calledName.length < 2)
                continue;
            // Skip keywords
            if (['if', 'for', 'while', 'switch', 'catch', 'function', 'class', 'return', 'new'].includes(calledName))
                continue;
            const calleeId = localSymbols.get(calledName) ??
                (symbolTable.get(calledName)?.[0]?.id ?? null);
            if (!calleeId)
                continue;
            // Find the enclosing function (by line number)
            const lineNo = code.slice(0, m.index).split('\n').length - 1;
            const caller = nodesInFile
                .filter(n => n.type !== 'file' && n.startLine <= lineNo && n.endLine >= lineNo)
                .sort((a, b) => (b.endLine - b.startLine) - (a.endLine - a.startLine)) // most specific
                .pop();
            if (!caller || caller.id === calleeId)
                continue;
            const key = `${caller.id}→${calleeId}`;
            if (!added.has(key)) {
                added.add(key);
                edges.push({ sourceId: caller.id, targetId: calleeId, relationType: 'CALLS' });
            }
        }
    }
}
exports.CallResolver = CallResolver;
// ── Helpers ───────────────────────────────────────────────────────────────────
/**
 * Extract the called function/method name from a call expression node.
 */
function extractCalledName(node, type) {
    // Java: method_invocation has 'name' field
    if (type === 'method_invocation') {
        return node.childForFieldName?.('name')?.text ?? null;
    }
    // Java: object_creation_expression → new Foo()
    if (type === 'object_creation_expression') {
        return node.childForFieldName?.('type')?.text ?? null;
    }
    // JS/TS/Go: call_expression has 'function' field
    const funcNode = node.childForFieldName?.('function') ?? node.children?.[0];
    if (!funcNode)
        return null;
    // Direct call: foo()
    if (funcNode.type === 'identifier')
        return funcNode.text;
    // Member call: obj.method()
    if (funcNode.type === 'member_expression' || funcNode.type === 'field_access' ||
        funcNode.type === 'selector_expression') {
        return funcNode.childForFieldName?.('property')?.text ??
            funcNode.childForFieldName?.('field')?.text ??
            funcNode.children?.at(-1)?.text ?? null;
    }
    return null;
}
function resolveImportPath(importPath, fromDir, workspaceRoot) {
    if (!importPath.startsWith('.'))
        return null; // external package
    const exts = ['.ts', '.tsx', '.js', '.jsx', '.mjs', ''];
    for (const ext of exts) {
        const full = path.resolve(fromDir, importPath + ext);
        if (fs.existsSync(full)) {
            return path.relative(workspaceRoot, full).replace(/\\/g, '/');
        }
    }
    // Try index file
    for (const ext of ['.ts', '.js']) {
        const full = path.resolve(fromDir, importPath, 'index' + ext);
        if (fs.existsSync(full)) {
            return path.relative(workspaceRoot, full).replace(/\\/g, '/');
        }
    }
    return null;
}
//# sourceMappingURL=CallResolver.js.map