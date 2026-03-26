/**
 * CommitDiffEngine — compares graph state before/after staged changes
 * and generates a structured commit message via the user's LLM.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { GraphStore, CodeNode } from '../graph/GraphStore';
import { LLMClient } from '../mcp/LLMClient';
import { Logger } from '../../utils/Logger';

interface GraphDiff {
  added: CodeNode[];
  removed: CodeNode[];
  signatureChanged: CodeNode[];
  docstringChanged: CodeNode[];
  callsAdded: string[];    // "caller → callee"
  callsRemoved: string[];
}

export class CommitDiffEngine {
  private readonly workspaceRoot: string;
  private readonly store: GraphStore;

  constructor(workspaceRoot: string, store: GraphStore) {
    this.workspaceRoot = workspaceRoot;
    this.store = store;
  }

  async generateCommitMessage(): Promise<string | null> {
    const config = vscode.workspace.getConfiguration('semanticKG');
    const provider: string = config.get('llmProvider', 'anthropic');
    const apiKey: string = config.get('llmApiKey', '');
    const model: string = config.get('llmModel', 'claude-sonnet-4-20250514');

    if (!apiKey && provider !== 'ollama') {
      vscode.window.showWarningMessage(
        'Configure semanticKG.llmApiKey to use commit message generation.'
      );
      return null;
    }

    // Get staged file paths via VS Code git extension
    const stagedFiles = await this.getStagedFiles();
    if (stagedFiles.length === 0) {
      vscode.window.showInformationMessage('No staged files found. Stage your changes first.');
      return null;
    }

    Logger.info(`Building graph diff for ${stagedFiles.length} staged files...`);
    const diff = await this.buildGraphDiff(stagedFiles);

    const prompt = this.buildCommitPrompt(diff, stagedFiles);
    const client = new LLMClient(provider, apiKey, model);

    const message = await client.complete(prompt, 300);
    return message.trim();
  }

  private async getStagedFiles(): Promise<string[]> {
    try {
      const gitExt = vscode.extensions.getExtension('vscode.git');
      if (!gitExt) return [];

      const git = gitExt.exports.getAPI(1);
      const repo = git.repositories[0];
      if (!repo) return [];

      const staged = repo.state.indexChanges as Array<{ uri: vscode.Uri }>;
      return staged.map(c => c.uri.fsPath);
    } catch (err) {
      Logger.warn(`Could not get staged files: ${err}`);
      return [];
    }
  }

  private async buildGraphDiff(stagedFiles: string[]): Promise<GraphDiff> {
    const diff: GraphDiff = {
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
        } else if (node.signature.includes('// DELETED')) {
          diff.removed.push(node);
        }
      }
    }

    return diff;
  }

  private buildCommitPrompt(diff: GraphDiff, files: string[]): string {
    const fileList = files.map(f => path.relative(this.workspaceRoot, f)).join(', ');

    const changes: string[] = [];
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

    return (
      `You are an expert developer writing git commit messages.\n` +
      `Generate a concise, conventional commit message (format: type(scope): description).\n` +
      `Reply with ONLY the commit message — no explanation.\n\n` +
      `Changed files: ${fileList}\n\n` +
      `Structural changes:\n${changes.map(c => `- ${c}`).join('\n')}`
    );
  }
}
