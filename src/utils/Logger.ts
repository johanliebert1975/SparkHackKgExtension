import * as vscode from 'vscode';

export class Logger {
  private static channel: vscode.OutputChannel;

  static init(context: vscode.ExtensionContext): void {
    Logger.channel = vscode.window.createOutputChannel('Semantic Knowledge Graph');
    context.subscriptions.push(Logger.channel);
  }

  static info(msg: string): void {
    Logger.channel?.appendLine(`[INFO]  ${new Date().toISOString()} ${msg}`);
  }

  static warn(msg: string): void {
    Logger.channel?.appendLine(`[WARN]  ${new Date().toISOString()} ${msg}`);
  }

  static error(msg: string, err?: unknown): void {
    Logger.channel?.appendLine(`[ERROR] ${new Date().toISOString()} ${msg}${err ? ': ' + String(err) : ''}`);
  }
}
