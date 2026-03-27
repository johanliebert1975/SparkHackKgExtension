// src/math/basic.ts
// Fundamental arithmetic operations with validation

/**
 * Adds two numbers.
 */
export function add(a: number, b: number): number {
  return a + b;
}

/**
 * Subtracts b from a.
 */
export function subtract(a: number, b: number): number {
  return a - b;
}

/**
 * Multiplies two numbers.
 */
export function multiply(a: number, b: number): number {
  return a * b;
}

/**
 * Divides a by b.
 * @throws RangeError on division by zero
 */
export function divide(a: number, b: number): number {
  if (b === 0) throw new RangeError("Division by zero");
  return a / b;
}

/**
 * Returns the absolute value of n.
 */
export function abs(n: number): number {
  return Math.abs(n);
}

/**
 * Returns the square root of n.
 * @throws RangeError for negative inputs
 */
export function sqrt(n: number): number {
  if (n < 0) throw new RangeError(`Cannot take sqrt of negative number: ${n}`);
  return Math.sqrt(n);
}

/**
 * Raises base to the given exponent.
 */
export function pow(base: number, exponent: number): number {
  return Math.pow(base, exponent);
}

/**
 * Returns the base-10 logarithm of n.
 * @throws RangeError for non-positive inputs
 */
export function log10(n: number): number {
  if (n <= 0) throw new RangeError(`Cannot take log10 of non-positive number: ${n}`);
  return Math.log10(n);
}

/**
 * Returns the remainder of a divided by b (matches Math.sign of a).
 * @throws RangeError when b is zero
 */
export function mod(a: number, b: number): number {
  if (b === 0) throw new RangeError("Modulo by zero");
  return a % b;
}

/**
 * Namespace export — lets the evaluator import everything as `basicOps`.
 */
export const basicOps = { add, subtract, multiply, divide, abs, sqrt, pow, log10, mod };
