# Demo Preparation Agent Prompt

## Goal
Prepare a **7-minute demonstration** of the Semantic Knowledge Graph extension. You are responsible for building **all demo artifacts** that will be shown to observers.

---

## Part 1: Create Python Calculator Project

Create a small Python project at `demo/calculator-project/` with **5-6 interdependent files**. This demonstrates:
- Real code with clear relationships (calls, imports)
- Knowledge graph extraction (AST parsing)
- Semantic embedding & documentation generation
- Incremental re-indexing after code changes

### Project Structure & Code

**File: `demo/calculator-project/main.py`**
```python
"""Main entry point — orchestrates calculator operations."""
from calculator import Calculator
from operations import AdvancedOps
from logger import Logger
from config import Config

def main():
    """Initialize calculator and run demo operations."""
    logger = Logger(Config.LOG_LEVEL)
    logger.info("Calculator app starting...")
    
    calc = Calculator(logger)
    adv_ops = AdvancedOps(calc)
    
    # Basic operations
    calc.add(10, 5)
    calc.subtract(10, 3)
    
    # Advanced operations
    adv_ops.sqrt_safe(16)
    adv_ops.power_safe(2, 3)
    
    logger.info("Calculator app finished.")

if __name__ == "__main__":
    main()
```

**File: `demo/calculator-project/calculator.py`**
```python
"""Core calculator class — basic arithmetic operations."""
from logger import Logger
from validator import validate_number

class Calculator:
    """Performs basic arithmetic operations with validation."""
    
    def __init__(self, logger: Logger):
        """Initialize calculator with logger dependency."""
        self.logger = logger
    
    def add(self, a: float, b: float) -> float:
        """Add two numbers and log result."""
        validate_number(a)
        validate_number(b)
        result = a + b
        self.logger.info(f"add({a}, {b}) = {result}")
        return result
    
    def subtract(self, a: float, b: float) -> float:
        """Subtract b from a."""
        validate_number(a)
        validate_number(b)
        result = a - b
        self.logger.info(f"subtract({a}, {b}) = {result}")
        return result
    
    def multiply(self, a: float, b: float) -> float:
        """Multiply two numbers."""
        validate_number(a)
        validate_number(b)
        result = a * b
        self.logger.info(f"multiply({a}, {b}) = {result}")
        return result
```

**File: `demo/calculator-project/operations.py`**
```python
"""Advanced mathematical operations using Calculator."""
from calculator import Calculator
from validator import validate_number
import math

class AdvancedOps:
    """Wrapper for advanced operations combining Calculator with math module."""
    
    def __init__(self, calc: Calculator):
        """Initialize with a Calculator instance."""
        self.calc = calc
    
    def sqrt_safe(self, x: float) -> float:
        """Calculate square root safely."""
        validate_number(x)
        if x < 0:
            raise ValueError("Cannot compute sqrt of negative number")
        return math.sqrt(x)
    
    def power_safe(self, base: float, exp: float) -> float:
        """Calculate power safely."""
        validate_number(base)
        validate_number(exp)
        return math.pow(base, exp)
    
    def divide_safe(self, a: float, b: float) -> float:
        """Divide with zero-check."""
        validate_number(a)
        validate_number(b)
        if b == 0:
            raise ValueError("Division by zero")
        return a / b
```

**File: `demo/calculator-project/validator.py`**
```python
"""Input validation utilities."""

def validate_number(value):
    """Ensure value is a valid number for operations."""
    if not isinstance(value, (int, float)):
        raise TypeError(f"Expected number, got {type(value)}")
    if math.isnan(value) or math.isinf(value):
        raise ValueError(f"Invalid number: {value}")

import math
```

**File: `demo/calculator-project/logger.py`**
```python
"""Logging utility — tracks all calculator operations."""
import sys
from config import Config

class Logger:
    """Simple logger for tracking operations."""
    
    def __init__(self, level: str = "INFO"):
        """Initialize logger with given level."""
        self.level = level
    
    def info(self, message: str):
        """Log info-level message."""
        if self.level in ['INFO', 'DEBUG']:
            print(f"[INFO] {message}", file=sys.stdout)
    
    def debug(self, message: str):
        """Log debug-level message."""
        if self.level == 'DEBUG':
            print(f"[DEBUG] {message}", file=sys.stdout)
    
    def error(self, message: str):
        """Log error message."""
        print(f"[ERROR] {message}", file=sys.stderr)
```

**File: `demo/calculator-project/config.py`**
```python
"""Configuration constants for the calculator app."""

class Config:
    """Global configuration settings."""
    
    LOG_LEVEL = "INFO"
    MAX_PRECISION = 10
    TIMEOUT_SECONDS = 30
```

---

## Part 2: Generate Documentation Variations

