/**
 * probability.js - High-precision probability calculations for price targets:
 * - normalCdf with Abramowitz & Stegun 7.1.26 erf approximation
 * - closedFormTerminalProb
 * - closedFormTouchProb (reflection principle with drift)
 * - monteCarloHitProbability (15-minute granularity with Wilson score interval & fan chart percentiles)
 * - requiredReturn & probabilityGrid
 */

import { normalPdf, standardNormal } from './normal.js';
import { TIME_CONFIG } from '../config/time.js';

/**
 * Abramowitz and Stegun 7.1.26 erf approximation:
 * erf(x) = 1 - (a1*t + a2*t^2 + a3*t^3 + a4*t^4 + a5*t^5)*exp(-x^2) + epsilon(x), |epsilon| <= 1.5e-7
 * where t = 1 / (1 + p*x)
 *
 * @param {number} x
 * @returns {number}
 */
export function erf(x) {
  if (x === 0) return 0;
  const p = 0.3275911;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);

  const t = 1.0 / (1.0 + p * absX);
  const poly = ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t;
  const y = 1.0 - poly * Math.exp(-absX * absX);

  return sign * y;
}

/**
 * Standard Normal Cumulative Distribution Function Phi(x)
 * using erf: Phi(x) = 0.5 * (1 + erf(x / sqrt(2)))
 *
 * @param {number} x
 * @returns {number} Value in [0, 1]
 */
export function normalCdf(x) {
  if (Number.isNaN(x)) return 0;
  if (x === 0) return 0.5;
  if (x > 8.0) return 1.0;
  if (x < -8.0) return 0.0;
  return 0.5 * (1.0 + erf(x / Math.SQRT2));
}

/**
 * Closed-form terminal probability that stock price finishes at or above (if K >= S0)
 * or at or below (if K < S0) target K at horizon T:
 *
 * Under GBM: ln(S_T / S0) ~ N((mu - 0.5*sigma^2)*T, sigma^2*T)
 * d2 = [ ln(S0 / K) + (mu - 0.5*sigma^2)*T ] / (sigma * sqrt(T))
 * For K >= S0: P(S_T >= K) = N(d2)
 * For K < S0:  P(S_T <= K) = N(-d2) = 1 - N(d2)
 *
 * @param {number} S0 - Initial price
 * @param {number} K - Target strike price
 * @param {number} mu - Annualized drift
 * @param {number} sigma - Annualized volatility
 * @param {number} T - Time horizon in years
 * @returns {number} Probability in [0, 1]
 */
export function closedFormTerminalProb(S0, K, mu, sigma, T) {
  if (!(S0 > 0) || !(K > 0) || !(sigma > 0) || !(T > 0)) {
    if (K >= S0) return S0 >= K ? 1.0 : 0.0;
    return S0 <= K ? 1.0 : 0.0;
  }

  const nu = mu - 0.5 * sigma * sigma;
  const sigmaSqrtT = sigma * Math.sqrt(T);
  const d2 = (Math.log(S0 / K) + nu * T) / sigmaSqrtT;

  if (K >= S0) {
    return normalCdf(d2);
  } else {
    return normalCdf(-d2);
  }
}

/**
 * Closed-form First-Hitting (touch/barrier) probability that stock touches K at ANY time in [0, T].
 *
 * For K > S0:
 *   nu = mu - 0.5*sigma^2, b = ln(K / S0) > 0
 *   P(touch) = N((-b + nu*T)/(sigma*sqrt(T))) + exp(2*nu*b / sigma^2) * N((-b - nu*T)/(sigma*sqrt(T)))
 *
 * For K < S0:
 *   b = ln(S0 / K) > 0, nu' = -nu
 *   P(touch) = N((-b - nu*T)/(sigma*sqrt(T))) + exp(-2*nu*b / sigma^2) * N((-b + nu*T)/(sigma*sqrt(T)))
 *
 * @param {number} S0 - Initial price
 * @param {number} K - Target price
 * @param {number} mu - Annualized drift
 * @param {number} sigma - Annualized volatility
 * @param {number} T - Time horizon in years
 * @returns {number} Probability in [0, 1]
 */
export function closedFormTouchProb(S0, K, mu, sigma, T) {
  if (!(S0 > 0) || !(K > 0) || !(sigma > 0) || !(T > 0)) {
    if (K >= S0) return S0 >= K ? 1.0 : 0.0;
    return S0 <= K ? 1.0 : 0.0;
  }

  if (S0 === K) return 1.0;

  const nu = mu - 0.5 * sigma * sigma;
  const sigma2 = sigma * sigma;
  const sigmaSqrtT = sigma * Math.sqrt(T);

  if (K > S0) {
    const b = Math.log(K / S0);
    const z1 = (-b + nu * T) / sigmaSqrtT;
    const z2 = (-b - nu * T) / sigmaSqrtT;
    const exponent = Math.max(-50, Math.min(50, (2 * nu * b) / sigma2));
    const prob = normalCdf(z1) + Math.exp(exponent) * normalCdf(z2);
    return Math.min(1.0, Math.max(0.0, prob));
  } else {
    // Mirror formula for downward barrier K < S0
    const b = Math.log(S0 / K); // positive distance in log space
    const z1 = (-b - nu * T) / sigmaSqrtT;
    const z2 = (-b + nu * T) / sigmaSqrtT;
    const exponent = Math.max(-50, Math.min(50, (-2 * nu * b) / sigma2));
    const prob = normalCdf(z1) + Math.exp(exponent) * normalCdf(z2);
    return Math.min(1.0, Math.max(0.0, prob));
  }
}

