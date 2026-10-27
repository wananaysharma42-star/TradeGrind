import { TIME_CONFIG } from '../config/time.js';

/**
 * Calculates log returns for a series of prices: r_t = ln(S_t / S_{t-1})
 * @param {number[]} prices
 * @returns {number[]}
 */
export function calculateReturns(prices) {
  if (!prices || prices.length < 2) return [];
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
 * Calculates mean of an array of numbers.
 * @param {number[]} values
 * @returns {number}
 */
export function calculateMean(values) {
  if (!values || values.length === 0) return 0;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return sum / values.length;
}

/**
 * Calculates variance of an array of numbers.
 * @param {number[]} values
 * @param {boolean} [isSample=true] - true for sample variance (n-1), false for population (n)
 * @returns {number}
 */
export function calculateVariance(values, isSample = true) {
  if (!values || values.length < (isSample ? 2 : 1)) return 0;
  const mean = calculateMean(values);
  const sumSq = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0);
  const divisor = isSample ? values.length - 1 : values.length;
  return sumSq / divisor;
}

/**
 * Calculates standard deviation.
 * @param {number[]} values
 * @param {boolean} [isSample=true]
 * @returns {number}
 */
export function calculateStdDev(values, isSample = true) {
  return Math.sqrt(calculateVariance(values, isSample));
}

/**
 * Annualizes a per-tick volatility.
 * sigma_ann = sigma_tick * sqrt(ticks_per_year)
 * @param {number} tickVol
 * @returns {number}
 */
export function annualizeTickVolatility(tickVol) {
  return tickVol * Math.sqrt(TIME_CONFIG.TICKS_PER_YEAR);
}

/**
 * Computes Beta of asset returns relative to market benchmark returns.
 * Beta = Cov(Ra, Rm) / Var(Rm)
 * @param {number[]} assetReturns
 * @param {number[]} marketReturns
 * @returns {number}
 */
export function calculateBeta(assetReturns, marketReturns) {
  const n = Math.min(assetReturns.length, marketReturns.length);
  if (n < 3) return 1.0; // Default benchmark beta

  const assetMean = calculateMean(assetReturns.slice(0, n));
  const marketMean = calculateMean(marketReturns.slice(0, n));

  let cov = 0;
  let varMarket = 0;

  for (let i = 0; i < n; i++) {
    const da = assetReturns[i] - assetMean;
    const dm = marketReturns[i] - marketMean;
    cov += da * dm;
    varMarket += dm * dm;
  }

  if (varMarket === 0) return 1.0;
  return Math.round((cov / varMarket) * 100) / 100;
}

/**
 * Computes the Sharpe Ratio: (Rp - Rf) / sigma_p
 * @param {number} annualizedReturn - Portfolio annualized return (e.g. 0.15 for 15%)
 * @param {number} annualizedVol - Portfolio annualized volatility (e.g. 0.20 for 20%)
 * @param {number} [riskFreeRate=0.065] - Annual risk free rate (6.5% standard Indian repo rate)
 * @returns {number}
 */
export function calculateSharpeRatio(annualizedReturn, annualizedVol, riskFreeRate = 0.065) {
  if (annualizedVol <= 0.0001) return 0;
  const ratio = (annualizedReturn - riskFreeRate) / annualizedVol;
  return Math.round((ratio + Number.EPSILON) * 100) / 100;
}

/**
 * Computes 1-day Parametric Value at Risk (VaR 95%).
 * VaR_95 = 1.64485 * sigma_daily * portfolioValue
 * @param {number} portfolioValue
 * @param {number} annualizedVol
 * @returns {number} VaR in rupees
 */
export function calculateVaR95(portfolioValue, annualizedVol) {
  if (portfolioValue <= 0 || annualizedVol <= 0) return 0;
  const dailyVol = annualizedVol / Math.sqrt(TIME_CONFIG.DAYS_PER_YEAR);
  const z95 = 1.64485;
  const varAmount = portfolioValue * dailyVol * z95;
  return Math.round(varAmount);
}
