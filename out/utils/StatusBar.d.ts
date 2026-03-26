import * as vscode from 'vscode';
type Status = 'idle' | 'indexing' | 'embedding' | 'thinking';
export declare class IndexingStatusBar implements vscode.Disposable {
    private readonly item;
    constructor();
    setStatus(status: Status): void;
    dispose(): void;
}
export {};
