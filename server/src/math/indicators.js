/**
 * indicators.js - Technical indicators:
 * SMA, EMA, RSI-14, Bollinger Bands, Z-score of price vs 20-day mean, and Momentum (N-day return).
 */

import { sampleStd, mean } from './returns.js';

/**
 * Simple Moving Average (SMA):
 * \text{SMA}_k = \frac{1}{k} \sum_{i=1}^k P_{N-k+i}
 *
 * @param {number[]} prices - Array of prices
 * @param {number} period - Window length
 * @returns {number|null} Current SMA value or null if insufficient data
 */
export function sma(prices, period) {
  if (!prices || prices.length < period || period <= 0) return null;
  const slice = prices.slice(-period);
  return mean(slice);
}

/**
 * Exponential Moving Average (EMA):
 * \text{EMA}_t = \alpha \cdot P_t + (1 - \alpha) \cdot \text{EMA}_{t-1}, \quad \alpha = \frac{2}{\text{period} + 1}
 *
 * @param {number[]} prices
 * @param {number} period
 * @returns {number|null} Current EMA value or null if insufficient data
 */
export function ema(prices, period) {
  if (!prices || prices.length < period || period <= 0) return null;
  const k = 2 / (period + 1);
  let currentEma = mean(prices.slice(0, period));
  for (let i = period; i < prices.length; i++) {
    currentEma = prices[i] * k + currentEma * (1 - k);
  }
  return currentEma;
}

/**
 * Relative Strength Index (RSI-14, Wilder's smoothing):
 * \text{RS} = \frac{\text{AvgGain}}{\text{AvgLoss}}, \quad \text{RSI} = 100 - \frac{100}{1 + \text{RS}}
 *
 * @param {number[]} prices
 * @param {number} [period=14]
 * @returns {number} RSI value in [0, 100] (defaults to 50 if insufficient data)
 */
export function rsi(prices, period = 14) {
  if (!prices || prices.length <= period) return 50.0;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100.0;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * Bollinger Bands:
 * Middle = SMA(period)
 * Upper = Middle + multiplier * std(period)
 * Lower = Middle - multiplier * std(period)
 * Bandwidth = (Upper - Lower) / Middle
 * %B = (Price - Lower) / (Upper - Lower)
 *
 * @param {number[]} prices
 * @param {number} [period=20]
 * @param {number} [multiplier=2]
 * @returns {{ middle: number, upper: number, lower: number, bandwidth: number, percentB: number }|null}
 */
export function bollingerBands(prices, period = 20, multiplier = 2) {
  if (!prices || prices.length < period || period <= 0) return null;
  const slice = prices.slice(-period);
  const middle = mean(slice);

  // Population std dev across the window for standard Bollinger Bands
  const sumSq = slice.reduce((acc, p) => acc + Math.pow(p - middle, 2), 0);
  const std = Math.sqrt(sumSq / period);

  const upper = middle + multiplier * std;
  const lower = Math.max(0, middle - multiplier * std);
  const bandwidth = middle > 0 ? (upper - lower) / middle : 0;
  const currentPrice = prices[prices.length - 1];
  const percentB = upper !== lower ? (currentPrice - lower) / (upper - lower) : 0.5;

  return {
    middle,
    upper,
    lower,
    bandwidth,
    percentB
  };
}

/**
 * Z-score of current price vs its 20-day (or N-day) moving average:
 * Z = \frac{P_t - \mu_N}{\sigma_N}
 *
 * @param {number[]} prices
 * @param {number} [period=20]
 * @returns {number|null} Z-score in standard deviations
 */
export function zScorePrice(prices, period = 20) {
  if (!prices || prices.length < period || period <= 0) return null;
  const slice = prices.slice(-period);
  const m = mean(slice);
  const std = sampleStd(slice);
  if (std <= 1e-12) return 0;

  const currentPrice = prices[prices.length - 1];
  return (currentPrice - m) / std;
}

/**
 * Momentum: N-day percentage or log return:
 * M_N = \frac{P_t - P_{t-N}}{P_{t-N}}
 *
 * @param {number[]} prices
 * @param {number} [period=10] - Number of days / periods back
 * @returns {number|null} Percentage return over period
 */
export function momentum(prices, period = 10) {
  if (!prices || prices.length <= period || period <= 0) return null;
  const currentPrice = prices[prices.length - 1];
  const pastPrice = prices[prices.length - 1 - period];
  if (pastPrice <= 0) return 0;
  return (currentPrice - pastPrice) / pastPrice;
}

// Backwards compatibility re-exports
export const calculateSma = (prices, period) => {
  const v = sma(prices, period);
  return v !== null ? Math.round(v * 100) / 100 : null;
};
export const calculateEma = (prices, period) => {
  const v = ema(prices, period);
  return v !== null ? Math.round(v * 100) / 100 : null;
};
export const calculateRsi = (prices, period = 14) => {
  const v = rsi(prices, period);
  return Math.round(v * 10) / 10;
};
export const calculateBollingerBands = (prices, period = 20, multiplier = 2) => {
  const bb = bollingerBands(prices, period, multiplier);
  if (!bb) return null;
  return {
    middle: Math.round(bb.middle * 100) / 100,
    upper: Math.round(bb.upper * 100) / 100,
    lower: Math.round(bb.lower * 100) / 100,
    bandwidth: Math.round(bb.bandwidth * 1000) / 10
  };
};
