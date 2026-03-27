/**
 * GraphUIServer — localhost web UI for the knowledge graph.
 *
 * Features:
 * - Node labels always visible (not just on hover)
 * - Edge labels showing relation type
 * - Filter by node type / community
 * - Semantic + keyword search
 * - Node expansion on click (highlight call paths)
 * - Community color coding
 * - Stats panel
 * - HIGH PERFORMANCE: requestAnimationFrame & GPU Acceleration
 */
import { GraphStore } from '../core/graph/GraphStore';
export declare class GraphUIServer {
    private readonly store;
    private readonly port;
    private server;
    constructor(store: GraphStore, port?: number);
    start(): void;
    stop(): void;
    private buildHtml;
}
