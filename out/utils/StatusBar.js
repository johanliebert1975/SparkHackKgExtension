"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.IndexingStatusBar = void 0;
const vscode = __importStar(require("vscode"));
class IndexingStatusBar {
    constructor() {
        this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.item.command = 'semanticKG.openContextInspector';
        this.setStatus('idle');
        this.item.show();
    }
    setStatus(status) {
        const labels = {
            idle: '$(graph) KG',
            indexing: '$(loading~spin) KG: Indexing…',
            embedding: '$(loading~spin) KG: Embedding…',
            thinking: '$(loading~spin) KG: Thinking…',
        };
        const tooltips = {
            idle: 'Knowledge Graph — idle. Click to open inspector.',
            indexing: 'Knowledge Graph — indexing workspace…',
            embedding: 'Knowledge Graph — generating embeddings…',
            thinking: 'Knowledge Graph — generating commit message…',
        };
        this.item.text = labels[status];
        this.item.tooltip = tooltips[status];
    }
    dispose() {
        this.item.dispose();
    }
}
exports.IndexingStatusBar = IndexingStatusBar;
//# sourceMappingURL=StatusBar.js.map