/**
 * FileParser — uses web-tree-sitter (WASM) to extract symbols from source files.
 *
 * Supported languages: TypeScript, JavaScript, Python, Java, Go, Rust, C/C++
 */
import { CodeNode } from '../graph/GraphStore';
export declare class FileParser {
    private readonly workspaceRoot;
    private readonly extensionRoot;
    private Parser;
    private languages;
    private initialized;
    constructor(workspaceRoot: string, extensionRoot: string);
    private ensureInitialized;
    parseWorkspace(): Promise<CodeNode[]>;
    parseFile(filePath: string): Promise<CodeNode[]>;
    private loadLanguage;
    private extractSymbols;
    /**
     * Simple regex fallback for when Tree-sitter grammar files aren't bundled yet.
     */
    private regexFallbackExtract;
}
