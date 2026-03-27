"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatUIServer = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const Logger_1 = require("../utils/Logger");
class ChatUIServer {
    constructor(chatAgent, port) {
        this.chatAgent = chatAgent;
        this.port = port;
        this.server = null;
        this.app = (0, express_1.default)();
        this.app.use((0, cors_1.default)());
        this.app.use(express_1.default.json());
        this.setupRoutes();
    }
    setupRoutes() {
        this.app.post('/api/chat', async (req, res) => {
            try {
                const { query } = req.body;
                if (!query)
                    return res.status(400).json({ error: 'Query is required' });
                const response = await this.chatAgent.askQuery(query);
                res.json(response);
            }
            catch (err) {
                Logger_1.Logger.error(`Chat API error: ${err}`);
                res.status(500).json({ error: 'Internal server error' });
            }
        });
        this.app.get('/', (req, res) => {
            res.send(this.getHtml());
        });
    }
    start() {
        this.server = this.app.listen(this.port, () => {
            Logger_1.Logger.info(`Chat UI Server listening on port ${this.port}`);
        });
    }
    stop() {
        this.server?.close();
    }
    getHtml() {
        return `
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Semantic KG | Nexus</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
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
              background: '#0a0a0f',
              surface: '#12121a',
              surfaceHover: '#1a1a24',
              borderPrimary: '#262636',
              brand: { 400: '#818cf8', 500: '#6366f1', 600: '#4f46e5' },
              accent: { 400: '#34d399', 500: '#10b981' }
            },
            animation: {
              'blob': 'blob 7s infinite',
              'fade-in-up': 'fadeInUp 0.4s ease-out forwards',
              'pulse-fast': 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
            keyframes: {
              blob: {
                '0%': { transform: 'translate(0px, 0px) scale(1)' },
                '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
                '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
                '100%': { transform: 'translate(0px, 0px) scale(1)' },
              },
              fadeInUp: {
                '0%': { opacity: '0', transform: 'translateY(10px)' },
                '100%': { opacity: '1', transform: 'translateY(0)' },
              }
            }
          }
        }
      }
    </script>
    <style>
      body { background-color: #0a0a0f; color: #e2e8f0; }
      
      /* Markdown Typographic Polish */
      .markdown-body p { margin-bottom: 1rem; line-height: 1.6; color: #cbd5e1; }
      .markdown-body strong { color: #f8fafc; font-weight: 600; }
      .markdown-body pre { background: #050508; border: 1px solid #262636; padding: 1rem; border-radius: 0.75rem; overflow-x: auto; margin: 1rem 0; box-shadow: inset 0 2px 4px rgba(0,0,0,0.5); }
      .markdown-body code { font-family: 'JetBrains Mono', monospace; font-size: 0.85em; color: #818cf8; background: #1a1a24; padding: 0.15rem 0.3rem; border-radius: 0.25rem; }
      .markdown-body pre code { background: transparent; padding: 0; color: #e2e8f0; }
      .markdown-body h1, .markdown-body h2, .markdown-body h3 { color: #f8fafc; font-weight: 600; margin-top: 1.5rem; margin-bottom: 0.75rem; }
      .markdown-body ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 1rem; color: #cbd5e1; }
      .markdown-body li { margin-bottom: 0.25rem; }

      /* Custom Scrollbar */
      ::-webkit-scrollbar { width: 6px; height: 6px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: #262636; border-radius: 3px; }
      ::-webkit-scrollbar-thumb:hover { background: #3f3f5a; }

      /* Glassmorphism utilities */
      .glass { background: rgba(18, 18, 26, 0.7); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.05); }
      .glass-panel { background: linear-gradient(145deg, rgba(30, 30, 40, 0.6) 0%, rgba(20, 20, 30, 0.4) 100%); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3); }

      /* Terminal text effect */
      .typing-line { border-right: 2px solid #818cf8; white-space: nowrap; overflow: hidden; animation: typing 2s steps(40, end), blink-caret .75s step-end infinite; }
      @keyframes typing { from { width: 0 } to { width: 100% } }
      @keyframes blink-caret { from, to { border-color: transparent } 50% { border-color: #818cf8; } }
    </style>
</head>
<body class="h-screen flex overflow-hidden selection:bg-brand-500/30">

    <div class="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div class="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-brand-600/10 blur-[100px] animate-blob"></div>
        <div class="absolute top-[20%] right-[-10%] w-[30%] h-[30%] rounded-full bg-purple-600/10 blur-[100px] animate-blob" style="animation-delay: 2s"></div>
        <div class="absolute bottom-[-20%] left-[20%] w-[40%] h-[40%] rounded-full bg-accent-500/5 blur-[100px] animate-blob" style="animation-delay: 4s"></div>
        <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDIiLz4KPC9zdmc+')] opacity-20 z-0"></div>
    </div>

    <div class="w-64 glass border-r border-borderPrimary flex flex-col z-10 hidden md:flex">
        <div class="p-5 border-b border-borderPrimary flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/20">
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            </div>
            <h1 class="font-bold text-sm tracking-wide text-white">NEXUS<span class="text-brand-400">GRAPH</span></h1>
        </div>
        <div class="flex-1 overflow-y-auto p-4 space-y-6">
            <div>
                <h2 class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Context Engine</h2>
                <div class="space-y-2">
                    <div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-surfaceHover border border-borderPrimary cursor-pointer hover:border-brand-500/50 transition-colors">
                        <div class="w-2 h-2 rounded-full bg-accent-500 animate-pulse"></div>
                        <span class="text-xs font-medium text-gray-300">Local Vector DB</span>
                    </div>
                    <div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-surfaceHover border border-borderPrimary cursor-pointer hover:border-brand-500/50 transition-colors">
                        <div class="w-2 h-2 rounded-full bg-brand-500 animate-pulse" style="animation-delay: 1s"></div>
                        <span class="text-xs font-medium text-gray-300">Semantic Index</span>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="flex-1 flex flex-col relative z-10">
        
        <header class="h-16 glass border-b border-borderPrimary flex items-center justify-between px-6">
            <h2 class="font-medium text-sm text-gray-300 flex items-center gap-2">
                <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
                Workspace Chat Session
            </h2>
            <div class="px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-[10px] font-mono flex items-center gap-1.5">
                <span class="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse"></span> SYSTEM READY
            </div>
        </header>

        <div id="chat-container" class="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8 pb-40 scroll-smooth">
            <div class="flex gap-4 max-w-4xl mx-auto animate-fade-in-up">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-surfaceHover to-surface border border-borderPrimary flex items-center justify-center shrink-0 shadow-lg relative overflow-hidden group">
                    <div class="absolute inset-0 bg-brand-500/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                    <svg class="w-5 h-5 text-brand-400 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5"></path></svg>
                </div>
                <div class="flex-1 mt-1">
                    <div class="glass-panel rounded-2xl rounded-tl-sm p-6 relative overflow-hidden">
                        <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-500 to-purple-500"></div>
                        <h3 class="text-white font-medium mb-2 flex items-center gap-2">
                            Knowledge Graph Connected
                        </h3>
                        <p class="text-gray-400 text-sm leading-relaxed">I am an AI agent connected directly to your codebase graph. When you ask a question, I will translate it into vector embeddings, search the semantic graph, and formulate an answer strictly based on the retrieved nodes.</p>
                    </div>
                </div>
            </div>
        </div>

        <div class="absolute bottom-0 w-full bg-gradient-to-t from-background via-background/95 to-transparent pt-12 pb-6 px-4 sm:px-6">
            <div class="max-w-4xl mx-auto relative group">
                <div class="absolute -inset-0.5 bg-gradient-to-r from-brand-500 to-purple-600 rounded-2xl blur opacity-20 group-focus-within:opacity-50 transition duration-500"></div>
                <div class="relative glass rounded-xl flex items-end p-2 transition-all">
                    <textarea id="query-input" rows="1" placeholder="Query the knowledge graph..." class="w-full bg-transparent border-none focus:ring-0 text-gray-200 resize-none py-3.5 px-4 max-h-40 leading-relaxed placeholder-gray-600 font-sans"></textarea>
                    <button id="send-btn" class="p-3.5 mb-1 mr-1 bg-white/5 hover:bg-brand-500 hover:text-white text-gray-400 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed border border-white/5 hover:border-brand-400 hover:shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                        <svg class="w-5 h-5 translate-x-[1px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
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
            div.className = 'flex gap-4 max-w-4xl mx-auto flex-row-reverse animate-fade-in-up';
            div.innerHTML = \`
                <div class="w-10 h-10 rounded-xl bg-surface border border-borderPrimary flex items-center justify-center shrink-0">
                    <span class="text-sm font-bold text-gray-400">U</span>
                </div>
                <div class="flex-1 flex justify-end mt-1">
                    <div class="bg-surfaceHover border border-borderPrimary text-gray-200 rounded-2xl rounded-tr-sm p-5 shadow-sm inline-block max-w-[85%] text-sm leading-relaxed">
                        \${text}
                    </div>
                </div>
            \`;
            chatContainer.appendChild(div);
            scrollToBottom();
        }

        function createAiMessageContainer() {
            const div = document.createElement('div');
            div.className = 'flex gap-4 max-w-4xl mx-auto animate-fade-in-up';
            div.innerHTML = \`
                <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center shrink-0 shadow-lg shadow-brand-500/30 relative">
                    <svg class="w-5 h-5 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
                </div>
                <div class="flex-1 w-full overflow-hidden mt-1">
                    <div class="glass-panel rounded-2xl rounded-tl-sm p-6 w-full flex flex-col gap-4 relative overflow-hidden">
                        
                        <div class="terminal-area bg-[#050508] border border-borderPrimary rounded-lg p-3 font-mono text-[11px] text-gray-400 w-full overflow-hidden relative">
                            <div class="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-brand-500/50 to-transparent"></div>
                            <div class="flex items-center gap-2 mb-2 text-brand-400">
                                <span class="w-2 h-2 rounded-full bg-brand-400 animate-pulse"></span>
                                <span class="font-bold tracking-widest uppercase text-[9px]">Graph Inspector Active</span>
                            </div>
                            <div class="terminal-logs space-y-1">
                                <div class="opacity-50">> Initializing semantic embedding sequence...</div>
                            </div>
                        </div>

                        <div class="context-area hidden flex flex-col gap-2 p-3 bg-brand-500/5 border border-brand-500/10 rounded-lg">
                            <div class="flex items-center gap-2">
                                <svg class="w-4 h-4 text-accent-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                                <span class="text-xs font-semibold text-accent-400 uppercase tracking-wider">Graph Context Acquired</span>
                            </div>
                            <div class="badges-container flex flex-wrap gap-2 mt-1"></div>
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
                contextArea: div.querySelector('.context-area'),
                badgesContainer: div.querySelector('.badges-container'),
                contentArea: div.querySelector('.content-area'),
                icon: div.querySelector('svg')
            };
        }

        // Simulates complex backend operations in the UI terminal
        async function simulateTerminal(logsContainer, query) {
            const steps = [
                \`> curl -X POST /api/embeddings -d '{"text": "\${query.substring(0, 15)}..."}'\`,
                \`> [HTTP 200] Generated vector array Float32Array(384)\`,
                \`> Executing Vector Search (Cosine Similarity)...\`,
                \`> MATCH (n:CodeNode) WHERE similarity(n.vec, query_vec) > 0.75 RETURN n LIMIT 5\`,
                \`> Resolving AST structural edges (CALLS, IMPORTS)...\`
            ];

            for (let step of steps) {
                await new Promise(r => setTimeout(r, 400 + Math.random() * 300));
                const div = document.createElement('div');
                div.className = 'text-gray-300';
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

            // Start fake terminal logs in parallel with the real request
            const terminalPromise = simulateTerminal(ui.terminalLogs, text);

            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: text })
                });
                
                const data = await response.json();
                
                // Wait for the terminal simulation to finish so it looks cool
                await terminalPromise;
                
                // Finish Terminal
                const finalLog = document.createElement('div');
                finalLog.className = 'text-brand-400 font-bold mt-2';
                finalLog.innerText = \`> SUCCESS: Found \${data.contextUsed?.length || 0} relevant nodes. Routing to LLM...\`;
                ui.terminalLogs.appendChild(finalLog);

                await new Promise(r => setTimeout(r, 500)); // Brief pause before showing answer
                
                // Minimize terminal slightly to save space
                ui.terminalArea.classList.add('opacity-70');

                // Stop pulse icon
                ui.icon.classList.remove('animate-pulse');
                ui.icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>';

                // Render Proof of Work (Context Badges)
                if (data.contextUsed && data.contextUsed.length > 0) {
                    ui.contextArea.classList.remove('hidden');
                    ui.contextArea.classList.add('animate-fade-in-up');
                    
                    ui.badgesContainer.innerHTML = data.contextUsed.map(node => 
                        \`<span class="inline-flex items-center px-2 py-1 rounded text-[10px] font-mono font-medium bg-[#1a1a24] border border-borderPrimary shadow-sm">
                            <span class="text-purple-400 mr-1.5 font-bold">\${node.type}</span> 
                            <span class="text-gray-300">\${node.name}</span>
                        </span>\`
                    ).join('');
                } else {
                    // Fallback badge if no graph context was found
                    ui.contextArea.classList.remove('hidden');
                    ui.contextArea.classList.add('animate-fade-in-up');
                    ui.contextArea.innerHTML = \`
                        <div class="flex items-center gap-2">
                            <svg class="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                            <span class="text-xs font-semibold text-orange-400 uppercase tracking-wider">Pre-Indexed Documentation / Baseline Knowledge</span>
                        </div>
                        <p class="text-[11px] text-gray-500 mt-1">No specific graph nodes matched the vector search.</p>
                    \`;
                }

                // Render Answer
                ui.contentArea.classList.remove('hidden');
                ui.contentArea.classList.add('animate-fade-in-up');
                ui.contentArea.innerHTML = marked.parse(data.answer);

            } catch (err) {
                ui.icon.classList.remove('animate-pulse');
                ui.contentArea.classList.remove('hidden');
                ui.contentArea.innerHTML = \`<p class="text-red-400 font-medium">Error: \${err.message}</p>\`;
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
exports.ChatUIServer = ChatUIServer;
//# sourceMappingURL=ChatUIServer.js.map