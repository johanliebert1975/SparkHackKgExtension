// src/math/trig.ts
// Trigonometric functions — all angles in radians unless noted

/**
 * Converts degrees to radians.
 */
export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Converts radians to degrees.
 */
export function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

// --- Primary trig ---

export function sin(radians: number): number {
  return Math.sin(radians);
}

export function cos(radians: number): number {
  return Math.cos(radians);
}

export function tan(radians: number): number {
  return Math.tan(radians);
}

// --- Inverse trig ---

/**
 * Arc sine — returns value in [-π/2, π/2].
 * @throws RangeError if |x| > 1
 */
export function asin(x: number): number {
  if (x < -1 || x > 1) throw new RangeError(`asin domain error: ${x}`);
  return Math.asin(x);
}

/**
 * Arc cosine — returns value in [0, π].
 * @throws RangeError if |x| > 1
 */
export function acos(x: number): number {
  if (x < -1 || x > 1) throw new RangeError(`acos domain error: ${x}`);
  return Math.acos(x);
}

/**
 * Arc tangent — returns value in (-π/2, π/2).
 */
export function atan(x: number): number {
  return Math.atan(x);
}

/**
 * Two-argument arc tangent — returns angle in (-π, π].
 */
export function atan2(y: number, x: number): number {
  return Math.atan2(y, x);
}

// --- Hyperbolic ---

export function sinh(x: number): number {
  return Math.sinh(x);
}

export function cosh(x: number): number {
  return Math.cosh(x);
}

export function tanh(x: number): number {
  return Math.tanh(x);
}

// --- Degree variants (convenience) ---

export function sinDeg(degrees: number): number {
  return Math.sin(toRadians(degrees));
}

export function cosDeg(degrees: number): number {
  return Math.cos(toRadians(degrees));
}

export function tanDeg(degrees: number): number {
  return Math.tan(toRadians(degrees));
}

/**
 * Namespace export — lets the evaluator import everything as `trigOps`.
 */
export const trigOps = {
  sin, cos, tan,
  asin, acos, atan, atan2,
  sinh, cosh, tanh,
  sinDeg, cosDeg, tanDeg,
  toRadians, toDegrees,
};
