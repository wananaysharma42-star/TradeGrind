import { TIME_CONFIG } from '../config/time.js';
import { standardNormal } from './normal.js';

/**
 * Mulberry32 seedable PRNG. Returns Uniform(0, 1).
 * @param {number} seed
 * @returns {() => number}
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Standard normal via Box-Muller, driven by a Uniform(0,1) rng.
 * @param {() => number} rng
 * @returns {number}
 */
export function randn(rng) {
  return standardNormal(rng);
}

/**
 * Exact GBM step (no rounding):
 * S * exp((mu - 0.5 * sigma^2) * dt + sigma * sqrt(dt) * Z)
 */
export function nextPrice(S, mu, sigma, dt, Z) {
  if (!(S > 0)) return 0.01;
  return S * Math.exp((mu - 0.5 * sigma * sigma) * dt + sigma * Math.sqrt(dt) * Z);
}

/**
 * Forward GBM path of length `steps + 1` (includes S0).
 */
export function simulatePath(S0, mu, sigma, dt, steps, rng) {
  const path = new Array(steps + 1);
  path[0] = S0;
  let S = S0;
  for (let i = 0; i < steps; i++) {
    S = nextPrice(S, mu, sigma, dt, randn(rng));
    path[i + 1] = S;
  }
  return path;
}

/**
 * Display-oriented GBM step (2 d.p.). Prefer nextPrice for exact maths.
 */
export function gbmStep(currentPrice, mu, sigma, dt = TIME_CONFIG.DT, z = null) {
  const Z = z !== null ? z : standardNormal();
  const price = nextPrice(currentPrice, mu, sigma, dt, Z);
  return Math.max(0.01, Math.round(price * 100) / 100);
}

/**
 * Multi-step path using nextPrice. Length steps + 1.
 */
export function gbmPath(startPrice, mu, sigma, steps, dt = TIME_CONFIG.DT, zArray = null) {
  const path = [startPrice];
  let price = startPrice;
  for (let i = 0; i < steps; i++) {
    const z = zArray && zArray[i] !== undefined ? zArray[i] : standardNormal();
    price = nextPrice(price, mu, sigma, dt, z);
    path.push(price);
  }
  return path;
}
