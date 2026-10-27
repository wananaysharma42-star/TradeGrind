import { TIME_CONFIG } from '../config/time.js';

/**
 * Deterministic What-If scenario projection engine for Company role.
 * Calculates analytical price distributions, market cap projections, and sensitivity grids.
 * 
 * @param {Object} params
 * @param {number} params.currentPrice - Current stock price S_0
 * @param {number} params.mu - Baseline annualized drift (e.g. 0.12)
 * @param {number} params.sigma - Baseline annualized volatility (e.g. 0.22)
 * @param {number} params.sharesOutstanding - Number of shares (e.g. 100,000,000)
 * @param {number} [params.horizonDays=90] - Simulation horizon in trading days
 * @param {number} [params.deltaMu=0] - Drift change (e.g. +0.05 for +5%)
 * @param {number} [params.deltaSigma=0] - Volatility change (e.g. -0.02)
 * @param {number} [params.shareAdjustmentPercent=0] - e.g. +10 for 10% dilution, -5 for buyback
 * @param {number} [params.dividendPerShare=0] - Cash dividend per share
 * @returns {Object} Comprehensive deterministic scenario projection
 */
export function runWhatIfSimulation({
  currentPrice,
  mu,
  sigma,
  sharesOutstanding,
  horizonDays = 90,
  deltaMu = 0,
  deltaSigma = 0,
  shareAdjustmentPercent = 0,
  dividendPerShare = 0
}) {
  const adjustedMu = mu + deltaMu;
  const adjustedSigma = Math.max(0.02, sigma + deltaSigma);
  
  // Post-dividend base price
  const basePriceAfterDividend = Math.max(0.01, currentPrice - dividendPerShare);
  const adjustedShares = Math.max(1, Math.round(sharesOutstanding * (1 + shareAdjustmentPercent / 100)));
  const baseMarketCap = currentPrice * sharesOutstanding;

  // Generate projection points (every ~5% of horizon or at least 15 points)
  const stepDays = Math.max(1, Math.floor(horizonDays / 20));
  const trajectory = [];

  const z10 = -1.28155; // 10th percentile
  const z90 = 1.28155;  // 90th percentile

  for (let day = 0; day <= horizonDays; day += stepDays) {
    const t = day / TIME_CONFIG.DAYS_PER_YEAR; // in years
    const sqrtT = Math.sqrt(t);
    const logDrift = (adjustedMu - 0.5 * adjustedSigma * adjustedSigma) * t;

    const pMedian = day === 0 ? basePriceAfterDividend : basePriceAfterDividend * Math.exp(logDrift);
    const p10 = day === 0 ? basePriceAfterDividend : basePriceAfterDividend * Math.exp(logDrift + z10 * adjustedSigma * sqrtT);
    const p90 = day === 0 ? basePriceAfterDividend : basePriceAfterDividend * Math.exp(logDrift + z90 * adjustedSigma * sqrtT);
    const pExpected = day === 0 ? basePriceAfterDividend : basePriceAfterDividend * Math.exp(adjustedMu * t);

    trajectory.push({
      day,
      p10: Math.round(p10 * 100) / 100,
      p50: Math.round(pMedian * 100) / 100,
      p90: Math.round(p90 * 100) / 100,
      pExpected: Math.round(pExpected * 100) / 100,
      marketCap50: Math.round(pMedian * adjustedShares),
      marketCapExpected: Math.round(pExpected * adjustedShares)
    });
  }

  // Final horizon values
  const finalPoint = trajectory[trajectory.length - 1];
  const projectedMarketCap = finalPoint.marketCapExpected;
  const marketCapChangePercent = baseMarketCap > 0 
    ? Math.round(((projectedMarketCap - baseMarketCap) / baseMarketCap) * 10000) / 100
    : 0;

  // Sensitivity Matrix (5x5 grid of deltaMu vs deltaSigma)
  const dMuRange = [-0.08, -0.04, 0, 0.04, 0.08];
  const dSigmaRange = [-0.06, -0.03, 0, 0.03, 0.06];
  const horizonYears = horizonDays / TIME_CONFIG.DAYS_PER_YEAR;

  const sensitivityMatrix = dMuRange.map(dm => {
    const testMu = mu + dm;
    return dSigmaRange.map(ds => {
      const testSig = Math.max(0.02, sigma + ds);
      const testLogDrift = (testMu - 0.5 * testSig * testSig) * horizonYears;
      const expectedP = basePriceAfterDividend * Math.exp(testMu * horizonYears);
      const medianP = basePriceAfterDividend * Math.exp(testLogDrift);
      return {
        deltaMu: dm,
        deltaSigma: ds,
        expectedPrice: Math.round(expectedP * 100) / 100,
        medianPrice: Math.round(medianP * 100) / 100,
        expectedMarketCap: Math.round(expectedP * adjustedShares)
      };
    });
  });

  return {
    horizonDays,
    baseline: {
      price: currentPrice,
      mu,
      sigma,
      shares: sharesOutstanding,
      marketCap: baseMarketCap
    },
    scenario: {
      adjustedMu,
      adjustedSigma,
      adjustedShares,
      dividendPerShare,
      shareAdjustmentPercent,
      totalDividendCost: dividendPerShare * sharesOutstanding
    },
    projected: {
      terminalExpectedPrice: finalPoint.pExpected,
      terminalMedianPrice: finalPoint.p50,
      terminalP10: finalPoint.p10,
      terminalP90: finalPoint.p90,
      projectedMarketCap,
      marketCapChangePercent
    },
    trajectory,
    sensitivityMatrix
  };
}
