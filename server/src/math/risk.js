/**
 * risk.js - Pure functions for portfolio and asset risk metrics:
 * Max Drawdown, Sharpe, Sortino, VaR, Expected Shortfall (CVaR), Beta, and Rolling Volatility.
 */

import { normalCdf } from './normal.js';
import { sampleStd, mean } from './returns.js';
import { TIME_CONFIG } from '../config/time.js';

/**
 * Calculates Maximum Drawdown and peak/trough indices from a price series:
 * MDD = \max_{t} [ (peak_t - price_t) / peak_t ]
 *
 * @param {number[]} prices - Array of historical prices or equity values
 * @returns {{ value: number, peakIndex: number, troughIndex: number }}
 */
export function maxDrawdown(prices) {
  if (!prices || prices.length < 2) {
    return { value: 0, peakIndex: 0, troughIndex: 0 };
  }

  let maxDd = 0;
  let peak = prices[0];
  let peakIdx = 0;
  let bestPeakIdx = 0;
  let troughIdx = 0;

  for (let i = 0; i < prices.length; i++) {
    const p = prices[i];
    if (p > peak) {
      peak = p;
      peakIdx = i;
    } else {
      const dd = peak > 0 ? (peak - p) / peak : 0;
      if (dd > maxDd) {
        maxDd = dd;
        bestPeakIdx = peakIdx;
        troughIdx = i;
      }
    }
  }

  return {
    value: maxDd,
    peakIndex: bestPeakIdx,
    troughIndex: troughIdx
  };
}

/**
 * Calculates Annualized Sharpe Ratio from daily returns:
 * Sharpe = \frac{\bar{r}_{daily} \cdot 252 - r_{f, annual}}{\text{std}(r_{daily}) \cdot \sqrt{252}}
 *
 * @param {number[]} dailyReturns - Array of daily returns
 * @param {number} [rfAnnual=0.06] - Annual risk-free rate (default 6%)
 * @param {number} [tradingDays=252] - Trading days per year
 * @returns {number} Annualized Sharpe Ratio
 */
export function sharpeRatio(dailyReturns, rfAnnual = 0.06, tradingDays = TIME_CONFIG.DAYS_PER_YEAR) {
  if (!dailyReturns || dailyReturns.length < 2) return 0;
  const vol = sampleStd(dailyReturns);
  if (vol <= 1e-12) return 0;

  const avgDaily = mean(dailyReturns);
  const annualizedReturn = avgDaily * tradingDays;
  const annualizedVol = vol * Math.sqrt(tradingDays);

  return (annualizedReturn - rfAnnual) / annualizedVol;
}

/**
 * Calculates Annualized Sortino Ratio using downside semi-deviation below minimum acceptable return (MAR):
 * DownsideDev = \sqrt{ \frac{1}{N} \sum_{i=1}^N \min(0, r_i - r_{f, daily})^2 }
 * Sortino = \frac{\bar{r}_{daily} \cdot 252 - r_{f, annual}}{\text{DownsideDev} \cdot \sqrt{252}}
 *
 * @param {number[]} dailyReturns - Array of daily returns
 * @param {number} [rfAnnual=0.06] - Annual risk-free rate
 * @param {number} [tradingDays=252] - Trading days per year
 * @returns {number} Annualized Sortino Ratio
 */
export function sortinoRatio(dailyReturns, rfAnnual = 0.06, tradingDays = TIME_CONFIG.DAYS_PER_YEAR) {
  if (!dailyReturns || dailyReturns.length < 2) return 0;
  const rfDaily = rfAnnual / tradingDays;

  let sumDownsideSq = 0;
  for (let i = 0; i < dailyReturns.length; i++) {
    const diff = dailyReturns[i] - rfDaily;
    if (diff < 0) {
      sumDownsideSq += diff * diff;
    }
  }

  const downsideDev = Math.sqrt(sumDownsideSq / dailyReturns.length);
  if (downsideDev <= 1e-12) return 0;

  const avgDaily = mean(dailyReturns);
  const annualizedReturn = avgDaily * tradingDays;
  const annualizedDownside = downsideDev * Math.sqrt(tradingDays);

  return (annualizedReturn - rfAnnual) / annualizedDownside;
}

/**
 * Calculates Value at Risk (VaR) via closed-form lognormal model AND historical simulation:
 *
 * 1. Lognormal closed form:
 *    Under GBM, S_T = S_0 * exp((mu - 0.5*sigma^2)*T + sigma*sqrt(T)*Z)
 *    The alpha-quantile price is S_alpha = S_0 * exp((mu - 0.5*sigma^2)*T + sigma*sqrt(T)*z_alpha)
 *    Loss = portfolioValue - S_alpha
 * 2. Historical simulation:
 *    Sort returns ascending. The alpha quantile return r_alpha gives loss = portfolioValue * (1 - exp(r_alpha)) (or -r_alpha * V).
 *
 * @param {Object} params
 * @param {number} params.portfolioValue - Current portfolio/position value
 * @param {number[]} [params.historicalReturns] - Array of historical returns
 * @param {number} [params.mu] - Annual drift
 * @param {number} [params.sigma] - Annual volatility
 * @param {number} [params.confidence=0.95] - Confidence level (e.g. 0.95)
 * @param {number} [params.horizonDays=1] - Horizon in trading days
 * @returns {{ closedFormVaR: number, historicalVaR: number }}
 */
