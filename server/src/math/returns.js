/**
 * returns.js - Pure functions for financial asset log returns and parameter estimation.
 */

import { TIME_CONFIG } from '../config/time.js';

/**
 * Calculates log returns for a series of asset prices:
 * r_t = ln(S_t / S_{t-1})
 *
 * @param {number[]} prices - Array of historical prices
 * @returns {number[]} Array of log returns of length prices.length - 1
 */
export function logReturns(prices) {
  if (!Array.isArray(prices) || prices.length < 2) return [];
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1];
    const curr = prices[i];
    if (prev > 0 && curr > 0) {
      returns.push(Math.log(curr / prev));
    } else {
      returns.push(0);
    }
  }
  return returns;
}

/**
 * Calculates sample mean of an array:
 * \bar{r} = (1/N) * \sum_{i=1}^N r_i
 *
 * @param {number[]} values
 * @returns {number}
 */
export function mean(values) {
  if (!values || values.length === 0) return 0;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

/**
 * Calculates sample standard deviation (unbiased, N-1 degrees of freedom):
 * s = \sqrt{ (1 / (N - 1)) * \sum_{i=1}^N (r_i - \bar{r})^2 }
 *
 * @param {number[]} values
 * @returns {number}
 */
export function sampleStd(values) {
  if (!values || values.length < 2) return 0;
  const m = mean(values);
  const sumSq = values.reduce((acc, v) => acc + Math.pow(v - m, 2), 0);
  return Math.sqrt(sumSq / (values.length - 1));
}

/**
 * Estimates annualized drift (muAnnual) and annualized volatility (sigmaAnnual) from log returns:
 * sigmaAnnual = sampleStd(r) / sqrt(dt)
 * muAnnual = mean(r) / dt + 0.5 * sigmaAnnual^2
 *
 * @param {number[]} r - Array of log returns
 * @param {number} [dt=1/252] - Time step in years (default daily: 1/252)
 * @returns {{ muAnnual: number, sigmaAnnual: number }}
 */
export function estimateParams(r, dt = 1 / TIME_CONFIG.DAYS_PER_YEAR) {
  if (!r || r.length < 2 || dt <= 0) {
    return { muAnnual: 0, sigmaAnnual: 0 };
  }
  const std = sampleStd(r);
  const m = mean(r);
  const sigmaAnnual = std / Math.sqrt(dt);
  const muAnnual = (m / dt) + 0.5 * sigmaAnnual * sigmaAnnual;

  return { muAnnual, sigmaAnnual };
}

/**
 * Calculates Exponentially Weighted Moving Average (EWMA) volatility (RiskMetrics style),
 * annualized by sqrt(1 / dt):
 * \sigma_{t}^2 = \lambda * \sigma_{t-1}^2 + (1 - \lambda) * r_t^2
 *
 * @param {number[]} r - Array of log returns
 * @param {number} [lambda=0.94] - Decay factor (default 0.94)
 * @param {number} [dt=1/252] - Time step in years (default daily: 1/252)
 * @returns {number} Annualized EWMA volatility
 */
export function ewmaVolatility(r, lambda = 0.94, dt = 1 / TIME_CONFIG.DAYS_PER_YEAR) {
  if (!r || r.length === 0 || dt <= 0) return 0;
  if (r.length === 1) return (Math.abs(r[0]) / Math.sqrt(dt));

  // Initialize variance with sample variance
  let variance = Math.pow(sampleStd(r), 2);
  if (variance === 0) variance = Math.pow(r[0], 2);

  for (let i = 0; i < r.length; i++) {
    variance = lambda * variance + (1 - lambda) * Math.pow(r[i], 2);
  }

  const dailyVol = Math.sqrt(variance);
  return dailyVol / Math.sqrt(dt);
}

/**
 * Blends sample volatility and EWMA volatility 50/50, and recalculates drift accordingly:
 * sigmaAnnual = 0.5 * (sampleSigma + ewmaSigma)
 * muAnnual = mean(r)/dt + 0.5 * sigmaAnnual^2
 *
 * @param {number[]} r - Array of log returns
 * @param {number} [dt=1/252] - Time step in years (default daily: 1/252)
 * @param {number} [lambda=0.94] - EWMA decay parameter
 * @returns {{ muAnnual: number, sigmaAnnual: number, sampleVol: number, ewmaVol: number }}
 */
export function blendedParams(r, dt = 1 / TIME_CONFIG.DAYS_PER_YEAR, lambda = 0.94) {
  if (!r || r.length < 2 || dt <= 0) {
    return { muAnnual: 0, sigmaAnnual: 0, sampleVol: 0, ewmaVol: 0 };
  }
  const { muAnnual: sampleMu, sigmaAnnual: sampleVol } = estimateParams(r, dt);
  const ewmaVol = ewmaVolatility(r, lambda, dt);
  const sigmaAnnual = 0.5 * (sampleVol + ewmaVol);
  const m = mean(r);
  const muAnnual = (m / dt) + 0.5 * sigmaAnnual * sigmaAnnual;

  return { muAnnual, sigmaAnnual, sampleVol, ewmaVol };
}
