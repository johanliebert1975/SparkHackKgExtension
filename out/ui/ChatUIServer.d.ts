import { CodeChatAgent } from '../core/chat/CodeChatAgent';
export declare class ChatUIServer {
    private readonly chatAgent;
    private readonly port;
    private readonly workspaceRoot;
    private app;
    private server;
    constructor(chatAgent: CodeChatAgent, port: number, workspaceRoot: string);
    private setupRoutes;
    start(): void;
    stop(): void;
    private getHtml;
}