/**
 * Wilson score interval (95% confidence) for binomial proportion:
 * CI = \frac{ \hat{p} + \frac{z^2}{2n} \pm z \sqrt{\frac{\hat{p}(1-\hat{p})}{n} + \frac{z^2}{4n^2}} }{1 + \frac{z^2}{n}}
 *
 * @param {number} hits - Number of successes
 * @param {number} n - Total trials
 * @param {number} [z=1.95996] - Z for 95% confidence
 * @returns {{ ciLow: number, ciHigh: number }}
 */
export function wilsonScoreInterval(hits, n, z = 1.95996) {
  if (n <= 0) return { ciLow: 0, ciHigh: 0 };
  const p = hits / n;
  const z2 = z * z;
  const denominator = 1 + z2 / n;
  const center = p + z2 / (2 * n);
  const spread = z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n);

  return {
    ciLow: Math.max(0, (center - spread) / denominator),
    ciHigh: Math.min(1, (center + spread) / denominator)
  };
}

/**
 * Monte Carlo hitting / terminal probability simulation with 15-minute granularity (26 steps/day).
 *
 * Returns fan chart percentiles {p5, p25, p50, p75, p95} across each day, expected & median terminal prices,
 * mean time to hit, and 95% Wilson confidence intervals.
 *
 * @param {Object} params
 * @param {number} params.S0 - Initial price
 * @param {number} params.K - Target strike price
 * @param {number} params.mu - Annual drift
 * @param {number} params.sigma - Annual volatility
 * @param {number} params.days - Duration in simulated trading days
 * @param {number} [params.nPaths=5000] - Number of Monte Carlo paths
 * @param {'touch'|'terminal'} [params.mode='touch'] - Evaluation mode
 * @param {() => number} [params.rng=Math.random] - Seedable uniform RNG
 * @returns {{
 *   probability: number,
 *   ciLow: number,
 *   ciHigh: number,
 *   expectedTerminal: number,
 *   medianTerminal: number,
 *   percentiles: { p5: number[], p25: number[], p50: number[], p75: number[], p95: number[] },
 *   meanTimeToHit: number|null,
 *   nPaths: number
 * }}
 */
export function monteCarloHitProbability({
  S0,
  K,
  mu,
  sigma,
  days,
  nPaths = 5000,
  mode = 'touch',
  rng = Math.random
}) {
  if (!(S0 > 0) || !(K > 0) || !(sigma > 0) || !(days > 0) || nPaths <= 0) {
    return {
      probability: 0,
      ciLow: 0,
      ciHigh: 0,
      expectedTerminal: S0,
      medianTerminal: S0,
      percentiles: { p5: [], p25: [], p50: [], p75: [], p95: [] },
      meanTimeToHit: null,
      nPaths: 0
    };
  }

  const STEPS_PER_DAY = 26; // 15-minute intervals across 6.5 hour trading day (390 mins / 15 = 26 steps)
  const dt = 1 / (TIME_CONFIG.DAYS_PER_YEAR * STEPS_PER_DAY);
  const sqrtDt = Math.sqrt(dt);
  const driftPerStep = (mu - 0.5 * sigma * sigma) * dt;
  const volPerStep = sigma * sqrtDt;

  const isUpside = K >= S0;
  let hits = 0;
  let hitTimeSum = 0;
  const terminalPrices = new Float64Array(nPaths);

  // Daily price storage for percentiles: (days + 1) buckets
  const dailyPrices = Array.from({ length: days + 1 }, () => new Float64Array(nPaths));
  for (let p = 0; p < nPaths; p++) {
    dailyPrices[0][p] = S0;
  }

  for (let p = 0; p < nPaths; p++) {
    let price = S0;
    let hit = false;
    let hitTime = null;

    if (isUpside ? price >= K : price <= K) {
      hit = true;
      hitTime = 0;
    }

    for (let day = 1; day <= days; day++) {
      for (let s = 0; s < STEPS_PER_DAY; s++) {
        const Z = standardNormal(rng);
        price = price * Math.exp(driftPerStep + volPerStep * Z);

        if (!hit && (isUpside ? price >= K : price <= K)) {
          hit = true;
          hitTime = (day - 1) + (s + 1) / STEPS_PER_DAY;
        }
      }
      dailyPrices[day][p] = price;
    }

    terminalPrices[p] = price;

    if (mode === 'touch') {
      if (hit) {
        hits++;
        hitTimeSum += hitTime;
      }
    } else {
      // mode === 'terminal'
      if (isUpside ? price >= K : price <= K) {
        hits++;
      }
    }
  }

  const prob = hits / nPaths;
  const { ciLow, ciHigh } = wilsonScoreInterval(hits, nPaths);

  terminalPrices.sort();
  const sumTerminal = terminalPrices.reduce((a, b) => a + b, 0);
  const expectedTerminal = sumTerminal / nPaths;
  const medianTerminal = terminalPrices[Math.floor(nPaths / 2)];

  // Compute fan chart percentiles across each day
  const p5 = new Array(days + 1);
  const p25 = new Array(days + 1);
  const p50 = new Array(days + 1);
  const p75 = new Array(days + 1);
  const p95 = new Array(days + 1);

  for (let d = 0; d <= days; d++) {
    dailyPrices[d].sort();
    p5[d] = dailyPrices[d][Math.floor(0.05 * nPaths)];
    p25[d] = dailyPrices[d][Math.floor(0.25 * nPaths)];
    p50[d] = dailyPrices[d][Math.floor(0.50 * nPaths)];
    p75[d] = dailyPrices[d][Math.floor(0.75 * nPaths)];
    p95[d] = dailyPrices[d][Math.floor(0.95 * nPaths)];
  }

  return {
    probability: prob,
    ciLow,
    ciHigh,
    expectedTerminal,
    medianTerminal,
    percentiles: { p5, p25, p50, p75, p95 },
    meanTimeToHit: hits > 0 ? hitTimeSum / hits : null,
    nPaths
  };
}