You will prepare **THREE documentation variations** that simulate the demo flow:

### Variation A: **Original Indexed Documentation** (`demo/indexed-original/`)
- Represents the initial state of the calculator project
- Generated by the extension's indexing + LLM pipeline
- Includes: HTML chat interface + function documentation
- **This is what the user sees BEFORE live re-indexing**

### Variation B: **Modified Code Version** (`demo/calculator-project-modified/`)
- Copy of calculator project with 2-3 improved functions
- Changes: better docstrings, added validation, new helper method
- **This is what the AI agent will "modify" during the demo**

### Variation C: **Re-indexed Documentation** (`demo/indexed-updated/`)
- Updated documentation reflecting Variation B changes
- Shows incremental changes (only modified functions highlighted)
- **This is what appears after "re-indexing"**

---

## Part 3: HTML Documentation Generation

For each variation (A & C), generate **static HTML documentation** with:

### Structure
```
indexed-original/
  ├── index.html              (main chat/docs hub)
  ├── docs/
  │   ├── calculator.html
  │   ├── operations.html
  │   ├── validator.html
  │   ├── logger.html
  │   ├── main.html
  │   ├── config.html
  │   └── index.json         (metadata for all functions)
  ├── assets/
  │   ├── style.css
  │   └── chat.js
  └── data/
      └── graph.json         (the knowledge graph nodes + edges)
```

### index.html Content (Chat Interface Hub)
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Calculator Project — Documentation & Chat</title>
    <link rel="stylesheet" href="assets/style.css">
</head>
<body class="dark-theme">
    <div class="container">
        <header>
            <h1>📊 Calculator Project</h1>
            <p class="subtitle">Semantic Knowledge Graph Documentation</p>
        </header>

        <main>
            <section class="chat-panel">
                <h2>Query the Codebase</h2>
                <div id="chat-messages" class="messages"></div>
                <div class="input-area">
                    <input type="text" id="query" placeholder="Ask about any function or module...">
                    <button onclick="sendQuery()">Send</button>
                </div>
            </section>

            <aside class="docs-panel">
                <h3>Documentation</h3>
                <ul id="doc-index"></ul>
            </aside>
        </main>
    </div>

    <script src="assets/chat.js"></script>
    <script>
        // Load documentation index
        fetch('docs/index.json')
            .then(r => r.json())
            .then(docs => {
                const list = document.getElementById('doc-index');
                docs.forEach(doc => {
                    const li = document.createElement('li');
                    li.innerHTML = `<a href="docs/${doc.file}">${doc.name}</a>`;
                    list.appendChild(li);
                });
            });
    </script>
</body>
</html>
```

### Individual Function Documentation (docs/calculator.html)
```html
<!DOCTYPE html>
<html>
<head>
    <title>calculator.py — Calculator Class</title>
    <link rel="stylesheet" href="../assets/style.css">
</head>
<body>
    <div class="doc-container">
        <h1>Class: <code>Calculator</code></h1>
        <p class="file-path">📁 calculator.py</p>
        <p class="docstring">Performs basic arithmetic operations with validation.</p>

        <h2>Methods:</h2>
        <div class="method">
            <h3><code>add(a: float, b: float) → float</code></h3>
            <p>Add two numbers and log result.</p>
            <p><strong>Dependencies:</strong> validator.validate_number(), logger.Logger</p>
        </div>

        <div class="method">
            <h3><code>subtract(a: float, b: float) → float</code></h3>
            <p>Subtract b from a.</p>
        </div>

        <div class="method">
            <h3><code>multiply(a: float, b: float) → float</code></h3>
            <p>Multiply two numbers.</p>
        </div>

        <h2>Graph Relationships:</h2>
        <ul>
            <li>CALLS: validator.validate_number</li>
            <li>CALLS: logger.Logger.info</li>
            <li>IMPORTS: logger</li>
            <li>IMPORTS: validator</li>
        </ul>
    </div>
</body>
</html>
```

### assets/style.css
```css
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0a0a0f;
    color: #e0e0e0;
    line-height: 1.6;
}

body.dark-theme {
    background: #0d0d12;
    color: #f0f0f0;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
}

header {
    text-align: center;
    margin-bottom: 3rem;
}

header h1 {
    font-size: 2.5rem;
    color: #6366f1;
    margin-bottom: 0.5rem;
}

.subtitle {
    color: #999;
    font-size: 1rem;
}

main {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 2rem;
}