export function valueAtRisk({
  portfolioValue,
  historicalReturns = [],
  mu = 0.1,
  sigma = 0.2,
  confidence = 0.95,
  horizonDays = 1
}) {
  const alpha = 1 - confidence; // e.g. 0.05
  const T = horizonDays / TIME_CONFIG.DAYS_PER_YEAR;

  // Lognormal closed-form VaR
  // Find z_alpha such that normalCdf(z_alpha) = alpha
  // Rational approximation for inverse standard normal
  const zAlpha = inverseNormalCdf(alpha);
  const logPriceRatio = (mu - 0.5 * sigma * sigma) * T + sigma * Math.sqrt(T) * zAlpha;
  const terminalRatio = Math.exp(logPriceRatio);
  const closedFormVaR = Math.max(0, portfolioValue * (1 - terminalRatio));

  // Historical simulation VaR
  let historicalVaR = 0;
  if (Array.isArray(historicalReturns) && historicalReturns.length > 0) {
    const sorted = [...historicalReturns].sort((a, b) => a - b);
    const index = Math.floor(alpha * sorted.length);
    const qReturn = sorted[Math.min(index, sorted.length - 1)];
    // Loss is positive dollar amount
    historicalVaR = Math.max(0, portfolioValue * (1 - Math.exp(qReturn * Math.sqrt(horizonDays))));
  }

  return { closedFormVaR, historicalVaR };
}

/**
 * Expected Shortfall (CVaR) - the average loss given that the loss exceeds VaR:
 * ES_alpha = E[Loss | Loss >= VaR]
 *
 * @param {Object} params
 * @param {number} params.portfolioValue
 * @param {number[]} params.historicalReturns
 * @param {number} [params.confidence=0.95]
 * @param {number} [params.horizonDays=1]
 * @returns {number} Expected shortfall in currency
 */
export function expectedShortfall({
  portfolioValue,
  historicalReturns,
  confidence = 0.95,
  horizonDays = 1
}) {
  if (!historicalReturns || historicalReturns.length === 0 || portfolioValue <= 0) return 0;
  const alpha = 1 - confidence;
  const sorted = [...historicalReturns].sort((a, b) => a - b);
  const cutoffIndex = Math.max(1, Math.floor(alpha * sorted.length));
  const tail = sorted.slice(0, cutoffIndex);

  const meanTailReturn = mean(tail);
  return Math.max(0, portfolioValue * (1 - Math.exp(meanTailReturn * Math.sqrt(horizonDays))));
}

/**
 * Computes Beta of asset returns relative to market returns (e.g. equal-weight market return):
 * \beta = \frac{\text{Cov}(R_a, R_m)}{\text{Var}(R_m)}
 *
 * @param {number[]} assetReturns
 * @param {number[]} marketReturns
 * @returns {number} Beta
 */
export function beta(assetReturns, marketReturns) {
  if (!assetReturns || !marketReturns) return 1.0;
  const n = Math.min(assetReturns.length, marketReturns.length);
  if (n < 3) return 1.0;

  const aMean = mean(assetReturns.slice(0, n));
  const mMean = mean(marketReturns.slice(0, n));

  let cov = 0;
  let varM = 0;

  for (let i = 0; i < n; i++) {
    const da = assetReturns[i] - aMean;
    const dm = marketReturns[i] - mMean;
    cov += da * dm;
    varM += dm * dm;
  }

  if (varM <= 1e-12) return 1.0;
  return cov / varM;
}

/**
 * Rolling annualized volatility across a moving window:
 * \sigma_{t} = \text{std}(r_{t-W+1 \dots t}) \cdot \sqrt{252}
 *
 * @param {number[]} logReturns
 * @param {number} window - Number of periods in rolling window
 * @param {number} [tradingDays=252]
 * @returns {number[]} Array of rolling volatilities (length = logReturns.length - window + 1)
 */
export function rollingVolatility(logReturns, window = 20, tradingDays = TIME_CONFIG.DAYS_PER_YEAR) {
  if (!logReturns || logReturns.length < window || window < 2) return [];
  const result = [];
  const sqrtAnnual = Math.sqrt(tradingDays);

  for (let i = window; i <= logReturns.length; i++) {
    const slice = logReturns.slice(i - window, i);
    result.push(sampleStd(slice) * sqrtAnnual);
  }

  return result;
}

/**
 * Inverse Standard Normal CDF (Acklam / Wichura algorithm approximation).
 * @param {number} p - Probability in (0, 1)
 * @returns {number} Z-score
 */
export function inverseNormalCdf(p) {
  if (p <= 0) return -8.0;
  if (p >= 1) return 8.0;
  if (p === 0.5) return 0;

  // Coefficients in rational approximations
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];

  const q = p < 0.5 ? p : 1 - p;
  let r, z;

  if (q > 0.02425) {
    r = q - 0.5;
    const r2 = r * r;
    z = (((((a[0] * r2 + a[1]) * r2 + a[2]) * r2 + a[3]) * r2 + a[4]) * r2 + a[5]) * r /
        (((((b[0] * r2 + b[1]) * r2 + b[2]) * r2 + b[3]) * r2 + b[4]) * r2 + 1);
  } else {
    r = Math.sqrt(-2 * Math.log(q));
    z = (((((c[0] * r + c[1]) * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) /
        ((((d[0] * r + d[1]) * r + d[2]) * r + d[3]) * r + 1);
    if (p < 0.5) z = -z;
  }

  return p < 0.5 ? -Math.abs(z) : Math.abs(z);
}
