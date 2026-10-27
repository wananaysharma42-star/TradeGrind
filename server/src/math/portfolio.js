/**
 * portfolio.js - Portfolio mathematical calculations:
 * portfolioValue, unrealisedPnL, realisedPnL (average cost), allocation %,
 * portfolio volatility via covariance matrix of daily returns, and equity curve from snapshots.
 */

import { sampleStd, mean } from './returns.js';

/**
 * Calculates current portfolio value from cash and holdings:
 * \text{Value} = \text{Cash} + \sum_{i} Q_i \cdot P_i
 *
 * @param {number} cash
 * @param {Array<{ quantity: number, currentPrice: number }>} holdings
 * @returns {number}
 */
export function portfolioValue(cash, holdings = []) {
  const stockValue = holdings.reduce((sum, h) => sum + (h.quantity || 0) * (h.currentPrice || 0), 0);
  return cash + stockValue;
}

/**
 * Calculates unrealised P&L for a single holding or array of holdings:
 * \text{UnrealisedPnL} = \sum_{i} Q_i \cdot (P_i - \text{avgCost}_i)
 *
 * @param {Array<{ quantity: number, currentPrice: number, avgCost: number }>} holdings
 * @returns {{ absolutePnL: number, percentPnL: number }}
 */
export function unrealisedPnL(holdings = []) {
  let totalCost = 0;
  let totalCurrent = 0;

  for (const h of holdings) {
    const q = h.quantity || 0;
    const cost = q * (h.avgCost || h.avgBuyPrice || 0);
    const curr = q * (h.currentPrice || 0);
    totalCost += cost;
    totalCurrent += curr;
  }

  const absolutePnL = totalCurrent - totalCost;
  const percentPnL = totalCost > 0 ? (absolutePnL / totalCost) * 100 : 0;

  return { absolutePnL, percentPnL };
}

/**
 * Calculates realised P&L from a sell transaction under average cost method:
 * \text{RealisedPnL} = Q_{\text{sold}} \cdot (P_{\text{sell}} - \text{avgCost})
 *
 * @param {number} quantitySold
 * @param {number} sellPrice
 * @param {number} avgCost
 * @returns {number} Realised P&L
 */
export function realisedPnL(quantitySold, sellPrice, avgCost) {
  if (quantitySold <= 0) return 0;
  return quantitySold * (sellPrice - avgCost);
}

/**
 * Calculates asset allocation percentage for each holding and cash:
 * w_i = \frac{\text{Value}_i}{\text{Total Portfolio Value}} \cdot 100
 *
 * @param {number} cash
 * @param {Array<{ id: any, symbol?: string, quantity: number, currentPrice: number }>} holdings
 * @returns {Array<{ id: any, symbol?: string, value: number, weightPct: number }>}
 */
export function allocationPercent(cash, holdings = []) {
  const totalVal = portfolioValue(cash, holdings);
  const items = [];

  if (totalVal <= 0) {
    items.push({ id: 'cash', symbol: 'CASH', value: cash, weightPct: 100 });
    return items;
  }

  items.push({
    id: 'cash',
    symbol: 'CASH',
    value: cash,
    weightPct: (cash / totalVal) * 100
  });

  for (const h of holdings) {
    const val = (h.quantity || 0) * (h.currentPrice || 0);
    items.push({
      id: h.id ?? h.symbol,
      symbol: h.symbol,
      value: val,
      weightPct: (val / totalVal) * 100
    });
  }

  return items;
}

/**
 * Calculates Portfolio Volatility via the Covariance Matrix of asset daily returns:
 *
 * \sigma_p^2 = \mathbf{w}^T \mathbf{\Sigma} \mathbf{w} = \sum_{i} \sum_{j} w_i w_j \text{Cov}(R_i, R_j)
 * \sigma_{p, \text{annual}} = \sqrt{\sigma_p^2} \cdot \sqrt{252}
 *
 * @param {number[]} weights - Vector of asset weights (normalized so sum = 1, excluding cash)
 * @param {number[][]} returnsMatrix - 2D array where each row/column is an asset's array of daily returns (length N)
 * @param {number} [tradingDays=252]
 * @returns {number} Annualized portfolio volatility
 */
export function portfolioVolatility(weights, returnsMatrix, tradingDays = 252) {
  const k = weights.length;
  if (k === 0 || !returnsMatrix || returnsMatrix.length !== k) return 0;
  if (k === 1) {
    const vol = sampleStd(returnsMatrix[0]);
    return vol * Math.sqrt(tradingDays) * Math.abs(weights[0]);
  }

  const n = returnsMatrix[0].length;
  if (n < 2) return 0;

  // Means of each asset
  const means = returnsMatrix.map((r) => mean(r));

  // Compute Covariance Matrix: Cov(i, j) = \frac{1}{n-1} \sum_{t=1}^n (r_{i,t} - \bar{r}_i)(r_{j,t} - \bar{r}_j)
  const covMatrix = Array.from({ length: k }, () => new Float64Array(k));

  for (let i = 0; i < k; i++) {
    for (let j = i; j < k; j++) {
      let sumProd = 0;
      for (let t = 0; t < n; t++) {
        sumProd += (returnsMatrix[i][t] - means[i]) * (returnsMatrix[j][t] - means[j]);
      }
      const cov = sumProd / (n - 1);
      covMatrix[i][j] = cov;
      covMatrix[j][i] = cov;
    }
  }

  // Compute portfolio variance: w^T * Cov * w
  let portfolioVar = 0;
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      portfolioVar += weights[i] * weights[j] * covMatrix[i][j];
    }
  }

  if (portfolioVar <= 0) return 0;
  return Math.sqrt(portfolioVar) * Math.sqrt(tradingDays);
}

/**
 * Builds an equity curve and cumulative returns from historical portfolio snapshots:
 *
 * @param {Array<{ simDay: number, totalValue: number, cash?: number, timestamp?: Date }>} snapshots
 * @returns {Array<{ simDay: number, totalValue: number, dailyReturn: number, cumulativeReturn: number }>}
 */
export function equityCurve(snapshots = []) {
  if (!Array.isArray(snapshots) || snapshots.length === 0) return [];
  const sorted = [...snapshots].sort((a, b) => a.simDay - b.simDay);
  const initialValue = sorted[0].totalValue || 1;

  const curve = [];
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    const prev = i > 0 ? sorted[i - 1] : null;
    const dailyReturn = prev && prev.totalValue > 0
      ? (cur.totalValue - prev.totalValue) / prev.totalValue
      : 0;
    const cumulativeReturn = (cur.totalValue - initialValue) / initialValue;

    curve.push({
      simDay: cur.simDay,
      totalValue: cur.totalValue,
      dailyReturn,
      cumulativeReturn
    });
  }

  return curve;
}
