import * as vscode from 'vscode';

type Status = 'idle' | 'indexing' | 'embedding' | 'thinking';

export class IndexingStatusBar implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.command = 'semanticKG.openContextInspector';
    this.setStatus('idle');
    this.item.show();
  }

  setStatus(status: Status): void {
    const labels: Record<Status, string> = {
      idle:      '$(graph) KG',
      indexing:  '$(loading~spin) KG: Indexing…',
      embedding: '$(loading~spin) KG: Embedding…',
      thinking:  '$(loading~spin) KG: Thinking…',
    };
    const tooltips: Record<Status, string> = {
      idle:      'Knowledge Graph — idle. Click to open inspector.',
      indexing:  'Knowledge Graph — indexing workspace…',
      embedding: 'Knowledge Graph — generating embeddings…',
      thinking:  'Knowledge Graph — generating commit message…',
    };
    this.item.text = labels[status];
    this.item.tooltip = tooltips[status];
  }

  dispose(): void {
    this.item.dispose();
  }
}
