/**
 * CommitDiffEngine — compares graph state before/after staged changes
 * and generates a structured commit message via the user's LLM.
 */
import { GraphStore } from '../graph/GraphStore';
export declare class CommitDiffEngine {
    private readonly workspaceRoot;
    private readonly store;
    constructor(workspaceRoot: string, store: GraphStore);
    generateCommitMessage(): Promise<string | null>;
    private getStagedFiles;
    private buildGraphDiff;
    private buildCommitPrompt;
}
