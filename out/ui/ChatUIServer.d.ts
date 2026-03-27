import { CodeChatAgent } from '../core/chat/CodeChatAgent';
export declare class ChatUIServer {
    private readonly chatAgent;
    private readonly port;
    private app;
    private server;
    constructor(chatAgent: CodeChatAgent, port: number);
    private setupRoutes;
    start(): void;
    stop(): void;
    private getHtml;
}
