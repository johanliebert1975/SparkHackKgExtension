// src/ui/display.ts
// Responsible for all DOM updates — keeps UI logic out of the core

export interface DisplayState {
  expression: string;
  result: string | null;
  error: string | null;
  history: HistoryEntry[];
}

export interface HistoryEntry {
  expression: string;
  result: string;
  timestamp: Date;
}

// --- Element selectors (override if your HTML uses different IDs) ---

const SELECTORS = {
  expression: "#expression",
  result:     "#result",
  error:      "#error",
  history:    "#history",
} as const;

function $(selector: string): HTMLElement | null {
  return document.querySelector(selector);
}

/**
 * Writes the current expression string to the display.
 */
export function showExpression(expr: string): void {
  const el = $( SELECTORS.expression);
  if (el) el.textContent = expr;
}

/**
 * Shows a numeric result on screen.
 * Formats large/small floats with toPrecision to avoid runaway decimals.
 */
export function showResult(value: number): void {
  const el = $(SELECTORS.result);
  if (!el) return;

  const formatted = formatNumber(value);
  el.textContent = formatted;
  el.classList.remove("error");
  el.classList.add("result");

  const errEl = $(SELECTORS.error);
  if (errEl) errEl.textContent = "";
}

/**
 * Shows an error message (parse or eval failure).
 */
export function showError(message: string): void {
  const el = $(SELECTORS.error);
  if (el) el.textContent = `⚠ ${message}`;

  const resultEl = $(SELECTORS.result);
  if (resultEl) {
    resultEl.textContent = "Error";
    resultEl.classList.add("error");
    resultEl.classList.remove("result");
  }
}

/**
 * Clears expression, result, and error from the screen.
 */
export function clearDisplay(): void {
  showExpression("");
  const resultEl = $(SELECTORS.result);
  if (resultEl) { resultEl.textContent = "0"; resultEl.className = ""; }

  const errEl = $(SELECTORS.error);
  if (errEl) errEl.textContent = "";
}

/**
 * Appends an entry to the history list in the DOM.
 */
export function appendHistory(entry: HistoryEntry): void {
  const container = $(SELECTORS.history);
  if (!container) return;

  const item = document.createElement("li");
  item.className = "history-item";
  item.innerHTML = `
    <span class="history-expr">${escapeHtml(entry.expression)}</span>
    <span class="history-sep">=</span>
    <span class="history-result">${escapeHtml(entry.result)}</span>
    <time class="history-time">${entry.timestamp.toLocaleTimeString()}</time>
  `;

  // Most recent at top
  container.prepend(item);
}

/**
 * Removes all history items from the DOM.
 */
export function clearHistory(): void {
  const container = $(SELECTORS.history);
  if (container) container.innerHTML = "";
}

// --- Helpers ---

function formatNumber(n: number): string {
  if (!isFinite(n)) return n > 0 ? "∞" : n < 0 ? "-∞" : "NaN";
  if (Number.isInteger(n)) return n.toString();

  // Use toPrecision to avoid things like 0.30000000000000004
  const str = parseFloat(n.toPrecision(12)).toString();
  return str;
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
