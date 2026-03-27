import express from 'express';
import cors from 'cors';
import { Server } from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { Logger } from '../utils/Logger';
import { CodeChatAgent } from '../core/chat/CodeChatAgent';

export class ChatUIServer {
  private app: express.Application;
  private server: Server | null = null;

  constructor(
    private readonly chatAgent: CodeChatAgent,
    private readonly port: number,
    private readonly workspaceRoot: string
  ) {
    this.app = express();
    this.app.use(cors());
    this.app.use(express.json());
    this.setupRoutes();
  }

  private setupRoutes() {
    // 1. Chat Completion API
    this.app.post('/api/chat', async (req, res) => {
      try {
        const { query } = req.body;
        if (!query) return res.status(400).json({ error: 'Query is required' });
        
        const response = await this.chatAgent.askQuery(query);
        res.json(response);
      } catch (err) {
        Logger.error(`Chat API error: ${err}`);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // 2. File Tree API (For the Sidebar)
    this.app.get('/api/tree', async (req, res) => {
        try {
            const files = await glob('**/*', {
                cwd: this.workspaceRoot,
                ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/out/**', '**/.vscode/**']
            });
            res.json({ files });
        } catch(err) {
            res.status(500).json({error: String(err)});
        }
    });

    // 3. Raw File Content API (For the Code Viewer)
    this.app.get('/api/file', (req, res) => {
        try {
            const filePath = req.query.path as string;
            if (!filePath) return res.status(400).json({error: 'No path provided'});
            
            const fullPath = path.join(this.workspaceRoot, filePath);
            
            // Security: Prevent directory traversal outside workspace
            if (!fullPath.startsWith(this.workspaceRoot)) return res.status(403).json({error: 'Forbidden path'});
            
            if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
                const content = fs.readFileSync(fullPath, 'utf-8');
                res.json({ content });
            } else {
                res.status(404).json({error: 'File not found'});
            }
        } catch(err) {
            res.status(500).json({error: String(err)});
        }
    });

    this.app.get('/', (req, res) => {
      res.send(this.getHtml());
    });
  }

  public start(): void {
    this.server = this.app.listen(this.port, () => {
      Logger.info(`Chat UI Server listening on port ${this.port}`);
    });
  }

  public stop(): void {
    this.server?.close();
  }

  private getHtml(): string {
    return `
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chat Interface</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <script>
      tailwind.config = {
        darkMode: 'class',
        theme: {
          extend: {
            fontFamily: {
              sans: ['Inter', 'sans-serif'],
              mono: ['JetBrains Mono', 'monospace'],
            },
            colors: {
              background: '#000000',
              surface: '#0a0a0a',
              surfaceHover: '#111111',
              borderPrimary: '#1f1f1f',
              textMuted: '#888888',
            }
          }
        }
      }
    </script>
    <style>
      body { background-color: #000000; color: #ededed; }
      
      /* Sleek Markdown Typography */
      .markdown-body p { margin-bottom: 1rem; line-height: 1.6; color: #a1a1aa; }
      .markdown-body strong { color: #ffffff; font-weight: 500; }
      .markdown-body pre { background: #050505; border: 1px solid #1f1f1f; padding: 1rem; border-radius: 6px; overflow-x: auto; margin: 1rem 0; }
      .markdown-body code { font-family: 'JetBrains Mono', monospace; font-size: 0.85em; color: #e4e4e7; background: #111111; padding: 0.15rem 0.3rem; border-radius: 4px; border: 1px solid #1f1f1f; }
      .markdown-body pre code { background: transparent; padding: 0; border: none; }
      .markdown-body h1, .markdown-body h2, .markdown-body h3 { color: #ffffff; font-weight: 500; margin-top: 1.5rem; margin-bottom: 0.75rem; }
      .markdown-body ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 1rem; color: #a1a1aa; }
      .markdown-body li { margin-bottom: 0.25rem; }
      .markdown-body a { color: #60a5fa; text-decoration: none; }
      .markdown-body a:hover { text-decoration: underline; }

      /* Custom Scrollbar */
      ::-webkit-scrollbar { width: 5px; height: 5px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: #1f1f1f; border-radius: 10px; }
      ::-webkit-scrollbar-thumb:hover { background: #333333; }

      textarea:focus { outline: none; }
      
      /* Animation for the memory bar */
      @keyframes fillBar {
        0% { width: 10%; }
        50% { width: 80%; }
        100% { width: 45%; }
      }
      .animate-memory { animation: fillBar 4s ease-in-out infinite alternate; }
    </style>
</head>
<body class="h-screen flex overflow-hidden selection:bg-gray-800">

    <div class="w-64 bg-background border-r border-borderPrimary flex flex-col z-10 hidden md:flex">
        <div class="p-5 border-b border-borderPrimary">
            <h1 class="font-medium text-sm tracking-wide text-gray-200">Chat Interface</h1>
        </div>
        <div class="flex-1 overflow-y-auto p-4 space-y-6">
            
            <div>
                <h2 class="text-[10px] font-medium text-textMuted uppercase tracking-widest mb-3">System Status</h2>
                <div class="bg-surface border border-borderPrimary rounded-md p-3">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-xs text-textMuted">Graph Engine</span>
                        <div class="flex items-center gap-1.5">
                            <div class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                            <span class="text-[10px] font-mono text-green-500">ONLINE</span>
                        </div>
                    </div>
                    <div class="mt-3 pt-3 border-t border-borderPrimary">
                        <div class="w-full bg-[#111] rounded-full h-1 overflow-hidden">
                            <div class="bg-gray-300 h-1 rounded-full animate-memory" style="width: 45%"></div>
                        </div>
                        <div class="flex justify-between items-center mt-1.5">
                            <span class="text-[9px] text-textMuted font-mono">MEM ALLOC</span>
                            <span class="text-[9px] text-gray-400 font-mono">45%</span>
                        </div>
                    </div>
                </div>
            </div>

            <div>
                <h2 class="text-[10px] font-medium text-textMuted uppercase tracking-widest mb-3">Sessions</h2>
                <div class="space-y-1">
                    <button class="w-full text-left px-3 py-2 rounded border border-borderPrimary bg-surface text-gray-300 text-xs font-medium">
                        Current Workspace
                    </button>
                </div>
            </div>

        </div>
    </div>

    <div class="flex-1 flex flex-col relative bg-background">
        
        <header class="h-14 border-b border-borderPrimary flex items-center px-6">
            <h2 class="font-medium text-sm text-gray-300">Codebase Explorer</h2>
        </header>

        <div id="chat-container" class="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8 pb-40 scroll-smooth">
            <div class="flex gap-4 max-w-3xl mx-auto">
                <div class="w-8 h-8 rounded bg-surface border border-borderPrimary flex items-center justify-center shrink-0">
                    <svg class="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5"></path></svg>
                </div>
                <div class="flex-1 mt-1">
                    <h3 class="text-gray-200 font-medium text-sm mb-1">Knowledge Graph Connected</h3>
                    <p class="text-textMuted text-sm leading-relaxed">I am connected directly to your codebase graph. I will read nodes and fetch raw file contents to answer your questions accurately.</p>
                </div>
            </div>
        </div>

        <div class="absolute bottom-0 w-full bg-gradient-to-t from-background via-background to-transparent pt-12 pb-6 px-4 sm:px-6">
            <div class="max-w-3xl mx-auto">
                <div class="bg-surface border border-borderPrimary rounded-xl flex items-end p-1.5 focus-within:border-gray-500 transition-colors shadow-2xl">
                    <textarea id="query-input" rows="1" placeholder="Ask about functions, architecture, or files..." class="w-full bg-transparent border-none focus:ring-0 text-gray-200 resize-none py-3 px-3 max-h-40 text-sm placeholder-textMuted font-sans"></textarea>
                    <button id="send-btn" class="p-2 mb-1 mr-1 bg-[#1a1a1a] hover:bg-[#2a2a2a] text-gray-300 border border-borderPrimary rounded-md transition-colors disabled:opacity-50">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M12 5l7 7-7 7"></path></svg>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <script>
        const chatContainer = document.getElementById('chat-container');
        const input = document.getElementById('query-input');
        const sendBtn = document.getElementById('send-btn');

        input.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
            if(this.value.trim() === '') this.style.height = 'auto';
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        });

        sendBtn.addEventListener('click', handleSend);

        function scrollToBottom() {
            chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
        }

        function addUserMessage(text) {
            const div = document.createElement('div');
            div.className = 'flex gap-4 max-w-3xl mx-auto flex-row-reverse';
            div.innerHTML = \`
                <div class="w-8 h-8 rounded bg-[#1a1a1a] border border-borderPrimary flex items-center justify-center shrink-0">
                    <span class="text-xs font-medium text-gray-400">U</span>
                </div>
                <div class="flex-1 flex justify-end mt-1">
                    <div class="text-gray-200 text-sm leading-relaxed max-w-[90%]">
                        \${text}
                    </div>
                </div>
            \`;
            chatContainer.appendChild(div);
            scrollToBottom();
        }

        function createAiMessageContainer() {
            const div = document.createElement('div');
            div.className = 'flex gap-4 max-w-3xl mx-auto';
            div.innerHTML = \`
                <div class="w-8 h-8 rounded bg-surface border border-borderPrimary flex items-center justify-center shrink-0">
                    <svg class="w-4 h-4 text-gray-300 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
                </div>
                <div class="flex-1 w-full overflow-hidden mt-1">
                    <div class="w-full flex flex-col gap-3">
                        
                        <div class="terminal-area bg-[#050505] border border-borderPrimary rounded p-3 font-mono text-[10px] text-gray-500 w-full">
                            <div class="terminal-logs space-y-1"></div>
                        </div>

                        <div class="context-area hidden flex flex-col gap-2">
                            <div class="badges-container flex flex-wrap gap-1.5 mt-1"></div>
                        </div>

                        <div class="content-area markdown-body text-sm hidden mt-2"></div>
                    </div>
                </div>
            \`;
            chatContainer.appendChild(div);
            scrollToBottom();
            return {
                terminalArea: div.querySelector('.terminal-area'),
                terminalLogs: div.querySelector('.terminal-logs'),
                contextArea: div.querySelector('.context-area'),
                badgesContainer: div.querySelector('.badges-container'),
                contentArea: div.querySelector('.content-area'),
                icon: div.querySelector('svg')
            };
        }

        async function simulateTerminal(logsContainer, query) {
            const steps = [
                \`> generating semantic embeddings...\`,
                \`> query graph store (limit: 15)...\`,
                \`> evaluating raw file paths...\`,
                \`> reading file streams...\`
            ];

            for (let step of steps) {
                await new Promise(r => setTimeout(r, 300 + Math.random() * 200));
                const div = document.createElement('div');
                div.className = 'text-gray-500';
                div.innerText = step;
                logsContainer.appendChild(div);
                scrollToBottom();
            }
        }

        async function handleSend() {
            const text = input.value.trim();
            if (!text) return;

            input.value = '';
            input.style.height = 'auto';
            sendBtn.disabled = true;

            addUserMessage(text);
            const ui = createAiMessageContainer();
            const terminalPromise = simulateTerminal(ui.terminalLogs, text);

            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: text })
                });
                
                const data = await response.json();
                await terminalPromise;
                
                const finalLog = document.createElement('div');
                finalLog.className = 'text-gray-400 mt-1';
                finalLog.innerText = \`> context acquired (\${data.contextUsed?.length || 0} nodes).\`;
                ui.terminalLogs.appendChild(finalLog);

                await new Promise(r => setTimeout(r, 300));
                ui.terminalArea.classList.add('hidden'); // Hide terminal when done for cleaner look

                ui.icon.classList.remove('animate-pulse');
                ui.icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5"></path>';

                if (data.contextUsed && data.contextUsed.length > 0) {
                    ui.contextArea.classList.remove('hidden');
                    ui.badgesContainer.innerHTML = data.contextUsed.slice(0,5).map(node => 
                        \`<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono border border-borderPrimary bg-surface text-gray-400">
                            \${node.name}
                        </span>\`
                    ).join('') + (data.contextUsed.length > 5 ? \`<span class="text-[10px] text-gray-500 ml-1">+\${data.contextUsed.length - 5} more</span>\` : '');
                }

                ui.contentArea.classList.remove('hidden');
                ui.contentArea.innerHTML = marked.parse(data.answer);

            } catch (err) {
                ui.icon.classList.remove('animate-pulse');
                ui.contentArea.classList.remove('hidden');
                ui.contentArea.innerHTML = \`<p class="text-red-400 text-sm">Error: \${err.message}</p>\`;
            } finally {
                sendBtn.disabled = false;
                scrollToBottom();
            }
        }
    </script>
</body>
</html>
    `;
  }
}