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
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">

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

        /* --- Color Shifting Animation --- */
        @keyframes blob-color-shift {
            0%, 100% { 
                background-color: #6366f1; 
                box-shadow: 0 0 40px rgba(99, 102, 241, 0.4); 
            }
            50% { 
                background-color: #a855f7; 
                box-shadow: 0 0 60px rgba(168, 85, 247, 0.5); 
            }
        }

        @keyframes blob-morph {
            0% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
            50% { border-radius: 30% 60% 70% 60% / 50% 60% 50% 60%; }
            100% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
        }
        @keyframes blob-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        @keyframes glow-pulse {
            0%, 100% { opacity: 0.4; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.15); }
        }

        .status-blob {
            width: 180px;
            height: 180px;
            filter: blur(1px);
            animation: 
                blob-morph 8s ease-in-out infinite, 
                blob-spin 15s linear infinite,
                blob-color-shift 12s ease-in-out infinite;
        }

        /*.blob-glow {
            position: absolute;
            inset: -20px;
            background: radial-gradient(circle, currentColor 0%, transparent 70%);
            animation: glow-pulse 4s ease-in-out infinite, blob-color-shift 12s ease-in-out infinite;
            filter: blur(25px);
        }*/

        .markdown-body p { margin-bottom: 1rem; line-height: 1.6; color: #a1a1aa; }
        .markdown-body code { font-family: 'JetBrains Mono', monospace; background: #111111; padding: 0.2rem 0.4rem; border-radius: 4px; }
        .markdown-body pre { background: #050505; border: 1px solid #1f1f1f; padding: 1rem; border-radius: 6px; overflow-x: auto; margin: 1rem 0; }
        
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: #1f1f1f; border-radius: 10px; }
    </style>
</head>

<body class="h-screen flex overflow-hidden selection:bg-gray-800 dark">
    
    <div class="w-64 bg-background border-r border-borderPrimary flex flex-col z-10 hidden md:flex">
        <div class="p-5 border-b border-borderPrimary">
            <h1 class="font-medium text-sm tracking-wide text-gray-200">Chat Interface</h1>
        </div>
        
        <div class="flex-1 overflow-y-auto p-4 flex flex-col items-center">
            <div class="w-full">
                <div class="flex items-center justify-between mb-3 px-1">
                    <h2 class="text-[10px] font-medium text-textMuted uppercase tracking-widest">Graph Engine</h2>
                    <div class="flex items-center gap-1.5">
                        <div class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                        <span class="text-[9px] font-mono text-green-500">LIVE</span>
                    </div>
                </div>

                <div class="bg-surface border border-borderPrimary rounded-xl p-8 flex flex-col items-center justify-center relative overflow-hidden group">
                    <div class="relative z-10">
                        <div class="blob-glow"></div>
                        <div class="status-blob"></div>
                        <div class="absolute inset-8 bg-white/10 rounded-full blur-xl"></div>
                    </div>
                    
                    <div class="mt-8 text-center relative z-10">
                        <div class="text-[10px] font-mono text-gray-400 mb-1">COGNITIVE LOAD</div>
                        <div class="text-xs text-indigo-400 font-medium tracking-tight">OPTIMAL STATUS</div>
                    </div>
                    <div class="absolute inset-0 opacity-[0.03] pointer-events-none" style="background-image: radial-gradient(#ffffff 1px, transparent 1px); background-size: 15px 15px;"></div>
                </div>
            </div>
        </div>

        <div class="p-4 border-t border-borderPrimary">
            <p class="text-[10px] text-textMuted text-center font-mono uppercase tracking-tighter">v2.4.0-semantic-alpha</p>
        </div>
    </div>

    <div class="flex-1 flex flex-col relative bg-background">
        <header class="h-14 border-b border-borderPrimary flex items-center px-6">
            <h2 class="font-medium text-sm text-gray-300">Codebase Explorer</h2>
        </header>

        <div id="chat-container" class="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8 scroll-smooth">
            <div class="flex gap-4 max-w-3xl mx-auto">
                <div class="w-8 h-8 rounded bg-surface border border-borderPrimary flex items-center justify-center shrink-0">
                    <svg class="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5"></path></svg>
                </div>
                <div class="flex-1 mt-1">
                    <h3 class="text-gray-200 font-medium text-sm mb-1">Knowledge Graph Connected</h3>
                    <p class="text-textMuted text-sm leading-relaxed">System ready for deep codebase analysis. What are we exploring today?</p>
                </div>
            </div>
        </div>

        <div class="flex-shrink-0 bg-gradient-to-t from-background via-background to-transparent pt-12 pb-6 px-4 sm:px-6 border-t border-borderPrimary">
            <div class="max-w-3xl mx-auto">
                <div class="bg-surface border border-borderPrimary rounded-xl flex items-end p-1.5 focus-within:border-gray-500 transition-colors shadow-2xl">
                    <textarea id="query-input" rows="1" placeholder="Describe a feature or ask about logic..." class="w-full bg-transparent border-none focus:ring-0 text-gray-200 resize-none py-3 px-3 max-h-40 text-sm font-sans"></textarea>
                    <button id="send-btn" class="p-2 mb-1 mr-1 bg-[#1a1a1a] hover:bg-[#2a2a2a] text-gray-300 border border-borderPrimary rounded-md transition-colors">
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
            div.className = 'flex gap-4 max-w-3xl mx-auto flex-row-reverse animate-in fade-in slide-in-from-bottom-2 duration-300';
            div.innerHTML = \`
                <div class="w-8 h-8 rounded bg-[#1a1a1a] border border-borderPrimary flex items-center justify-center shrink-0">
                    <span class="text-xs font-medium text-gray-400">U</span>
                </div>
                <div class="flex-1 flex justify-end mt-1 text-gray-200 text-sm max-w-[80%] text-right">\${text}</div>
            \`;
            chatContainer.appendChild(div);
            scrollToBottom();
        }

        function createAiMessageContainer() {
            const div = document.createElement('div');
            div.className = 'flex gap-4 max-w-3xl mx-auto animate-in fade-in duration-500';
            div.innerHTML = \`
                <div class="w-8 h-8 rounded bg-surface border border-borderPrimary flex items-center justify-center shrink-0">
                    <svg class="w-4 h-4 text-gray-300 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
                </div>
                <div class="flex-1 w-full overflow-hidden mt-1">
                    <div class="w-full flex flex-col gap-3">
                        <div class="terminal-area bg-[#050505] border border-borderPrimary rounded p-3 font-mono text-[10px] text-gray-500 w-full">
                            <div class="terminal-logs space-y-1"></div>
                        </div>
                        <div class="content-area markdown-body text-sm hidden"></div>
                    </div>
                </div>
            \`;
            chatContainer.appendChild(div);
            scrollToBottom();
            return {
                terminalArea: div.querySelector('.terminal-area'),
                terminalLogs: div.querySelector('.terminal-logs'),
                contentArea: div.querySelector('.content-area'),
                icon: div.querySelector('svg')
            };
        }

        async function handleSend() {
            const text = input.value.trim();
            if (!text) return;

            input.value = '';
            input.style.height = 'auto';
            sendBtn.disabled = true;

            addUserMessage(text);
            const ui = createAiMessageContainer();
            
            // Mock terminal steps
            const steps = ['> generating semantic embeddings...', '> query graph store...', '> reading file streams...'];
            for (let step of steps) {
                await new Promise(r => setTimeout(r, 400));
                const d = document.createElement('div');
                d.innerText = step;
                ui.terminalLogs.appendChild(d);
                scrollToBottom();
            }

            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: text })
                });
                const data = await response.json();
                
                ui.terminalArea.classList.add('hidden');
                ui.contentArea.classList.remove('hidden');
                ui.contentArea.innerHTML = marked.parse(data.answer);
                ui.icon.classList.remove('animate-pulse');
            } catch (err) {
                ui.contentArea.classList.remove('hidden');
                ui.contentArea.innerHTML = \`<p class="text-red-400">Error connecting to engine.</p>\`;
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