.chat-panel {
    background: rgba(30, 30, 40, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 1.5rem;
    backdrop-filter: blur(10px);
}

.chat-panel h2 {
    color: #818cf8;
    margin-bottom: 1rem;
}

.messages {
    height: 300px;
    overflow-y: auto;
    margin-bottom: 1rem;
    padding: 1rem;
    background: rgba(10, 10, 15, 0.5);
    border-radius: 4px;
}

.message {
    margin-bottom: 0.75rem;
    padding: 0.75rem;
    border-radius: 4px;
    background: rgba(129, 140, 248, 0.1);
}

.input-area {
    display: flex;
    gap: 0.5rem;
}

.input-area input {
    flex: 1;
    padding: 0.75rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    color: #f0f0f0;
}

.input-area button {
    padding: 0.75rem 1.5rem;
    background: #6366f1;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
}

.input-area button:hover {
    background: #818cf8;
}

.docs-panel {
    background: rgba(30, 30, 40, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 1.5rem;
}

.docs-panel h3 {
    color: #10b981;
    margin-bottom: 1rem;
}

.docs-panel ul {
    list-style: none;
}

.docs-panel li {
    margin-bottom: 0.5rem;
}

.docs-panel a {
    color: #818cf8;
    text-decoration: none;
}

.docs-panel a:hover {
    text-decoration: underline;
}

.doc-container {
    max-width: 900px;
    margin: 2rem auto;
    background: rgba(30, 30, 40, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 2rem;
}

.file-path {
    color: #999;
    font-size: 0.9rem;
}

.method {
    margin: 1.5rem 0;
    padding: 1rem;
    background: rgba(50, 50, 60, 0.5);
    border-left: 3px solid #6366f1;
    border-radius: 4px;
}

code {
    background: rgba(100, 100, 110, 0.5);
    padding: 0.2em 0.4em;
    border-radius: 3px;
    font-family: 'JetBrains Mono', monospace;
    color: #818cf8;
}

@media (max-width: 768px) {
    main {
        grid-template-columns: 1fr;
    }
}
```

### assets/chat.js
```javascript
const messages = document.getElementById('chat-messages');
const queryInput = document.getElementById('query');

async function sendQuery() {
    const query = queryInput.value.trim();
    if (!query) return;

    // Add user message
    addMessage(query, 'user');
    queryInput.value = '';

    // Load pre-prepared response from data
    const response = await getPrePreparedResponse(query);
    addMessage(response, 'ai');
}

function addMessage(text, role) {
    const div = document.createElement('div');
    div.className = `message ${role}-message`;
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
}

async function getPrePreparedResponse(query) {
    // Load pre-indexed responses
    const responses = {
        'what is calculator': 'The Calculator class performs basic arithmetic operations. It includes add(), subtract(), and multiply() methods, all with input validation.',
        'how does validation work': 'The validator module ensures all inputs are valid numbers using the validate_number() function.',
        'show me main.py': 'main.py is the entry point. It initializes Calculator, AdvancedOps, and Logger, then runs demo operations.',
    };

    // Fuzzy match user query to pre-prepared response
    for (const [key, value] of Object.entries(responses)) {
        if (query.toLowerCase().includes(key.split(' ')[0])) {
            return value;
        }
    }

    return 'I found relevant code in the knowledge graph. Try asking about: Calculator class, validator module, or main.py.';
}

queryInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendQuery();
});
```

### docs/index.json
```json
{
  "files": [
    {
      "name": "calculator.py",
      "file": "calculator.html",
      "type": "module",
      "classes": ["Calculator"],
      "functions": ["add", "subtract", "multiply"]
    },
    {
      "name": "operations.py",
      "file": "operations.html",
      "type": "module",
      "classes": ["AdvancedOps"],
      "functions": ["sqrt_safe", "power_safe", "divide_safe"]
    },
    {
      "name": "validator.py",
      "file": "validator.html",
      "type": "module",
      "functions": ["validate_number"]
    },
    {
      "name": "logger.py",
      "file": "logger.html",
      "type": "module",
      "classes": ["Logger"],
      "functions": ["info", "debug", "error"]
    },
    {
      "name": "config.py",
      "file": "config.html",
      "type": "module",
      "classes": ["Config"]
    },
    {
      "name": "main.py",
      "file": "main.html",
      "type": "module",
      "functions": ["main"]
    }
  ]
}
```

### data/graph.json (Knowledge Graph)
```json
{
  "nodes": [
    {"id": "main:main", "type": "function", "name": "main", "file": "main.py"},
    {"id": "calc:Calculator", "type": "class", "name": "Calculator", "file": "calculator.py"},
    {"id": "ops:AdvancedOps", "type": "class", "name": "AdvancedOps", "file": "operations.py"},
    {"id": "val:validate_number", "type": "function", "name": "validate_number", "file": "validator.py"},
    {"id": "log:Logger", "type": "class", "name": "Logger", "file": "logger.py"},
    {"id": "cfg:Config", "type": "class", "name": "Config", "file": "config.py"}
  ],
  "edges": [
    {"source": "main:main", "target": "calc:Calculator", "relation": "CALLS"},
    {"source": "main:main", "target": "ops:AdvancedOps", "relation": "CALLS"},
    {"source": "main:main", "target": "log:Logger", "relation": "CALLS"},
    {"source": "calc:Calculator", "target": "val:validate_number", "relation": "CALLS"},
    {"source": "calc:Calculator", "target": "log:Logger", "relation": "CALLS"},
    {"source": "ops:AdvancedOps", "target": "calc:Calculator", "relation": "USES"},
    {"source": "ops:AdvancedOps", "target": "val:validate_number", "relation": "CALLS"},
    {"source": "log:Logger", "target": "cfg:Config", "relation": "IMPORTS"}
  ]
}
```

---

## Part 4: Modified Code Version

Create `demo/calculator-project-modified/` as a copy of the original with these changes:

**Modified: `calculator.py`**
- Add docstrings to all methods (more detailed)
- Add type hints to all parameters
- Add a new method: `divide(a, b) → float` with zero-check

**Modified: `operations.py`**
- Improve `power_safe()` docstring
- Add new helper method: `gcd(a, b) → int` (greatest common divisor)

**Modified: `logger.py`**
- Add timestamp to log messages
- Add new method: `warning(message: str)` for warning-level logs

These changes will be tracked as "incremental updates" in the demo.

---

## Part 5: Demo Walkthrough Document

Create `demo/DEMO_SCRIPT.md`:

```markdown
# Demo Script — 7 Minutes

## Setup (Before demo starts)
- [ ] Open VS Code with semantic-kg-extension
- [ ] Have two laptops ready (Laptop 1 & 2)
- [ ] Pre-load `demo/indexed-original/index.html` in browser (fallback)
- [ ] Pre-load `demo/indexed-updated/index.html` in browser (fallback)

## Laptop 1: Chat UI + Live Indexing
**Time: 0:00-1:30**
- Introduce the demo: "We'll index a Python calculator project in real-time"
- Show the calculator project structure (files on disk)
- Click "Index Repository" button (or show pre-staged indexed-original)
- Show progress bar (1-2 mins for documentation generation via Groq LLM)

**Time: 1:30-3:00**
- Show generated HTML documentation (indexed-original/index.html)
- Demonstrate chat interface asking about:
  - "What does Calculator class do?"
  - "Show me the validator module"
  - "How do main() and Calculator interact?"
- Show it returns pre-prepared correct answers from the knowledge graph

## Laptop 2: Graph Interface + Querying
**Time: 3:00-5:00**
- Show knowledge graph visualization with nodes and edges
- Let observers click on nodes to see code in sidebar
- Demonstrate semantic search: "Show me validation code"
- Show graph structure of calculator project relationships

## Demonstration of Incremental Re-indexing
**Time: 5:00-7:00**
- Show: "We modified 3 functions in the calculator"
- Ask AI agent to re-index (OR show pre-staged updated docs)
- Show which documentation changed (diff highlighted)
- Emphasize: "Only modified functions re-documented — 2x faster"

## Fallback Plan
If live indexing fails:
- Silently load pre-indexed documentation from indexed-original/
- Continue demo seamlessly (observers won't know)
```

---

## Part 6: Deliverables Checklist

You will create:

```
demo/
├── calculator-project/                 (original Python project)
│   ├── main.py
│   ├── calculator.py
│   ├── operations.py
│   ├── validator.py
│   ├── logger.py
│   └── config.py
│
├── calculator-project-modified/        (copies with improvements)
│   ├── main.py (updated)
│   ├── calculator.py (updated)
│   ├── operations.py (updated)
│   ├── validator.py (same)
│   ├── logger.py (updated)
│   └── config.py (same)
│
├── indexed-original/                   (documentation for original)
│   ├── index.html
│   ├── docs/
│   │   ├── calculator.html
│   │   ├── operations.html
│   │   ├── validator.html
│   │   ├── logger.html
│   │   ├── main.html
│   │   ├── config.html
│   │   └── index.json
│   ├── assets/
│   │   ├── style.css
│   │   └── chat.js
│   └── data/
│       └── graph.json
│
├── indexed-updated/                    (documentation for modified)
│   ├── index.html (same)
│   ├── docs/ (updated for new methods)
│   ├── assets/ (same)
│   └── data/
│       └── graph.json (updated edges)
│
└── DEMO_SCRIPT.md                     (walkthrough guide)
```

---

## Success Criteria

✅ All files created  
✅ HTML documentation fully styled and interactive  
✅ Chat interface responds to pre-prepared queries  
✅ Modified code version has clear improvements  
✅ Graph data shows correct node relationships  
✅ Demo script is clear and 7-minute friendly  

You now have everything needed to run the demo tomorrow with confidence!
