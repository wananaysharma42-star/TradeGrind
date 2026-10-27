/**
 * Pure Technical Analysis indicator calculations.
 */

/**
 * Simple Moving Average (SMA).
 * @param {number[]} prices
 * @param {number} period
 * @returns {number|null} Current SMA value or null if insufficient data
 */
export function calculateSma(prices, period) {
  if (!prices || prices.length < period || period <= 0) return null;
  const slice = prices.slice(-period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return Math.round((sum / period) * 100) / 100;
}

/**
 * Exponential Moving Average (EMA).
 * @param {number[]} prices
 * @param {number} period
 * @returns {number|null}
 */
export function calculateEma(prices, period) {
  if (!prices || prices.length < period || period <= 0) return null;
  const k = 2 / (period + 1);
  // Initial EMA is SMA of first `period` elements
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return Math.round(ema * 100) / 100;
}

/**
 * Relative Strength Index (RSI).
 * Standard Wilder's RSI calculation (14 periods).
 * @param {number[]} prices
 * @param {number} [period=14]
 * @returns {number} RSI between 0 and 100 (50 if insufficient data)
 */
export function calculateRsi(prices, period = 14) {
  if (!prices || prices.length <= period) return 50.0;

  let gains = 0;
  let losses = 0;

  // First period
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // Subsequent periods (Wilder's smoothing)
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100.0;
  const rs = avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);
  return Math.round(rsi * 10) / 10;
}

/**
 * MACD: 12 EMA, 26 EMA, 9 Signal.
 * @param {number[]} prices
 * @returns {{ macd: number, signal: number, histogram: number }}
 */
export function calculateMacd(prices) {
  if (!prices || prices.length < 26) {
    return { macd: 0, signal: 0, histogram: 0 };
  }

  const ema12 = calculateEma(prices, 12) || prices[prices.length - 1];
  const ema26 = calculateEma(prices, 26) || prices[prices.length - 1];
  const macd = Math.round((ema12 - ema26) * 100) / 100;

  // Calculate macd history for signal line if possible
  const macdHistory = [];
  const start = Math.max(0, prices.length - 35);
  for (let i = start + 26; i <= prices.length; i++) {
    const sub = prices.slice(0, i);
    const e12 = calculateEma(sub, 12);
    const e26 = calculateEma(sub, 26);
    if (e12 !== null && e26 !== null) {
      macdHistory.push(e12 - e26);
    }
  }

  let signal = macd;
  if (macdHistory.length >= 9) {
    signal = calculateEma(macdHistory, 9) || macd;
  }
  const histogram = Math.round((macd - signal) * 100) / 100;

  return { macd, signal, histogram };
}

/**
 * Bollinger Bands (20 periods, 2 standard deviations).
 * @param {number[]} prices
 * @param {number} [period=20]
 * @param {number} [multiplier=2]
 * @returns {{ middle: number, upper: number, lower: number, bandwidth: number }|null}
 */
export function calculateBollingerBands(prices, period = 20, multiplier = 2) {
  if (!prices || prices.length < period) return null;

  const slice = prices.slice(-period);
  const middle = slice.reduce((a, b) => a + b, 0) / period;
  
  const variance = slice.reduce((acc, p) => acc + Math.pow(p - middle, 2), 0) / period;
  const std = Math.sqrt(variance);

  const upper = Math.round((middle + multiplier * std) * 100) / 100;
  const lower = Math.round(Math.max(0, middle - multiplier * std) * 100) / 100;
  const mid = Math.round(middle * 100) / 100;
  const bandwidth = mid > 0 ? Math.round(((upper - lower) / mid) * 1000) / 10 : 0;

  return {
    middle: mid,
    upper,
    lower,
    bandwidth
  };
}
