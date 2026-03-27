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

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { glob } from 'glob';
import { CodeNode, CodeEdge, NodeType, EdgeType } from '../graph/GraphStore';
import { Logger } from '../../utils/Logger';

const LANGUAGE_MAP: Record<string, { exts: string[]; grammar: string }> = {
  typescript:  { exts: ['.ts', '.tsx'],             grammar: 'tree-sitter-typescript.wasm' },
  javascript:  { exts: ['.js', '.jsx', '.mjs'],     grammar: 'tree-sitter-javascript.wasm' },
  python:      { exts: ['.py'],                     grammar: 'tree-sitter-python.wasm' },
  java:        { exts: ['.java'],                   grammar: 'tree-sitter-java.wasm' },
  go:          { exts: ['.go'],                     grammar: 'tree-sitter-go.wasm' },
  rust:        { exts: ['.rs'],                     grammar: 'tree-sitter-rust.wasm' },
  cpp:         { exts: ['.cpp','.cc','.cxx','.h','.hpp','.c'], grammar: 'tree-sitter-cpp.wasm' },
};

// ── DEBUG HANG DETECTOR ──────────────────────────────────────────────────────
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`[HANG DETECTED] ${label} froze for ${ms}ms!`)), ms)
    )
  ]);
}
// ─────────────────────────────────────────────────────────────────────────────

// ── Per-language AST node type sets ──────────────────────────────────────────

const CLASS_NODE_TYPES = new Set([
  'class_declaration',        // JS/TS/Java/C#
  'class_definition',         // Python
  'struct_item',              // Rust
  'impl_item',                // Rust impl block
  'enum_declaration',         // Java
  'record_declaration',       // Java 16+
  'type_declaration',         // Go (struct/interface)
]);

const INTERFACE_NODE_TYPES = new Set([
  'interface_declaration',    // JS/TS/Java
  'trait_item',               // Rust
]);

// Functions that live at file level
const FUNCTION_NODE_TYPES = new Set([
  'function_declaration',     // JS/TS/Go
  'function_definition',      // Python/C/C++
  'function_item',            // Rust
  'function_expression',      // JS (var fn = function() {})
  'arrow_function',           // JS/TS (const fn = () => {})
  'function_signature',       // TS declaration files
]);

// Functions that live inside a class body
const METHOD_NODE_TYPES = new Set([
  'method_definition',        // JS/TS class method
  'method_declaration',       // Java
  'constructor_declaration',  // Java constructor
  'method_signature',         // TS interface method
]);

const MODIFIER_KEYWORDS = new Set([
  'public','private','protected','static','abstract','final',
  'async','override','readonly','export','default','native',
  'synchronized','volatile','transient',
]);

export interface ParseResult {
  nodes: CodeNode[];
  edges: CodeEdge[];
}

export class FileParser {
  private readonly workspaceRoot: string;
  private readonly extensionRoot: string;
  private ParserClass: any = null;   // The Parser constructor
  private Language: any = null;      // The Language static class (stored separately)
  private languages: Map<string, any> = new Map();
  private initialized = false;

  constructor(workspaceRoot: string, extensionRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.extensionRoot = extensionRoot;
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    Logger.info(`[DEBUG] ensureInitialized() started`);
    const wasmPath = path.join(this.extensionRoot, 'node_modules', 'web-tree-sitter', 'tree-sitter.wasm');
    
    Logger.info(`[DEBUG] Checking for main tree-sitter.wasm at: ${wasmPath}`);
    if (!fs.existsSync(wasmPath)) {
      throw new Error(`[DEBUG] Main WASM engine missing at ${wasmPath}`);
    }

    Logger.info(`[DEBUG] Requiring web-tree-sitter module...`);
    const TreeSitter = require('web-tree-sitter');

    try {
        Logger.info(`[DEBUG] Awaiting TreeSitter.init()...`);
        // Wrap init in a 5-second timeout to catch hangs
        await withTimeout(TreeSitter.init({ locateFile: () => wasmPath }), 5000, "TreeSitter.init()");
        Logger.info(`[DEBUG] TreeSitter.init() completed successfully.`);
        
        if (!(TreeSitter as any).Language) {
             Logger.warn("[DEBUG] Tree-sitter init finished but Language class is missing on the object!");
        }

    } catch (e) {
        Logger.error(`[DEBUG] Tree-sitter init FATAL ERROR: ${e}`);
        throw e;
    }

    this.ParserClass = TreeSitter;
    this.Language = TreeSitter.Language;
    this.initialized = true;
    Logger.info(`[DEBUG] ensureInitialized() completed`);
  }

  // ── Workspace parse ────────────────────────────────────────────────────────

