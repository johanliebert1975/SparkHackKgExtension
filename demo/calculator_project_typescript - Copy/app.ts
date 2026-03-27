// src/app.ts
// Main entry point — wires parser → evaluator → display together

import { parse } from "./core/parser";
import { evaluate, type Environment } from "./core/evaluator";
import {
  showExpression,
  showResult,
  showError,
  clearDisplay,
  appendHistory,
  clearHistory,
  type HistoryEntry,
} from "./ui/display";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface AppState {
  expression: string;
  history: HistoryEntry[];
  variables: Environment;
}

const state: AppState = {
  expression: "",
  history: [],
  variables: {},          // User-defined variables, e.g. { x: 5 }
};

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

/**
 * Evaluates the current expression string.
 * On success, pushes to history and updates the display.
 * On failure, shows the error without clearing the expression.
 */
export function calculate(): void {
  const expr = state.expression.trim();
  if (!expr) return;

  try {
    const ast    = parse(expr);
    const result = evaluate(ast, state.variables);

    showResult(result);

    const entry: HistoryEntry = {
      expression: expr,
      result: String(result),
      timestamp: new Date(),
    };
    state.history.unshift(entry);
    appendHistory(entry);

  } catch (err) {
    showError(err instanceof Error ? err.message : String(err));
  }
}

/**
 * Appends a character (digit, operator, etc.) to the current expression.
 */
export function appendToExpression(char: string): void {
  state.expression += char;
  showExpression(state.expression);
}

/**
 * Replaces the full expression (e.g. when user types in an input field).
 */
export function setExpression(expr: string): void {
  state.expression = expr;
  showExpression(expr);
}

/**
 * Deletes the last character of the expression.
 */
export function backspace(): void {
  state.expression = state.expression.slice(0, -1);
  showExpression(state.expression);
}

/**
 * Resets everything back to the initial state.
 */
export function reset(): void {
  state.expression = "";
  clearDisplay();
}

/**
 * Wipes the history list.
 */
export function resetHistory(): void {
  state.history = [];
  clearHistory();
}

/**
 * Binds a named variable so it can be used inside expressions.
 * Example: bindVariable("x", 42) → user can then type "x * 2"
 */
export function bindVariable(name: string, value: number): void {
  state.variables[name] = value;
}

// ---------------------------------------------------------------------------
// Keyboard & button wiring
// ---------------------------------------------------------------------------

function handleKeyDown(e: KeyboardEvent): void {
  if (e.key === "Enter")      { calculate();  return; }
  if (e.key === "Backspace")  { backspace();  return; }
  if (e.key === "Escape")     { reset();      return; }
}

/**
 * Attaches event listeners to all calculator buttons and the keyboard.
 * Call once after the DOM is ready.
 *
 * Expected button attributes:
 *   data-action="append"    data-value="3"   → appends "3"
 *   data-action="calculate"                  → runs calculate()
 *   data-action="backspace"                  → deletes last char
 *   data-action="reset"                      → clears everything
 *   data-action="reset-history"              → clears history
 */
function bindButtons(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      const value  = btn.dataset.value ?? "";

      switch (action) {
        case "append":        appendToExpression(value); break;
        case "calculate":     calculate();               break;
        case "backspace":     backspace();               break;
        case "reset":         reset();                   break;
        case "reset-history": resetHistory();            break;
      }
    });
  });

  // Live input field sync (optional — works alongside button grid)
  const inputEl = document.querySelector<HTMLInputElement>("#expression-input");
  if (inputEl) {
    inputEl.addEventListener("input", () => setExpression(inputEl.value));
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") calculate();
    });
  }
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

/**
 * Initialises the calculator app.
 * Call this after the DOM is loaded.
 */
export function init(): void {
  bindButtons();
  document.addEventListener("keydown", handleKeyDown);
  clearDisplay();
  console.info("[MathApp] Initialised ✓");
}

// Auto-init when used as a script (not as an ES module imported by tests)
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}
