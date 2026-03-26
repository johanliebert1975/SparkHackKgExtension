# Getting Started — Semantic Code Knowledge Graph Extension

Complete step-by-step guide to go from zero to a running extension.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | ≥ 18.x | [nodejs.org](https://nodejs.org) |
| npm | ≥ 9.x | bundled with Node |
| VS Code | ≥ 1.85 | [code.visualstudio.com](https://code.visualstudio.com) |
| Git | any | for commit message features |

---

## Step 1 — Clone / copy the project

```bash
# If you cloned a repo:
cd semantic-kg-extension

# Or if you received this as a folder, cd into it:
cd path/to/semantic-kg-extension
```

---

## Step 2 — Install dependencies

```bash
npm install
```

This pulls in:
- `better-sqlite3` — native SQLite bindings (will compile a C++ addon)
- `web-tree-sitter` — WASM AST parser
- `@xenova/transformers` — ONNX embedding model (~22 MB download on first use)
- `express` + `cors` — MCP HTTP server
- `simple-git`, `glob` — workspace utilities

> **Windows note:** If `better-sqlite3` fails to compile, install the Visual C++ Build Tools:
> ```
> npm install --global windows-build-tools
> ```
> Or install "Desktop development with C++" from the Visual Studio Installer.

---

## Step 3 — Download Tree-sitter grammar files

The parser needs `.wasm` grammar files for each language. Run:

```bash
# First install the grammar packages (one-time)
npm install --save-dev \
  tree-sitter-typescript \
  tree-sitter-javascript \
  tree-sitter-python \
  tree-sitter-java \
  tree-sitter-go \
  tree-sitter-rust \
  tree-sitter-cpp

# Then copy the WASM files into ./grammars/
node scripts/download-grammars.js
```

You should see a `grammars/` folder with `.wasm` files like:
```
grammars/
  tree-sitter-typescript.wasm
  tree-sitter-javascript.wasm
  tree-sitter-python.wasm
  ...
```

> **If a grammar is missing**, the extension gracefully falls back to a regex-based parser for that language — you'll still get function/class extraction, just without full AST accuracy.

---

## Step 4 — Compile the TypeScript

```bash
npm run compile
```

This outputs compiled JS into `./out/`. You should see no errors.

To watch for changes during development:
```bash
npm run watch
```

---

## Step 5 — Open in VS Code and launch the Extension Host

1. Open the project folder in VS Code:
   ```
   code .
   ```

2. Press **F5** (or go to **Run → Start Debugging**)

3. A new VS Code window opens — this is the **Extension Development Host**. Open any code project in it.

4. The extension activates automatically and starts indexing your workspace. Watch the bottom status bar — you'll see `$(loading~spin) KG: Indexing…` then it settles to `$(graph) KG`.

5. Check the **Output** panel (View → Output → "Semantic Knowledge Graph") for detailed logs.

---

## Step 6 — Configure your LLM (optional but recommended)

Open VS Code settings (`Ctrl+,` / `Cmd+,`) and search for `semanticKG`:

```jsonc
// settings.json
{
  // Choose your provider: "anthropic" | "openai" | "ollama"
  "semanticKG.llmProvider": "anthropic",

  // Your API key (stored in VS Code settings, not in code)
  "semanticKG.llmApiKey": "sk-ant-...",

  // Model to use
  "semanticKG.llmModel": "claude-sonnet-4-20250514",

  // MCP server port (default 3579)
  "semanticKG.mcpPort": 3579,

  // Auto-update graph when you save a file
  "semanticKG.autoRebuildOnSave": true
}
```

**Using Ollama (fully local, no API key):**
```jsonc
{
  "semanticKG.llmProvider": "ollama",
  "semanticKG.llmModel": "llama3",   // or any model you have pulled
  "semanticKG.ollamaUrl": "http://localhost:11434"
}
```

Without an LLM key, the graph still indexes and all MCP tools work — you just won't get auto-generated docstrings or commit messages.

---

## Step 7 — Explore the UI

In the Extension Development Host window:

- **Click the graph icon** in the Activity Bar (left sidebar) to open the Knowledge Graph panel
- You'll see two sub-panels:
  - **Graph Explorer** — interactive D3 force-directed graph of your codebase
  - **Context Inspector** — live feed of MCP queries from AI agents

**Commands** (open Command Palette with `Ctrl+Shift+P`):
| Command | What it does |
|---------|-------------|
| `Semantic KG: Rebuild Knowledge Graph` | Full re-index |
| `Semantic KG: Open Graph Explorer` | Focus graph panel |
| `Semantic KG: Open Context Inspector` | Focus inspector panel |
| `Semantic KG: Suggest Commit Message` | Generate commit message from staged changes |

---

## Step 8 — Connect an AI Agent via MCP

The MCP server starts automatically on `http://localhost:3579`.

### Cursor AI
Create or edit `.cursor/mcp.json` in your project:
```json
{
  "mcpServers": {
    "semantic-kg": {
      "url": "http://localhost:3579/mcp"
    }
  }
}
```

### Claude Desktop
Edit `claude_desktop_config.json`:
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "semantic-kg": {
      "url": "http://localhost:3579/mcp"
    }
  }
}
```

### Test the MCP server manually
```bash
# See the tool manifest
curl http://localhost:3579/mcp/manifest

