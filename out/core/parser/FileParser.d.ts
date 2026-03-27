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
import { CodeNode, CodeEdge } from '../graph/GraphStore';
export interface ParseResult {
    nodes: CodeNode[];
    edges: CodeEdge[];
}
export declare class FileParser {
    private readonly workspaceRoot;
    private readonly extensionRoot;
    private ParserClass;
    private Language;
    private languages;
    private initialized;
    constructor(workspaceRoot: string, extensionRoot: string);
    private ensureInitialized;
    parseWorkspace(): Promise<ParseResult>;
    parseFile(filePath: string): Promise<ParseResult>;
    private loadLanguage;
    private walkTree;
    private regexFallback;
}
