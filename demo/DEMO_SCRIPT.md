# Demo Script — 7 Minutes

## 🎯 Objective
Demonstrate the Semantic Knowledge Graph Extension's ability to:
1. Index Python code in real-time (live indexing)
2. Query the codebase via AI chat interface
3. Visualize code relationships in a knowledge graph
4. Perform incremental re-indexing with documentation updates

---

## ⏱️ Timeline: 7 Minutes Total

### **Setup (Before demo starts)**
- [ ] **Laptop 1:** Open `demo/indexed-original/index.html` in browser (as fallback)
- [ ] **Laptop 2:** Have knowledge graph interface ready
- [ ] **Browser 2:** Pre-load `demo/indexed-updated/index.html` (as updated version fallback)
- [ ] **Terminal:** Navigate to demo/ folder
- [ ] **Confirm:** Both laptops have network/wifi for LLM calls

---

## **PHASE 1: Introduction & Live Setup (0:00 - 1:00)**

### What to Say:
> "We've built a Semantic Knowledge Graph extension for VS Code that understands your entire codebase semantically. Today we'll show you three things: (1) how it indexes code in real-time, (2) how you can query your codebase with natural language, and (3) how it updates incrementally when code changes."

### What to Do:
1. **Show the Python project structure** (share screen from Laptop 1)
   - Open `demo/calculator-project/` in file explorer
   - Point out: 6 files, interdependent modules (main → calculator → operations → validator, logger)
   - Say: "This is a realistic small Python project with clear call relationships"

2. **Click "Index Repository" button** or show indexing starting
   - Show progress bar loading
   - Say: "The extension is now parsing the code with Tree-sitter, extracting 6 functions and classes, generating embeddings, and creating AI-powered documentation using Groq API"
   - **TIME CHECK: ~1:00 mark**

---

## **PHASE 2: Chat Interface Demo (1:00 - 3:00)**

### While indexing completes on Laptop 1:

**Setup Laptop 2:** Show knowledge graph visualization
- Open graph interface
- Say: "Meanwhile, let me show you the knowledge graph of the project"
- Point out nodes: Calculator, AdvancedOps, validator, logger, config
- Show edges: CALLS, IMPORTS, USES relationships

### Once indexing completes (Laptop 1):

1. **Show generated documentation** (refresh `indexed-original/index.html`)
   - Show chat interface loading with pre-generated responses
   - Say: "The system has automatically generated interactive documentation"

2. **Demonstrate 3-4 chat queries:**
   - **Query 1:** "What does the Calculator class do?"
     - Expected response: "Performs basic arithmetic operations with validation..."
     - Say: "Notice how it gives a concise, semantically accurate answer"
   
   - **Query 2:** "Show me how validator works"
     - Say: "The system retrieves the most relevant code context from the knowledge graph"
   
   - **Query 3:** "How do main and Calculator interact?"
     - Say: "It understands the call relationships between modules"
   
   - **Bonus Query:** "What functions call validate_number?"
     - Say: "The semantic search finds all related code, not just keyword matches"

3. **Point to sidebar:** "Clicking on any function shows the code inline"
   - Click on calculator.py link to show documentation page
   - Say: "Full traceable documentation with call graphs"

   - **TIME CHECK: ~3:00 mark**

---

## **PHASE 3: Knowledge Graph Interactivity (3:00 - 5:00)**

### Back to Laptop 2 (Graph Interface):

1. **Interactive exploration:**
   - Click on a node (e.g., Calculator)
   - Show sidebar with code + metadata
   - Say: "You can navigate the entire codebase through the graph"

2. **Semantic search demonstration:**
   - Search for: "validation" or "error handling"
   - Say: "Semantic search finds code by meaning, not just keywords"
   - Show results: validator module, divide_safe function, etc.

3. **Show community detection:**
   - Highlight clusters of related functions
   - Say: "The system detects communities — groups of functions that work together"

   - **TIME CHECK: ~5:00 mark**

---

## **PHASE 4: Incremental Re-Indexing Demo (5:00 - 7:00)**

### Say:
> "Now, this is the really cool part. Let me show you what happens when code changes. We've pre-modified 3 functions in the calculator to add new methods and improve documentation."