  async parseWorkspace(): Promise<ParseResult> {
    await this.ensureInitialized();
    const vscode = await import('vscode');
    const config = vscode.workspace.getConfiguration('semanticKG');
    const excludePatterns: string[] = config.get('excludePatterns', [
      '**/node_modules/**','**/.git/**','**/dist/**','**/out/**',
      '**/__pycache__/**','**/target/**','**/build/**','**/bin/**',
    ]);

    const allExts = Object.values(LANGUAGE_MAP).flatMap(l => l.exts);
    const files = await glob(`**/*{${allExts.join(',')}}`, {
      cwd: this.workspaceRoot,
      ignore: excludePatterns,
      absolute: true,
    });

    Logger.info(`Parsing ${files.length} files...`);
    const allNodes: CodeNode[] = [];
    const allEdges: CodeEdge[] = [];
    let parsed = 0, skipped = 0;

    for (const filePath of files) {
      try {
        const { nodes, edges } = await this.parseFile(filePath);
        allNodes.push(...nodes);
        allEdges.push(...edges);
        parsed++;
      } catch (err) {
        Logger.warn(`Skip ${path.relative(this.workspaceRoot, filePath)}: ${err}`);
        skipped++;
      }
    }

    Logger.info(
      `Parse done: ${parsed} files, ${skipped} skipped, ` +
      `${allNodes.length} nodes, ${allEdges.length} structural edges`
    );
    return { nodes: allNodes, edges: allEdges };
  }

  // ── Single file parse ──────────────────────────────────────────────────────

  async parseFile(filePath: string): Promise<ParseResult> {
    await this.ensureInitialized();

    const ext = path.extname(filePath).toLowerCase();
    const langEntry = Object.entries(LANGUAGE_MAP).find(([, v]) => v.exts.includes(ext));
    if (!langEntry) return { nodes: [], edges: [] };

    const [langName, langConfig] = langEntry;

    let code: string;
    try { code = fs.readFileSync(filePath, 'utf-8'); }
    catch { return { nodes: [], edges: [] }; }

    const relPath   = path.relative(this.workspaceRoot, filePath).replace(/\\/g, '/');
    const checksum  = hashText(code);
    const lines     = code.split('\n');
    const pkgName   = extractPackageName(code, langName);

    const nodes: CodeNode[] = [];
    const edges: CodeEdge[] = [];

    // File node (root of CONTAINS hierarchy)
    nodes.push({
      id: relPath, type: 'file', name: path.basename(filePath),
      filePath, signature: '', docstring: '', communityId: 0,
      checksum, isAutoGenerated: false, startLine: 0, endLine: lines.length,
      modifiers: [], className: null, packageName: pkgName,
    });

    try {
      // DEBUG: Log which grammar we are trying to load
      Logger.info(`Loading grammar for ${langName} from ${langConfig.grammar}`);
      
      const language = await this.loadLanguage(langName, langConfig.grammar);
      
      // DEBUG: Check if language object is valid before passing to parser
      if (!language) {
        throw new Error(`loadLanguage returned null for ${langName}`);
      }

      const parser = new this.ParserClass();
      
      // DEBUG: This is often where the 'loadWebAssemblyModule' error triggers
      Logger.info(`Setting language for parser...`);
      parser.setLanguage(language); 
      
      const tree = parser.parse(code);
      this.walkTree(tree.rootNode, code, lines, filePath, relPath, pkgName, nodes, edges);
      tree.delete();
    } catch (err) {
      // This will now catch the loadWebAssemblyModule error and give us context
      Logger.error(`Tree-sitter parse execution failed for ${relPath}: ${err}`);
      Logger.warn(`Falling back to regex for ${relPath}`);
      this.regexFallback(code, filePath, relPath, pkgName, nodes, edges);
    }

    return { nodes, edges };
  }

private async loadLanguage(langName: string, grammarFile: string): Promise<any> {
    if (this.languages.has(langName)) return this.languages.get(langName);
    
    Logger.info(`[DEBUG] loadLanguage() called for: ${langName}`);

    if (!this.Language) {
        throw new Error("[DEBUG] Attempted to load language before Tree-sitter engine was initialized.");
    }

    const grammarPath = path.join(this.extensionRoot, 'grammars', grammarFile);
    Logger.info(`[DEBUG] Checking grammar file at: ${grammarPath}`);
    
    if (!fs.existsSync(grammarPath)) {
        throw new Error(`[DEBUG] Grammar not found: ${grammarPath}`);
    }

    Logger.info(`[DEBUG] Reading raw bytes from ${grammarFile}...`);
    const bytes = fs.readFileSync(grammarPath);
    Logger.info(`[DEBUG] Read ${bytes.length} bytes for ${langName}. Converting to Uint8Array...`);
    const uint8Array = new Uint8Array(bytes);

    try {
        Logger.info(`[DEBUG] Awaiting this.Language.load() for ${langName}...`);
        
        // Wrap grammar loading in a 3-second timeout! 
        // THIS IS WHERE IT IS LIKELY HANGING.
        const loaded = await withTimeout(
          this.Language.load(uint8Array), 
          3000, 
          `Language.load(${langName})`
        );
        
        Logger.info(`[DEBUG] this.Language.load() completed for ${langName}`);
        
        let lang = loaded;
        if (langName === 'typescript' && loaded && (loaded as any).typescript) {
            lang = (loaded as any).typescript;
        }

        this.languages.set(langName, lang);
        return lang;
    } catch (err) {
        Logger.error(`[DEBUG] WASM Load failed for ${langName}: ${err}`);
        throw err;
    }
  }
  // ── AST walker ─────────────────────────────────────────────────────────────

