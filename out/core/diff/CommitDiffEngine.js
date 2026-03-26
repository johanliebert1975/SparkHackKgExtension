"use strict";
/**
 * CommitDiffEngine — compares graph state before/after staged changes
 * and generates a structured commit message via the user's LLM.
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
exports.CommitDiffEngine = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const LLMClient_1 = require("../mcp/LLMClient");
const Logger_1 = require("../../utils/Logger");
class CommitDiffEngine {
    constructor(workspaceRoot, store) {
        this.workspaceRoot = workspaceRoot;
        this.store = store;
    }
    async generateCommitMessage() {
        const config = vscode.workspace.getConfiguration('semanticKG');
        const provider = config.get('llmProvider', 'anthropic');
        const apiKey = config.get('llmApiKey', '');
        const model = config.get('llmModel', 'claude-sonnet-4-20250514');
        if (!apiKey && provider !== 'ollama') {
            vscode.window.showWarningMessage('Configure semanticKG.llmApiKey to use commit message generation.');
            return null;
        }
        // Get staged file paths via VS Code git extension
        const stagedFiles = await this.getStagedFiles();
        if (stagedFiles.length === 0) {
            vscode.window.showInformationMessage('No staged files found. Stage your changes first.');
            return null;
        }
        Logger_1.Logger.info(`Building graph diff for ${stagedFiles.length} staged files...`);
        const diff = await this.buildGraphDiff(stagedFiles);
        const prompt = this.buildCommitPrompt(diff, stagedFiles);
        const client = new LLMClient_1.LLMClient(provider, apiKey, model);
        const message = await client.complete(prompt, 300);
        return message.trim();
    }
    async getStagedFiles() {
        try {
            const gitExt = vscode.extensions.getExtension('vscode.git');
            if (!gitExt)
                return [];
            const git = gitExt.exports.getAPI(1);
            const repo = git.repositories[0];
            if (!repo)
                return [];
            const staged = repo.state.indexChanges;
            return staged.map(c => c.uri.fsPath);
        }
        catch (err) {
            Logger_1.Logger.warn(`Could not get staged files: ${err}`);
            return [];
        }
    }
    async buildGraphDiff(stagedFiles) {
        const diff = {
            added: [],
            removed: [],
            signatureChanged: [],
            docstringChanged: [],
            callsAdded: [],
            callsRemoved: [],
        };
        for (const filePath of stagedFiles) {
            const currentNodes = this.store.getNodesByFile(filePath);
            // Parse the staged (HEAD) version via git show
            // For now, compare checksums of nodes in db vs re-parsed
            // A more complete implementation would git-diff the tree
            for (const node of currentNodes) {
                if (!node.checksum) {
                    diff.added.push(node);
                }
                else if (node.signature.includes('// DELETED')) {
                    diff.removed.push(node);
                }
            }
        }
        return diff;
    }
    buildCommitPrompt(diff, files) {
        const fileList = files.map(f => path.relative(this.workspaceRoot, f)).join(', ');
        const changes = [];
        if (diff.added.length > 0) {
            changes.push(`New symbols: ${diff.added.map(n => `${n.type} ${n.name}`).join(', ')}`);
        }
        if (diff.removed.length > 0) {
            changes.push(`Removed symbols: ${diff.removed.map(n => n.name).join(', ')}`);
        }
        if (diff.signatureChanged.length > 0) {
            changes.push(`Signature changes: ${diff.signatureChanged.map(n => n.name).join(', ')}`);
        }
        if (diff.callsAdded.length > 0) {
            changes.push(`New call edges: ${diff.callsAdded.join(', ')}`);
        }
        if (diff.callsRemoved.length > 0) {
            changes.push(`Removed call edges: ${diff.callsRemoved.join(', ')}`);
        }
        if (changes.length === 0) {
            changes.push(`Modified files: ${fileList}`);
        }
        return (`You are an expert developer writing git commit messages.\n` +
            `Generate a concise, conventional commit message (format: type(scope): description).\n` +
            `Reply with ONLY the commit message — no explanation.\n\n` +
            `Changed files: ${fileList}\n\n` +
            `Structural changes:\n${changes.map(c => `- ${c}`).join('\n')}`);
    }
}
exports.CommitDiffEngine = CommitDiffEngine;
//# sourceMappingURL=CommitDiffEngine.js.map