/**
 * Calculates annualised return required to reach target K from S0 in specified trading days:
 * R_{ann} = \left( \frac{K}{S0} \right)^{252 / \text{days}} - 1
 *
 * @param {number} S0
 * @param {number} K
 * @param {number} days
 * @returns {number}
 */
export function requiredReturn(S0, K, days) {
  if (!(S0 > 0) || !(K > 0) || !(days > 0)) return 0;
  const years = days / TIME_CONFIG.DAYS_PER_YEAR;
  return Math.pow(K / S0, 1 / years) - 1;
}

/**
 * Generates an instant what-if heatmap grid of closed-form touch/terminal probabilities
 * across combinations of targets and days:
 *
 * @param {Object} params
 * @param {number} params.S0 - Initial stock price
 * @param {number} params.mu - Annual drift
 * @param {number} params.sigma - Annual volatility
 * @param {number[]} params.targets - Array of target prices
 * @param {number[]} params.days - Array of day horizons
 * @param {'touch'|'terminal'} [params.mode='touch'] - Probability mode
 * @returns {Array<{ target: number, days: number, probability: number, requiredReturn: number }>}
 */
export function probabilityGrid({
  S0,
  mu,
  sigma,
  targets,
  days,
  mode = 'touch'
}) {
  if (!targets || !days) return [];
  const results = [];

  for (const K of targets) {
    for (const d of days) {
      const T = d / TIME_CONFIG.DAYS_PER_YEAR;
      const prob = mode === 'touch'
        ? closedFormTouchProb(S0, K, mu, sigma, T)
        : closedFormTerminalProb(S0, K, mu, sigma, T);

      results.push({
        target: K,
        days: d,
        probability: Math.round(prob * 10000) / 10000,
        requiredReturn: Math.round(requiredReturn(S0, K, d) * 10000) / 10000
      });
    }
  }

  return results;
}

/**
 * Backward compatibility helpers for existing routes:
 */
export function calculateTerminalProbability(currentPrice, targetPrice, remainingDays, mu, sigma, direction) {
  if (currentPrice <= 0 || targetPrice <= 0 || sigma <= 0) return 0;
  const isUpside = direction ? direction === 'ABOVE' : targetPrice >= currentPrice;
  if (isUpside && currentPrice >= targetPrice) return 1.0;
  if (!isUpside && currentPrice <= targetPrice) return 1.0;
  if (remainingDays <= 0) return 0.0;

  const T = remainingDays / TIME_CONFIG.DAYS_PER_YEAR;
  let p = closedFormTerminalProb(currentPrice, targetPrice, mu, sigma, T);
  if (direction === 'ABOVE') {
    const d2 = (Math.log(currentPrice / targetPrice) + (mu - 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
    p = normalCdf(d2);
  } else if (direction === 'BELOW') {
    const d2 = (Math.log(currentPrice / targetPrice) + (mu - 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
    p = normalCdf(-d2);
  }
  return Math.round(p * 10000) / 10000;
}

export function calculateHittingProbability(currentPrice, targetPrice, remainingDays, mu, sigma) {
  if (currentPrice <= 0 || targetPrice <= 0 || sigma <= 0) return 0;
  const isUpside = targetPrice >= currentPrice;
  if (isUpside && currentPrice >= targetPrice) return 1.0;
  if (!isUpside && currentPrice <= targetPrice) return 1.0;
  if (remainingDays <= 0) return 0.0;

  const T = remainingDays / TIME_CONFIG.DAYS_PER_YEAR;
  const p = closedFormTouchProb(currentPrice, targetPrice, mu, sigma, T);
  return Math.round(p * 10000) / 10000;
}