# Search for symbols semantically
curl -X POST http://localhost:3579/mcp \
  -H "Content-Type: application/json" \
  -d '{"tool":"search_intent","params":{"query":"database connection","limit":5}}'

# Explore a specific symbol (replace with a real ID from your graph)
curl -X POST http://localhost:3579/mcp \
  -H "Content-Type: application/json" \
  -d '{"tool":"explore_symbol","params":{"symbol_id":"src/db.ts:connect"}}'

# Get blast radius
curl -X POST http://localhost:3579/mcp \
  -H "Content-Type: application/json" \
  -d '{"tool":"get_blast_radius","params":{"symbol_id":"src/db.ts:connect"}}'
```

---

## Step 9 — Package as .vsix for installation (optional)

To install the extension permanently (not just in dev mode):

```bash
# Install vsce if you don't have it
npm install -g @vscode/vsce

# Package
vsce package

# Install the .vsix
code --install-extension semantic-kg-extension-0.1.0.vsix
```

---

## Troubleshooting

**`better-sqlite3` native binding error**
- Run `npm rebuild better-sqlite3`
- On Windows, ensure Visual C++ Build Tools are installed

**`@xenova/transformers` is slow on first use**
- The ONNX model (~22 MB) downloads once on first activation
- Subsequent starts are instant (cached in extension global storage)

**Tree-sitter grammars not found**
- Re-run `node scripts/download-grammars.js`
- The regex fallback will still extract functions/classes, just less accurately

**MCP server port conflict**
- Change `semanticKG.mcpPort` to another port (e.g. 3580) in settings

**Graph is empty after indexing**
- Check Output panel → "Semantic Knowledge Graph" for errors
- Ensure your workspace has supported files: `.ts`, `.js`, `.py`, `.java`, `.go`, `.rs`, `.cpp`
- Check `semanticKG.excludePatterns` isn't too aggressive

**`vsce package` fails**
- Ensure all files in `.vscodeignore` are correct
- Run `npm run compile` first

---

## Development Workflow

```bash
# Terminal 1: watch TypeScript
npm run watch

# Terminal 2: VS Code opens extension host
# Press F5 in VS Code

# Make a change in src/ → TypeScript recompiles → Ctrl+R in Extension Host to reload
```

The SQLite database is stored at:
- **macOS/Linux:** `~/.config/Code/User/globalStorage/semantic-kg-extension/knowledge-graph.db`  
- **Windows:** `%APPDATA%\Code\User\globalStorage\semantic-kg-extension\knowledge-graph.db`

You can inspect it with any SQLite browser (e.g. [DB Browser for SQLite](https://sqlitebrowser.org/)).
