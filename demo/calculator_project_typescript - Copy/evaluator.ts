// src/core/evaluator.ts
// Walks an AST and evaluates it to a numeric result

import type { ASTNode } from "./parser";
import { basicOps } from "../math/basic";
import { trigOps } from "../math/trig";

export type Environment = Record<string, number>;

/**
 * Built-in constants available in expressions.
 */
const CONSTANTS: Environment = {
  PI: Math.PI,
  E: Math.E,
  TAU: 2 * Math.PI,
};

/**
 * All registered functions (basic + trig).
 * Functions must accept an array of numbers and return a number.
 */
type MathFunction = (...args: number[]) => number;

const FUNCTIONS: Record<string, MathFunction> = {
  // Basic
  abs:   (x) => basicOps.abs(x),
  sqrt:  (x) => basicOps.sqrt(x),
  pow:   (base, exp) => basicOps.pow(base, exp),
  mod:   (a, b) => basicOps.mod(a, b),

  // Trig
  sin:   (x) => trigOps.sin(x),
  cos:   (x) => trigOps.cos(x),
  tan:   (x) => trigOps.tan(x),
  asin:  (x) => trigOps.asin(x),
  acos:  (x) => trigOps.acos(x),
  atan:  (x) => trigOps.atan(x),
  atan2: (y, x) => trigOps.atan2(y, x),
  sinh:  (x) => trigOps.sinh(x),
  cosh:  (x) => trigOps.cosh(x),
  tanh:  (x) => trigOps.tanh(x),

  // Logarithmic / exponential
  log:   (x) => Math.log(x),
  log2:  (x) => Math.log2(x),
  log10: (x) => Math.log10(x),
  exp:   (x) => Math.exp(x),

  // Rounding
  floor: (x) => Math.floor(x),
  ceil:  (x) => Math.ceil(x),
  round: (x) => Math.round(x),

  // Min / max
  min:   (...args) => Math.min(...args),
  max:   (...args) => Math.max(...args),
};

/**
 * Evaluates an AST node within an optional environment of variable bindings.
 *
 * @param node - The AST node to evaluate
 * @param env  - Optional variable bindings (e.g. { x: 5 })
 * @returns    The numeric result
 * @throws     EvalError on unknown identifiers, functions, or divide-by-zero
 */
export function evaluate(node: ASTNode, env: Environment = {}): number {
  const scope: Environment = { ...CONSTANTS, ...env };

  switch (node.type) {
    case "Number":
      return node.value;

    case "Identifier": {
      const key = node.name;
      if (key in scope) return scope[key];
      throw new EvalError(`Unknown identifier: '${key}'`);
    }

    case "UnaryOp":
      return -evaluate(node.operand, scope);

    case "BinaryOp": {
      const left  = evaluate(node.left, scope);
      const right = evaluate(node.right, scope);

      switch (node.operator) {
        case "+": return basicOps.add(left, right);
        case "-": return basicOps.subtract(left, right);
        case "*": return basicOps.multiply(left, right);
        case "/": return basicOps.divide(left, right);   // divide() throws on ÷0
      }
    }

    case "FunctionCall": {
      const fn = FUNCTIONS[node.name];
      if (!fn) throw new EvalError(`Unknown function: '${node.name}'`);

      const args = node.args.map((arg) => evaluate(arg, scope));
      return fn(...args);
    }

    default:
      throw new EvalError(`Unhandled AST node type`);
  }
}

/**
 * Convenience: parse + evaluate in one call.
 * Import parse from parser and call evaluate on the result.
 */
export { FUNCTIONS, CONSTANTS };
