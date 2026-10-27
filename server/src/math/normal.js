/**
 * Pure statistical distribution functions.
 * Includes high-precision Abramowitz & Stegun approximations.
 */

/**
 * Standard Normal Probability Density Function: phi(x)
 * @param {number} x
 * @returns {number}
 */
export function normalPdf(x) {
  return (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
}

/**
 * Cumulative Standard Normal Distribution Function: Phi(x)
 * Uses Abramowitz and Stegun approximation (formula 26.2.17)
 * Absolute error < 7.5e-8
 * @param {number} x
 * @returns {number}
 */
export function normalCdf(x) {
  if (x === 0) return 0.5;

  const b1 = 0.319381530;
  const b2 = -0.356563782;
  const b3 = 1.781477937;
  const b4 = -1.821255978;
  const b5 = 1.330274429;
  const p = 0.2316419;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);

  const t = 1.0 / (1.0 + p * absX);
  const poly = ((((b5 * t + b4) * t + b3) * t + b2) * t + b1) * t;
  const pdfVal = normalPdf(absX);
  const cdfVal = 1.0 - pdfVal * poly;

  return sign === -1 ? 1.0 - cdfVal : cdfVal;
}

/**
 * Box-Muller transform to generate standard normal variate Z ~ N(0, 1).
 * Supports deterministic PRNG if randomFn is provided.
 * @param {() => number} [randomFn=Math.random]
 * @returns {number}
 */
export function standardNormal(randomFn = Math.random) {
  let u1 = 0;
  let u2 = 0;
  // Avoid 0
  while (u1 <= 1e-15) u1 = randomFn();
  while (u2 <= 1e-15) u2 = randomFn();

  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

/**
 * Seedable linear congruential generator (LCG) for deterministic tests and simulations.
 * @param {number} seed
 * @returns {() => number}
 */
export function createPseudoRandom(seed = 123456789) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;

  return function next() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