  private walkTree(
    rootNode: any,
    code:     string,
    lines:    string[],
    filePath: string,
    relPath:  string,
    pkgName:  string | null,
    nodes:    CodeNode[],
    edges:    CodeEdge[],
  ): void {

    /**
     * Recursive walk.
     * parentId    — graph ID of the innermost enclosing symbol node
     * parentClass — name of the innermost enclosing class (null at file level)
     *
     * KEY DESIGN: we ALWAYS recurse into every node. The only thing that
     * changes per symbol type is what we push to nodes/edges BEFORE recursing.
     */
    const walk = (node: any, parentId: string, parentClass: string | null): void => {
      if (!node) return;
      const t: string = node.type ?? '';

      // ── CLASS ──────────────────────────────────────────────────────────
      if (CLASS_NODE_TYPES.has(t)) {
        const name = resolveClassName(node, t);
        if (name) {
          const id  = `${relPath}:${name}`;
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
          for (const child of (node.children ?? [])) walk(child, id, name);
          return; // ← don't fall through to the default recurse below
        }
      }

      // ── INTERFACE / TRAIT ──────────────────────────────────────────────
      if (INTERFACE_NODE_TYPES.has(t)) {
        const name = getFieldText(node, ['name','type_identifier','identifier']);
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
              collectTypeNames(child).forEach(iname =>
                edges.push({ sourceId: id, targetId: `${relPath}:${iname}`, relationType: 'EXTENDS' })
              );
            }
          }

          for (const child of (node.children ?? [])) walk(child, id, name);
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
          for (const child of (node.children ?? [])) walk(child, id, parentClass);
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

          for (const child of (node.children ?? [])) walk(child, id, parentClass);
          return;
        }
      }

      // ── DEFAULT: always recurse, preserving context ────────────────────
      for (const child of (node.children ?? [])) walk(child, parentId, parentClass);
    };

    walk(rootNode, relPath, null);
  }

  // ── Regex fallback ─────────────────────────────────────────────────────────

  private regexFallback(
    code:     string,
    filePath: string,
    relPath:  string,
    pkgName:  string | null,
    nodes:    CodeNode[],
    edges:    CodeEdge[],
  ): void {
    const push = (name: string, type: NodeType, lineNo: number, sig: string) => {
      const id = `${relPath}:${name}`;
      if (nodes.some(n => n.id === id)) return;
      nodes.push({ id, type, name, filePath, signature: sig, docstring: '',
        communityId: 0, checksum: '', isAutoGenerated: false,
        startLine: lineNo, endLine: lineNo,
        modifiers: [], className: null, packageName: pkgName });
      edges.push({ sourceId: relPath, targetId: id, relationType: 'CONTAINS' });
    };

    const patterns: Array<[RegExp, NodeType]> = [
      [/^(?:export\s+)?(?:async\s+)?function\s+(\w+)/gm,                                   'function'],
      [/^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/gm,                 'function'],
      [/^\s*def\s+(\w+)/gm,                                                                  'function'],
      [/^\s*func\s+(\w+)/gm,                                                                 'function'],
      [/^\s*fn\s+(\w+)/gm,                                                                   'function'],
      [/^\s+(?:public|private|protected|static|final|\s)*\w[\w<>\[\]]*\s+(\w+)\s*\(/gm,    'method'],
      [/^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/gm,                                    'class'],
      [/^(?:public\s+)?(?:abstract\s+)?class\s+(\w+)/gm,                                    'class'],
    ];

    for (const [regex, type] of patterns) {
      let m: RegExpExecArray | null;
      while ((m = regex.exec(code)) !== null) {
        const name = m[1];
        if (!name || name.length < 2) continue;
        push(name, type, code.slice(0, m.index).split('\n').length - 1, m[0].trim());
      }
    }
  }
}

