/**
 * scoring.js - Multi-factor quantitative scoring for companies:
 *
 * companyScore = 40% * 30-day return rank
 *              + 25% * Sharpe rank
 *              + 20% * inverse-volatility rank
 *              + 15% * inverse-max-drawdown rank
 *
 * Higher score is better (percentile ranks scaled 0 to 100).
 * Returns sector rank, overall rank, and component breakdown.
 */

import { logReturns, sampleStd } from './returns.js';
import { sharpeRatio, maxDrawdown } from './risk.js';

/**
 * Computes fractional / percentile ranks for an array of values in [0, 100].
 * By default, higher value = higher percentile rank (higher is better).
 * If ascending = true, lower value = higher percentile rank (e.g. for volatility or drawdown).
 *
 * @param {Array<{ id: any, val: number }>} items
 * @param {boolean} [invert=false] - If true, smaller is better (e.g. lower vol gets rank 100)
 * @returns {Map<any, number>} Map from item id to percentile rank [0, 100]
 */
function computePercentileRanks(items, invert = false) {
  const n = items.length;
  if (n === 0) return new Map();
  if (n === 1) return new Map([[items[0].id, 100]]);

  // Sort: if not invert, ascending values get ascending ranks (largest gets highest rank)
  // If invert, largest value gets smallest rank (smallest value gets highest rank)
  const sorted = [...items].sort((a, b) => a.val - b.val);
  const ranks = new Map();

  for (let i = 0; i < n; i++) {
    // Percentile rank between 0 and 100: (index / (n - 1)) * 100
    const rankPercentile = (i / (n - 1)) * 100;
    const finalRank = invert ? 100 - rankPercentile : rankPercentile;
    ranks.set(sorted[i].id, finalRank);
  }

  return ranks;
}

/**
 * Evaluates company scores across a universe of companies:
 * Each company object has: { id, symbol, sector, prices: number[] }
 *
 * @param {Array<{ id: any, symbol: string, sector: string, prices: number[] }>} companies
 * @param {Object} [weights]
 * @param {number} [weights.wReturn=0.40]
 * @param {number} [weights.wSharpe=0.25]
 * @param {number} [weights.wInvVol=0.20]
 * @param {number} [weights.wInvMdd=0.15]
 * @returns {Array<{
 *   id: any,
 *   symbol: string,
 *   sector: string,
 *   score: number,
 *   overallRank: number,
 *   sectorRank: number,
 *   components: {
 *     return30d: number,
 *     returnRank: number,
 *     sharpe: number,
 *     sharpeRank: number,
 *     volatility: number,
 *     invVolRank: number,
 *     maxDrawdown: number,
 *     invMddRank: number
 *   }
 * }>}
 */
export function scoreCompanies(
  companies,
  {
    wReturn = 0.40,
    wSharpe = 0.25,
    wInvVol = 0.20,
    wInvMdd = 0.15
  } = {}
) {
  if (!Array.isArray(companies) || companies.length === 0) return [];

  // Compute raw metrics for each company
  const rawMetrics = companies.map((c) => {
    const prices = c.prices || [];
    const len = prices.length;

    // 30-day return (using last 30 prices if available)
    let ret30 = 0;
    if (len >= 2) {
      const startP = len > 30 ? prices[len - 31] : prices[0];
      const endP = prices[len - 1];
      ret30 = startP > 0 ? (endP - startP) / startP : 0;
    }

    // Daily returns for Sharpe and Volatility
    const dailyR = logReturns(prices.slice(-30));
    const sharpe = sharpeRatio(dailyR, 0.06);
    const vol = sampleStd(dailyR) * Math.sqrt(252);
    const mdd = maxDrawdown(prices.slice(-30)).value;

    return {
      id: c.id ?? c.symbol,
      symbol: c.symbol,
      sector: c.sector || 'General',
      ret30,
      sharpe,
      vol,
      mdd
    };
  });

  // Compute percentile ranks across universe
  const returnRanks = computePercentileRanks(rawMetrics.map((m) => ({ id: m.id, val: m.ret30 })), false);
  const sharpeRanks = computePercentileRanks(rawMetrics.map((m) => ({ id: m.id, val: m.sharpe })), false);
  const invVolRanks = computePercentileRanks(rawMetrics.map((m) => ({ id: m.id, val: m.vol })), true);
  const invMddRanks = computePercentileRanks(rawMetrics.map((m) => ({ id: m.id, val: m.mdd })), true);

  // Combine weighted components
  const scored = rawMetrics.map((m) => {
    const rRank = returnRanks.get(m.id) ?? 50;
    const sRank = sharpeRanks.get(m.id) ?? 50;
    const vRank = invVolRanks.get(m.id) ?? 50;
    const mRank = invMddRanks.get(m.id) ?? 50;

    const totalScore = wReturn * rRank + wSharpe * sRank + wInvVol * vRank + wInvMdd * mRank;

    return {
      id: m.id,
      symbol: m.symbol,
      sector: m.sector,
      score: Math.round(totalScore * 100) / 100,
      components: {
        return30d: Math.round(m.ret30 * 10000) / 10000,
        returnRank: Math.round(rRank * 10) / 10,
        sharpe: Math.round(m.sharpe * 100) / 100,
        sharpeRank: Math.round(sRank * 10) / 10,
        volatility: Math.round(m.vol * 10000) / 10000,
        invVolRank: Math.round(vRank * 10) / 10,
        maxDrawdown: Math.round(m.mdd * 10000) / 10000,
        invMddRank: Math.round(mRank * 10) / 10
      }
    };
  });

  // Assign overall ranks (1 = highest score)
  scored.sort((a, b) => b.score - a.score);
  scored.forEach((item, index) => {
    item.overallRank = index + 1;
  });

  // Assign sector ranks
  const sectorGroups = new Map();
  for (const item of scored) {
    if (!sectorGroups.has(item.sector)) sectorGroups.set(item.sector, []);
    sectorGroups.get(item.sector).push(item);
  }

  for (const group of sectorGroups.values()) {
    group.sort((a, b) => b.score - a.score);
    group.forEach((item, idx) => {
      item.sectorRank = idx + 1;
    });
  }

  return scored;
}
