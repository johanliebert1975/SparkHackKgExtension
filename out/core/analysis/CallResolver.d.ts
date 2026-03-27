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
import { GraphStore, CodeEdge } from '../graph/GraphStore';
export declare class CallResolver {
    private readonly extensionRoot;
    private readonly workspaceRoot;
    private ParserClass;
    private Language;
    private languages;
    private initialized;
    constructor(workspaceRoot: string, extensionRoot: string);
    private ensureInitialized;
    /**
     * Run over the entire workspace, producing CALL edges.
     * Returns only NEW edges not already in the store.
     */
    resolveWorkspace(store: GraphStore): Promise<CodeEdge[]>;
    private buildSymbolTable;
    /**
     * Build a per-file import map.
     * import { Foo } from './foo'  →  'Foo' → 'path/to/foo.ts'
     * import * as Bar from './bar' →  'Bar' → 'path/to/bar.ts'
     */
    private buildImportMaps;
    private resolveFile;
    private loadLanguage;
    private walkForCalls;
    private isSymbolNode;
    /**
     * Resolve a called name to a node ID using 3-tier strategy:
     * 1. Same file (local symbols)
     * 2. Imported file (import map)
     * 3. Global symbol table (any file, pick best match)
     */
    private resolveCallee;
    private regexCallFallback;
    /**
     * Sweeps through all EXTENDS/IMPLEMENTS edges and resolves cross-file targets
     * by matching the unresolved interface/class name against the global symbol table.
     */
    resolveHeritage(store: GraphStore): Promise<void>;
}