// ── Name resolution helpers ───────────────────────────────────────────────────

function resolveClassName(node: any, type: string): string | null {
  // Most languages: 'name' field or first identifier child
  return (
    getFieldText(node, ['name', 'type_identifier', 'identifier']) ??
    // Rust impl blocks: find the type being implemented
    (type === 'impl_item' ? getFieldText(node, ['type']) : null)
  );
}

function resolveMethodName(node: any, type: string): string | null {
  return getFieldText(node, ['name', 'identifier']);
}

function resolveFunctionName(node: any, type: string): string | null {
  // Arrow functions / function expressions assigned to variable:
  // the variable name is in the parent, which we don't have here.
  // We skip truly anonymous functions.
  return getFieldText(node, ['name', 'identifier']);
}

function getFieldText(node: any, fields: string[]): string | null {
  for (const f of fields) {
    const child = node.childForFieldName?.(f);
    if (child?.text) return child.text;
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

function extractHeritage(classNode: any, classId: string, relPath: string, edges: CodeEdge[]): void {
  for (const child of (classNode.children ?? [])) {
    const t = child.type;
    if (['superclass','extends_clause','base_class_clause','class_heritage'].includes(t)) {
      collectTypeNames(child).forEach(name =>
        edges.push({ sourceId: classId, targetId: `${relPath}:${name}`, relationType: 'EXTENDS' })
      );
    } else if (['class_implements','implements_clause','super_interfaces'].includes(t)) {
      collectTypeNames(child).forEach(name =>
        edges.push({ sourceId: classId, targetId: `${relPath}:${name}`, relationType: 'IMPLEMENTS' })
      );
    }
  }
}

function collectTypeNames(node: any): string[] {
  const names: string[] = [];
  const visit = (n: any) => {
    if (n.type === 'type_identifier' || n.type === 'identifier') names.push(n.text);
    else (n.children ?? []).forEach((c: any) => visit(c));
  };
  visit(node);
  return names;
}

// ── Modifier extraction ───────────────────────────────────────────────────────

function extractModifiers(node: any): string[] {
  const mods = new Set<string>();
  for (const child of (node.children ?? [])) {
    if (MODIFIER_KEYWORDS.has(child.type) || MODIFIER_KEYWORDS.has(child.text ?? '')) {
      mods.add(child.text ?? child.type);
    }
    if (child.type === 'modifiers') { // Java
      for (const mod of (child.children ?? [])) {
        if (MODIFIER_KEYWORDS.has(mod.text ?? '')) mods.add(mod.text);
      }
    }
  }
  return [...mods];
}

// ── Signature extraction ──────────────────────────────────────────────────────

function extractSignature(node: any, code: string): string {
  const body = node.childForFieldName?.('body');
  if (body) return code.slice(node.startIndex, body.startIndex).replace(/\s+/g, ' ').trim().slice(0, 300);
  return (node.text?.split('\n')[0] ?? '').trim().slice(0, 300);
}

function buildClassSignature(node: any, name: string): string {
  const first = node.text?.split('\n')[0] ?? `class ${name}`;
  return first.trim().slice(0, 200);
}

// ── Docstring extraction ──────────────────────────────────────────────────────

function extractDocstring(node: any, lines: string[]): string {
  const startLine = node.startPosition?.row ?? 0;
  if (startLine === 0) return '';

  const prevLine = lines[startLine - 1]?.trim() ?? '';

  if (prevLine.startsWith('//') || prevLine.startsWith('#')) {
    return prevLine.replace(/^[/#\s*]+/, '').trim();
  }

  if (prevLine === '*/') {
    const commentLines: string[] = [];
    for (let i = startLine - 2; i >= Math.max(0, startLine - 40); i--) {
      const l = lines[i].trim();
      if (l.startsWith('/**') || l.startsWith('/*')) break;
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

function extractPackageName(code: string, langName: string): string | null {
  const matchers: Record<string, RegExp> = {
    java:       /^\s*package\s+([\w.]+)\s*;/m,
    go:         /^\s*package\s+(\w+)/m,
    rust:       /^\s*(?:pub\s+)?mod\s+(\w+)/m,
    typescript: /^\s*(?:export\s+)?(?:namespace|module)\s+(\w+)/m,
  };
  const m = code.match(matchers[langName] ?? /(?!)/);
  return m?.[1] ?? null;
}

// ── Utilities ────────────────────────────────────────────────────────────────

function hashText(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}