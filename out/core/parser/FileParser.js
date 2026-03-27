"use strict";
/**
 * FileParser — Phase 1: Symbol extraction via Tree-sitter (WASM)
 *
 * Root cause of missing Java function nodes (FIXED):
 *   - Java uses 'method_declaration', not 'method_definition'
 *   - Java constructors are 'constructor_declaration'
 *   - walk() was not recursing into class_body/block nodes when they
 *     fell into the generic else-branch, so methods inside classes were lost.
 *   - FIX: every AST node type now always recurses; symbol types are
 *     detected by a Set lookup, not fragile if/else chains.
 *
 * Produces:
 *   - CodeNode[] with FULL metadata (modifiers, className, packageName, etc.)
 *   - CodeEdge[] for CONTAINS, EXTENDS, IMPLEMENTS
 *
 * CALL edges are NOT produced here — see CallResolver.ts (second pass).
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
exports.FileParser = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const glob_1 = require("glob");
const Logger_1 = require("../../utils/Logger");
const LANGUAGE_MAP = {
    typescript: { exts: ['.ts', '.tsx'], grammar: 'tree-sitter-typescript.wasm' },
    javascript: { exts: ['.js', '.jsx', '.mjs'], grammar: 'tree-sitter-javascript.wasm' },
    python: { exts: ['.py'], grammar: 'tree-sitter-python.wasm' },
    java: { exts: ['.java'], grammar: 'tree-sitter-java.wasm' },
    go: { exts: ['.go'], grammar: 'tree-sitter-go.wasm' },
    rust: { exts: ['.rs'], grammar: 'tree-sitter-rust.wasm' },
    cpp: { exts: ['.cpp', '.cc', '.cxx', '.h', '.hpp', '.c'], grammar: 'tree-sitter-cpp.wasm' },
};
// ── DEBUG HANG DETECTOR ──────────────────────────────────────────────────────
function withTimeout(promise, ms, label) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`[HANG DETECTED] ${label} froze for ${ms}ms!`)), ms))
    ]);
}
// ─────────────────────────────────────────────────────────────────────────────
// ── Per-language AST node type sets ──────────────────────────────────────────
const CLASS_NODE_TYPES = new Set([
    'class_declaration', // JS/TS/Java/C#
    'class_definition', // Python
    'struct_item', // Rust
    'impl_item', // Rust impl block
    'enum_declaration', // Java
    'record_declaration', // Java 16+
    'type_declaration', // Go (struct/interface)
]);
const INTERFACE_NODE_TYPES = new Set([
    'interface_declaration', // JS/TS/Java
    'trait_item', // Rust
]);
// Functions that live at file level
const FUNCTION_NODE_TYPES = new Set([
    'function_declaration', // JS/TS/Go
    'function_definition', // Python/C/C++
    'function_item', // Rust
    'function_expression', // JS (var fn = function() {})
    'arrow_function', // JS/TS (const fn = () => {})
    'function_signature', // TS declaration files
]);
// Functions that live inside a class body
const METHOD_NODE_TYPES = new Set([
    'method_definition', // JS/TS class method
    'method_declaration', // Java
    'constructor_declaration', // Java constructor
    'method_signature', // TS interface method
]);
const MODIFIER_KEYWORDS = new Set([
    'public', 'private', 'protected', 'static', 'abstract', 'final',
    'async', 'override', 'readonly', 'export', 'default', 'native',
    'synchronized', 'volatile', 'transient',
]);
class FileParser {
    constructor(workspaceRoot, extensionRoot) {
        this.ParserClass = null; // The Parser constructor
        this.Language = null; // The Language static class (stored separately)
        this.languages = new Map();
        this.initialized = false;
        this.workspaceRoot = workspaceRoot;
        this.extensionRoot = extensionRoot;
    }
    async ensureInitialized() {
        if (this.initialized)
            return;
        const ParserClass = require('web-tree-sitter');
        // 0.22.x: init() is idempotent and safe to call every time,
        // but it returns immediately after the first real load, so
        // the typeof guard is kept for 0.20.x back-compat just in case.
        if (typeof ParserClass.init === 'function') {
            const wasmPath = path.join(this.extensionRoot, 'node_modules', 'web-tree-sitter', 'tree-sitter.wasm');
            try {
                await ParserClass.init({ locateFile: () => wasmPath });
            }
            catch (err) {
                // "already initialized" is harmless in 0.22.x
                if (!String(err).includes('already'))
                    throw err;
            }
        }
        catch (e) {
            Logger_1.Logger.error(`[DEBUG] Tree-sitter init FATAL ERROR: ${e}`);
            throw e;
        }
        this.ParserClass = TreeSitter;
        this.Language = TreeSitter.Language;
        this.initialized = true;
        Logger_1.Logger.info(`[DEBUG] ensureInitialized() completed`);
    }
    // ── Workspace parse ────────────────────────────────────────────────────────
    async parseWorkspace() {
        await this.ensureInitialized();
        const vscode = await Promise.resolve().then(() => __importStar(require('vscode')));
        const config = vscode.workspace.getConfiguration('semanticKG');
        const excludePatterns = config.get('excludePatterns', [
            '**/node_modules/**', '**/.git/**', '**/dist/**', '**/out/**',
            '**/__pycache__/**', '**/target/**', '**/build/**', '**/bin/**',
        ]);
        const allExts = Object.values(LANGUAGE_MAP).flatMap(l => l.exts);
        const files = await (0, glob_1.glob)(`**/*{${allExts.join(',')}}`, {
            cwd: this.workspaceRoot,
            ignore: excludePatterns,
            absolute: true,
        });
        Logger_1.Logger.info(`Parsing ${files.length} files...`);
        const allNodes = [];
        const allEdges = [];
        let parsed = 0, skipped = 0;
        for (const filePath of files) {
            try {
                const { nodes, edges } = await this.parseFile(filePath);
                allNodes.push(...nodes);
                allEdges.push(...edges);
                parsed++;
            }
            catch (err) {
                Logger_1.Logger.warn(`Skip ${path.relative(this.workspaceRoot, filePath)}: ${err}`);
                skipped++;
            }
        }
        Logger_1.Logger.info(`Parse done: ${parsed} files, ${skipped} skipped, ` +
            `${allNodes.length} nodes, ${allEdges.length} structural edges`);
        return { nodes: allNodes, edges: allEdges };
    }
    // ── Single file parse ──────────────────────────────────────────────────────
    async parseFile(filePath) {
        await this.ensureInitialized();
        const ext = path.extname(filePath).toLowerCase();
        const langEntry = Object.entries(LANGUAGE_MAP).find(([, v]) => v.exts.includes(ext));
        if (!langEntry)
            return { nodes: [], edges: [] };
        const [langName, langConfig] = langEntry;
        let code;
        try {
            code = fs.readFileSync(filePath, 'utf-8');
        }
        catch {
            return { nodes: [], edges: [] };
        }
        const relPath = path.relative(this.workspaceRoot, filePath).replace(/\\/g, '/');
        const checksum = hashText(code);
        const lines = code.split('\n');
        const pkgName = extractPackageName(code, langName);
        const nodes = [];
        const edges = [];
        // File node (root of CONTAINS hierarchy)
        nodes.push({
            id: relPath, type: 'file', name: path.basename(filePath),
            filePath, signature: '', docstring: '', communityId: 0,
            checksum, isAutoGenerated: false, startLine: 0, endLine: lines.length,
            modifiers: [], className: null, packageName: pkgName,
        });
        try {
            // DEBUG: Log which grammar we are trying to load
            Logger_1.Logger.info(`Loading grammar for ${langName} from ${langConfig.grammar}`);
            const language = await this.loadLanguage(langName, langConfig.grammar);
            // DEBUG: Check if language object is valid before passing to parser
            if (!language) {
                throw new Error(`loadLanguage returned null for ${langName}`);
            }
            const parser = new this.ParserClass();
            // DEBUG: This is often where the 'loadWebAssemblyModule' error triggers
            Logger_1.Logger.info(`Setting language for parser...`);
            parser.setLanguage(language);
            const tree = parser.parse(code);
            this.walkTree(tree.rootNode, code, lines, filePath, relPath, pkgName, nodes, edges);
            tree.delete();
        }
        catch (err) {
            // This will now catch the loadWebAssemblyModule error and give us context
            Logger_1.Logger.error(`Tree-sitter parse execution failed for ${relPath}: ${err}`);
            Logger_1.Logger.warn(`Falling back to regex for ${relPath}`);
            this.regexFallback(code, filePath, relPath, pkgName, nodes, edges);
        }
        return { nodes, edges };
    }
    async loadLanguage(langName, grammarFile) {
        if (this.languages.has(langName))
            return this.languages.get(langName);
        Logger_1.Logger.info(`[DEBUG] loadLanguage() called for: ${langName}`);
        if (!this.Language) {
            throw new Error("[DEBUG] Attempted to load language before Tree-sitter engine was initialized.");
        }
        const grammarPath = path.join(this.extensionRoot, 'grammars', grammarFile);
        Logger_1.Logger.info(`[DEBUG] Checking grammar file at: ${grammarPath}`);
        if (!fs.existsSync(grammarPath)) {
            throw new Error(`[DEBUG] Grammar not found: ${grammarPath}`);
        }
        Logger_1.Logger.info(`[DEBUG] Reading raw bytes from ${grammarFile}...`);
        const bytes = fs.readFileSync(grammarPath);
        Logger_1.Logger.info(`[DEBUG] Read ${bytes.length} bytes for ${langName}. Converting to Uint8Array...`);
        const uint8Array = new Uint8Array(bytes);
        try {
            Logger_1.Logger.info(`[DEBUG] Awaiting this.Language.load() for ${langName}...`);
            // Wrap grammar loading in a 3-second timeout! 
            // THIS IS WHERE IT IS LIKELY HANGING.
            const loaded = await withTimeout(this.Language.load(uint8Array), 3000, `Language.load(${langName})`);
            Logger_1.Logger.info(`[DEBUG] this.Language.load() completed for ${langName}`);
            let lang = loaded;
            if (langName === 'typescript' && loaded && loaded.typescript) {
                lang = loaded.typescript;
            }
            this.languages.set(langName, lang);
            return lang;
        }
        catch (err) {
            Logger_1.Logger.error(`[DEBUG] WASM Load failed for ${langName}: ${err}`);
            throw err;
        }
    }
    // ── AST walker ─────────────────────────────────────────────────────────────
    walkTree(rootNode, code, lines, filePath, relPath, pkgName, nodes, edges) {
        /**
         * Recursive walk.
         * parentId    — graph ID of the innermost enclosing symbol node
         * parentClass — name of the innermost enclosing class (null at file level)
         *
         * KEY DESIGN: we ALWAYS recurse into every node. The only thing that
         * changes per symbol type is what we push to nodes/edges BEFORE recursing.
         */
        const walk = (node, parentId, parentClass) => {
            if (!node)
                return;
            const t = node.type ?? '';
            // ── CLASS ──────────────────────────────────────────────────────────
            if (CLASS_NODE_TYPES.has(t)) {
                const name = resolveClassName(node, t);
                if (name) {
                    const id = `${relPath}:${name}`;
                    const doc = extractDocstring(node, lines);
                    nodes.push({
                        id, type: 'class', name, filePath,
                        signature: buildClassSignature(node, name),
                        docstring: doc, communityId: 0,
                        checksum: hashText(node.text?.slice(0, 300) ?? ''),
                        isAutoGenerated: false,
                        startLine: node.startPosition.row, endLine: node.endPosition.row,
                        modifiers: extractModifiers(node), className: null, packageName: pkgName,
                    });
                    edges.push({ sourceId: parentId, targetId: id, relationType: 'CONTAINS' });
                    extractHeritage(node, id, relPath, edges);
                    // Recurse with this class as the new parent
                    for (const child of (node.children ?? []))
                        walk(child, id, name);
                    return; // ← don't fall through to the default recurse below
                }
            }
            // ── INTERFACE / TRAIT ──────────────────────────────────────────────
            if (INTERFACE_NODE_TYPES.has(t)) {
                const name = getFieldText(node, ['name', 'type_identifier', 'identifier']);
                if (name) {
                    const id = `${relPath}:${name}`;
                    nodes.push({
                        id, type: 'interface', name, filePath,
                        signature: `interface ${name}`,
                        docstring: extractDocstring(node, lines), communityId: 0,
                        checksum: '', isAutoGenerated: false,
                        startLine: node.startPosition.row, endLine: node.endPosition.row,
                        modifiers: extractModifiers(node), className: null, packageName: pkgName,
                    });
                    edges.push({ sourceId: parentId, targetId: id, relationType: 'CONTAINS' });
                    // Interface extends other interfaces
                    for (const child of (node.children ?? [])) {
                        if (child.type === 'extends_clause') {
                            collectTypeNames(child).forEach(iname => edges.push({ sourceId: id, targetId: `${relPath}:${iname}`, relationType: 'EXTENDS' }));
                        }
                    }
                    for (const child of (node.children ?? []))
                        walk(child, id, name);
                    return;
                }
            }
            // ── METHOD (inside a class) ────────────────────────────────────────
            if (METHOD_NODE_TYPES.has(t)) {
                const name = resolveMethodName(node, t);
                if (name) {
                    const isInsideClass = parentClass !== null;
                    const id = isInsideClass
                        ? `${relPath}:${parentClass}.${name}`
                        : `${relPath}:${name}`;
                    nodes.push({
                        id, type: isInsideClass ? 'method' : 'function', name, filePath,
                        signature: extractSignature(node, code),
                        docstring: extractDocstring(node, lines), communityId: 0,
                        checksum: hashText(node.text?.slice(0, 500) ?? ''),
                        isAutoGenerated: false,
                        startLine: node.startPosition.row, endLine: node.endPosition.row,
                        modifiers: extractModifiers(node),
                        className: parentClass,
                        packageName: pkgName,
                    });
                    edges.push({ sourceId: parentId, targetId: id, relationType: 'CONTAINS' });
                    // Recurse into body for nested functions
                    for (const child of (node.children ?? []))
                        walk(child, id, parentClass);
                    return;
                }
            }
            // ── FUNCTION (file level or nested) ───────────────────────────────
            if (FUNCTION_NODE_TYPES.has(t)) {
                const name = resolveFunctionName(node, t);
                if (name) {
                    const isInsideClass = parentClass !== null;
                    const id = isInsideClass
                        ? `${relPath}:${parentClass}.${name}`
                        : `${relPath}:${name}`;
                    nodes.push({
                        id, type: isInsideClass ? 'method' : 'function', name, filePath,
                        signature: extractSignature(node, code),
                        docstring: extractDocstring(node, lines), communityId: 0,
                        checksum: hashText(node.text?.slice(0, 500) ?? ''),
                        isAutoGenerated: false,
                        startLine: node.startPosition.row, endLine: node.endPosition.row,
                        modifiers: extractModifiers(node),
                        className: parentClass,
                        packageName: pkgName,
                    });
                    edges.push({ sourceId: parentId, targetId: id, relationType: 'CONTAINS' });
                    for (const child of (node.children ?? []))
                        walk(child, id, parentClass);
                    return;
                }
            }
            // ── DEFAULT: always recurse, preserving context ────────────────────
            for (const child of (node.children ?? []))
                walk(child, parentId, parentClass);
        };
        walk(rootNode, relPath, null);
    }
    // ── Regex fallback ─────────────────────────────────────────────────────────
    // ── Regex fallback ─────────────────────────────────────────────────────────
    regexFallback(code, filePath, relPath, pkgName, nodes, edges) {
        const JS_RESERVED = new Set([
            'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'return', 'break', 'continue',
            'try', 'catch', 'finally', 'throw', 'new', 'delete', 'typeof', 'void', 'in', 'of',
            'instanceof', 'class', 'extends', 'import', 'export', 'from', 'const', 'let', 'var',
            'function', 'async', 'await', 'yield', 'super', 'this', 'true', 'false', 'null',
            'undefined', 'debugger', 'with', 'default',
        ]);
        /**
         * Push a node + CONTAINS edge, deduplicating by id.
         * className non-null → id becomes relPath:ClassName.name, parent is the class node.
         */
        const push = (name, type, lineNo, sig, className = null) => {
            const id = className ? `${relPath}:${className}.${name}` : `${relPath}:${name}`;
            const parentId = className ? `${relPath}:${className}` : relPath;
            if (nodes.some(n => n.id === id))
                return;
            nodes.push({
                id, type, name, filePath,
                signature: sig.slice(0, 200), docstring: '',
                communityId: 0, checksum: '', isAutoGenerated: false,
                startLine: lineNo, endLine: lineNo,
                modifiers: [], className, packageName: pkgName,
            });
            edges.push({ sourceId: parentId, targetId: id, relationType: 'CONTAINS' });
        };
        const lineOf = (upToIndex) => code.slice(0, upToIndex).split('\n').length - 1;
        // ── 1. File-level constructs ─────────────────────────────────────────────
        const fileLevelPatterns = [
            // JS/TS named function declarations
            [/^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*(\w+)/gm, 'function'],
            // JS/TS arrow / function expression assigned to a variable
            [/^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:function\b|\(|[\w$]+\s*=>)/gm, 'function'],
            // Python top-level def
            [/^(?:async\s+)?def\s+(\w+)\s*\(/gm, 'function'],
            // Go function (with optional receiver)
            [/^func\s+(?:\(\s*\w*\s*\*?\s*\w+\s*\)\s+)?(\w+)\s*\(/gm, 'function'],
            // Rust fn
            [/^(?:pub(?:\s*\([^)]*\))?\s+)?(?:async\s+)?fn\s+(\w+)/gm, 'function'],
        ];
        for (const [rx, type] of fileLevelPatterns) {
            let m;
            while ((m = rx.exec(code)) !== null) {
                const name = m[1];
                if (!name || name.length < 2 || JS_RESERVED.has(name))
                    continue;
                push(name, type, lineOf(m.index), m[0].trim());
            }
        }
        // ── 2. Classes + their methods ───────────────────────────────────────────
        // Matches JS/TS/Java/Python class declarations
        const classRx = /^(?:export\s+)?(?:abstract\s+)?(?:public\s+)?class\s+(\w+)/gm;
        let cm;
        while ((cm = classRx.exec(code)) !== null) {
            const className = cm[1];
            const classLineNo = lineOf(cm.index);
            push(className, 'class', classLineNo, cm[0].trim());
            // Locate the opening brace of the class body
            const openBrace = code.indexOf('{', cm.index);
            if (openBrace === -1)
                continue;
            // Extract the class body by counting matched braces
            let depth = 0;
            let bodyEnd = openBrace;
            for (let i = openBrace; i < code.length; i++) {
                if (code[i] === '{')
                    depth++;
                else if (code[i] === '}') {
                    depth--;
                    if (depth === 0) {
                        bodyEnd = i;
                        break;
                    }
                }
            }
            const classBody = code.slice(openBrace + 1, bodyEnd);
            const classBodyStartLine = lineOf(openBrace + 1);
            const methodLineOf = (offsetInBody) => classBodyStartLine + classBody.slice(0, offsetInBody).split('\n').length - 1;
            // ── JS/TS class methods ──────────────────────────────────────────────
            // Handles: constructor, async foo(), static bar(), get prop(), #privateMethod()
            // Requires at least 1 space of indentation to avoid matching nested class declarations.
            const jsMethodRx = /^[ \t]+(?:(?:static|async|get|set|public|private|protected|override|abstract|readonly|declare)\s+)*([a-zA-Z_$#][\w$]*)\s*[(<]/gm;
            let mm;
            while ((mm = jsMethodRx.exec(classBody)) !== null) {
                const name = mm[1].replace(/^#/, ''); // strip private field # prefix for the node name
                if (!name || name.length < 2 || JS_RESERVED.has(name))
                    continue;
                // Skip property initialisers: "name = " (assignment, not a method)
                const afterName = classBody.slice(mm.index + mm[0].length - 1).trimStart();
                if (afterName.startsWith('=') && !afterName.startsWith('=>'))
                    continue;
                push(name, 'method', methodLineOf(mm.index), mm[0].trim(), className);
            }
            // ── Python methods inside class ──────────────────────────────────────
            const pyMethodRx = /^[ \t]+(?:async\s+)?def\s+(\w+)\s*\(/gm;
            let pm;
            while ((pm = pyMethodRx.exec(classBody)) !== null) {
                const name = pm[1];
                if (!name || name.length < 2)
                    continue;
                push(name, 'method', methodLineOf(pm.index), pm[0].trim(), className);
            }
            // ── Java methods inside class ────────────────────────────────────────
            // Pattern: optional modifiers, return type, methodName(
            const javaMethodRx = /^[ \t]+(?:(?:public|private|protected|static|final|abstract|synchronized|native|default|override)\s+)*[\w<>\[\]]+\s+(\w+)\s*\(/gm;
            let jm;
            while ((jm = javaMethodRx.exec(classBody)) !== null) {
                const name = jm[1];
                if (!name || name.length < 2 || JS_RESERVED.has(name))
                    continue;
                // Avoid double-counting what the JS pattern already caught
                if (nodes.some(n => n.id === `${relPath}:${className}.${name}`))
                    continue;
                push(name, 'method', methodLineOf(jm.index), jm[0].trim(), className);
            }
        }
    }
}
exports.FileParser = FileParser;
// ── Name resolution helpers ───────────────────────────────────────────────────
function resolveClassName(node, type) {
    // Most languages: 'name' field or first identifier child
    return (getFieldText(node, ['name', 'type_identifier', 'identifier']) ??
        // Rust impl blocks: find the type being implemented
        (type === 'impl_item' ? getFieldText(node, ['type']) : null));
}
function resolveMethodName(node, type) {
    return getFieldText(node, ['name', 'identifier']);
}
function resolveFunctionName(node, type) {
    // Arrow functions / function expressions assigned to variable:
    // the variable name is in the parent, which we don't have here.
    // We skip truly anonymous functions.
    return getFieldText(node, ['name', 'identifier']);
}
function getFieldText(node, fields) {
    for (const f of fields) {
        const child = node.childForFieldName?.(f);
        if (child?.text)
            return child.text;
    }
    // Fallback scan of direct children
    for (const child of (node.children ?? [])) {
        if (child.type === 'identifier' || child.type === 'type_identifier') {
            return child.text;
        }
    }
    return null;
}
// ── Heritage (extends/implements) ────────────────────────────────────────────
function extractHeritage(classNode, classId, relPath, edges) {
    for (const child of (classNode.children ?? [])) {
        const t = child.type;
        if (['superclass', 'extends_clause', 'base_class_clause', 'class_heritage'].includes(t)) {
            collectTypeNames(child).forEach(name => edges.push({ sourceId: classId, targetId: `${relPath}:${name}`, relationType: 'EXTENDS' }));
        }
        else if (['class_implements', 'implements_clause', 'super_interfaces'].includes(t)) {
            collectTypeNames(child).forEach(name => edges.push({ sourceId: classId, targetId: `${relPath}:${name}`, relationType: 'IMPLEMENTS' }));
        }
    }
}
function collectTypeNames(node) {
    const names = [];
    const visit = (n) => {
        if (n.type === 'type_identifier' || n.type === 'identifier')
            names.push(n.text);
        else
            (n.children ?? []).forEach((c) => visit(c));
    };
    visit(node);
    return names;
}
// ── Modifier extraction ───────────────────────────────────────────────────────
function extractModifiers(node) {
    const mods = new Set();
    for (const child of (node.children ?? [])) {
        if (MODIFIER_KEYWORDS.has(child.type) || MODIFIER_KEYWORDS.has(child.text ?? '')) {
            mods.add(child.text ?? child.type);
        }
        if (child.type === 'modifiers') { // Java
            for (const mod of (child.children ?? [])) {
                if (MODIFIER_KEYWORDS.has(mod.text ?? ''))
                    mods.add(mod.text);
            }
        }
    }
    return [...mods];
}
// ── Signature extraction ──────────────────────────────────────────────────────
function extractSignature(node, code) {
    const body = node.childForFieldName?.('body');
    if (body)
        return code.slice(node.startIndex, body.startIndex).replace(/\s+/g, ' ').trim().slice(0, 300);
    return (node.text?.split('\n')[0] ?? '').trim().slice(0, 300);
}
function buildClassSignature(node, name) {
    const first = node.text?.split('\n')[0] ?? `class ${name}`;
    return first.trim().slice(0, 200);
}
// ── Docstring extraction ──────────────────────────────────────────────────────
function extractDocstring(node, lines) {
    const startLine = node.startPosition?.row ?? 0;
    if (startLine === 0)
        return '';
    const prevLine = lines[startLine - 1]?.trim() ?? '';
    if (prevLine.startsWith('//') || prevLine.startsWith('#')) {
        return prevLine.replace(/^[/#\s*]+/, '').trim();
    }
    if (prevLine === '*/') {
        const commentLines = [];
        for (let i = startLine - 2; i >= Math.max(0, startLine - 40); i--) {
            const l = lines[i].trim();
            if (l.startsWith('/**') || l.startsWith('/*'))
                break;
            commentLines.unshift(l.replace(/^\*\s?/, ''));
        }
        return commentLines.join(' ').trim().slice(0, 500);
    }
    // Python docstring
    const bodyNode = node.childForFieldName?.('body');
    if (bodyNode) {
        const first = bodyNode.children?.[0];
        const strNode = first?.type === 'expression_statement' ? first.children?.[0] : first;
        if (strNode?.type === 'string') {
            return strNode.text.replace(/^['"`]{1,3}|['"`]{1,3}$/g, '').trim().slice(0, 500);
        }
    }
    return '';
}
// ── Package name extraction ───────────────────────────────────────────────────
function extractPackageName(code, langName) {
    const matchers = {
        java: /^\s*package\s+([\w.]+)\s*;/m,
        go: /^\s*package\s+(\w+)/m,
        rust: /^\s*(?:pub\s+)?mod\s+(\w+)/m,
        typescript: /^\s*(?:export\s+)?(?:namespace|module)\s+(\w+)/m,
    };
    const m = code.match(matchers[langName] ?? /(?!)/);
    return m?.[1] ?? null;
}
// ── Utilities ────────────────────────────────────────────────────────────────
function hashText(text) {
    return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}
//# sourceMappingURL=FileParser.js.map