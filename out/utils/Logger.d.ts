import * as vscode from 'vscode';
export declare class Logger {
    private static channel;
    static init(context: vscode.ExtensionContext): void;
    static info(msg: string): void;
    static warn(msg: string): void;
    static error(msg: string, err?: unknown): void;
}