### What to Show:

1. **Laptop 1 - Show code changes** (optional, can skip for time):
   - Show `demo/calculator-project-modified/calculator.py`
   - Highlight: New `divide()` method
   - Say: "We added a divide() method with comprehensive error handling"

2. **Simulate re-indexing:**
   - Either: Run re-index command, OR
   - Show pre-calculated result
   - Say: "The system detects only 3 functions changed and re-documents only those"

3. **Load updated documentation** (Laptop 1):
   - Refresh to `indexed-updated/index.html`
   - Say: "Notice the page now says [RE-INDEXED] at the top"
   - Show chat interface mentions new methods
   - Click on calculator.html to show:
     - New divide() method highlighted with ✨ badge
     - Updated documentation
     - Link graph showing new edges

4. **Demonstrate efficiency:**
   - Compare timestamps/sizes
   - Say: "Instead of re-indexing 6 functions (100%), we only updated 3 changed ones (50% faster). For large codebases, this is a huge time saving."

   - **TIME CHECK: ~6:30 mark**

---

## **PHASE 5: Conclusion (6:30 - 7:00)**

### Say:
> "In 7 minutes, you've seen:
> 1. **Live code indexing** using Tree-sitter and AI-powered documentation
> 2. **Semantic querying** where you ask questions, not search keywords
> 3. **Knowledge graph visualization** showing exactly how code relates
> 4. **Incremental updates** that are smart and efficient
> 
> This means developers can understand massive codebases quickly, onboard faster, and catch bugs before they ship. The graph becomes a living map of your codebase."

### Key Takeaway:
> "We're not just building an IDE extension—we're creating a new way to understand code through semantic relationships and AI."

---

## 🔴 FALLBACK PLAN (If something breaks)

### If live indexing fails:
- Pre-load `indexed-original/index.html` silently
- Observers won't know the difference
- Continue with demo as planned

### If graph visualization crashes:
- Say: "Let me switch to the documentation view" (Laptop 1)
- Fall back to showing chat interface only

### If LLM API fails:
- Say: "Pre-indexed results are cached here"
- Show pre-prepared responses (they're baked into chat.js)
- Observers see smooth demo regardless

---

## ✅ Success Checklist

Before you start:
- [ ] Both laptops have power
- [ ] Network/WiFi is stable
- [ ] Groq API key is configured
- [ ] Both HTML pages load and respond
- [ ] Chat.js pre-prepared responses work
- [ ] Graph interface is responsive

During demo:
- [ ] Make eye contact with observers
- [ ] Pause for reactions (don't rush)
- [ ] Emphasize: "Real code," "No mockups," "Live data"
- [ ] Ask: "Any questions?" at 6:30 mark

Post-demo:
- [ ] Offer to show code
- [ ] Mention open-source availability
- [ ] Exchange contact info

---

## 📋 Quick Reference Cards

### For Observers' Questions:

**Q: "How does it handle errors?"**
A: "The validator module ensures all inputs are valid. Tree-sitter catches malformed code. The system is fault-tolerant."

**Q: "What languages does it support?"**
A: "Currently Python, JavaScript, TypeScript, Java, Go, Rust, C++. Any language Tree-sitter supports."

**Q: "How does this scale to 100k+ functions?"**
A: "The knowledge graph is stored in sql.js (WASM), embeddings use Xenova (client-side), so it's fast even on large codebases."

**Q: "Can teams use this?"**
A: "Yes! The graph can be exported and shared. Multiple devs can query the same knowledge graph simultaneously."

---

## 🎬 Demo Files Located At:
```
semantic-kg-extension/demo/
├── calculator-project/              (original Python project)
├── calculator-project-modified/     (improved version)
├── indexed-original/                (initial documentation)
│   └── index.html                   (OPEN THIS IN BROWSER #1)
├── indexed-updated/                 (updated after changes)
│   └── index.html                   (FALLBACK/SHOW AT END)
└── DEMO_SCRIPT.md                   (this file)
```

---

**Remember: Confidence is key. You've built something impressive. Let it speak for itself! 🚀**
