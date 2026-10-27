/**
 * company.routes.js - COMPANY Backend Endpoints:
 * - Scoped to user's own stock (ownerCompany === req.user._id or companyUserId === req.user._id)
 * - requireRole('COMPANY')
 *
 * Routes:
 * - GET /api/company/home
 * - GET /api/company/profit-analytics?compare=SYM1,SYM2
 * - GET /api/company/customers?category=all|new|long-term|profit|loss|high-volume
 * - GET /api/company/customers/trend
 * - POST /api/company/simulate
 * - POST /api/company/simulate/save
 * - GET /api/company/simulations
 * - DELETE /api/company/simulations/:id
 */

import express from 'express';
import { z } from 'zod';
import { Stock } from '../models/Stock.js';
import { DailyCandle } from '../models/DailyCandle.js';
import { PriceTick } from '../models/PriceTick.js';
import { Holding } from '../models/Holding.js';
import { Transaction } from '../models/Transaction.js';
import { Scenario } from '../models/Scenario.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { getMarketEngine } from '../services/marketEngine.js';
import { scoreCompanies } from '../math/scoring.js';
import { logReturns, sampleStd, mean, blendedParams } from '../math/returns.js';
import { maxDrawdown, sharpeRatio, sortinoRatio, valueAtRisk, expectedShortfall, rollingVolatility } from '../math/risk.js';
import { standardNormal } from '../math/normal.js';
import { TIME_CONFIG } from '../config/time.js';

const router = express.Router();

// Apply COMPANY role requirement across all routes in this file
router.use(authenticateToken, requireRole('COMPANY'));

/**
 * Resolves the authenticated COMPANY user's own stock.
 */
async function getCompanyStock(userId) {
  let stock = await Stock.findOne({ $or: [{ ownerCompany: userId }, { companyUserId: userId }] });
  if (!stock) {
    const { User } = await import('../models/User.js');
    const user = await User.findById(userId);
    if (user?.stockId) {
      stock = await Stock.findById(user.stockId);
    }
  }
  return stock;
}

// ==========================================
// 1. GET /api/company/home
// ==========================================
router.get('/home', async (req, res, next) => {
  try {
    const stock = await getCompanyStock(req.user._id);
    if (!stock) {
      return res.status(404).json({
        success: false,
        error: { code: 'STOCK_NOT_FOUND', message: 'No stock assigned to this company' }
      });
    }

    const engine = getMarketEngine();
    const live = engine?.getState(String(stock._id)) || engine?.getState(stock.symbol);
    const currentPrice = live ? live.price : stock.currentPrice;

    // Fetch last 30 daily candles
    const candles = await DailyCandle.find({ stockId: stock._id })
      .sort({ simDay: -1 })
      .limit(31)
      .lean();
    candles.reverse();

    const prices = candles.map((c) => c.close);
    const dailyReturns = logReturns(prices);

    // Last 10 simulated days insights table
    const last10Candles = candles.slice(-10);
    const last10Table = last10Candles.map((c, idx, arr) => {
      const prevClose = idx > 0 ? arr[idx - 1].close : c.open;
      const dayReturn = prevClose > 0 ? (c.close - prevClose) / prevClose : 0;
      const intradayVol = c.low > 0 ? (c.high - c.low) / c.low : 0;
      return {
        simDay: c.simDay,
        open: Math.round(c.open * 100) / 100,
        high: Math.round(c.high * 100) / 100,
        low: Math.round(c.low * 100) / 100,
        close: Math.round(c.close * 100) / 100,
        returnPercent: Math.round(dayReturn * 10000) / 100,
        volume: c.volume,
        volatilityPercent: Math.round(intradayVol * 10000) / 100
      };
    });

    // Sector & Overall scoring across universe of stocks
    const allStocks = await Stock.find().lean();
    const universePayload = await Promise.all(
      allStocks.map(async (s) => {
        const sCandles = await DailyCandle.find({ stockId: s._id })
          .sort({ simDay: -1 })
          .limit(31)
          .lean();
        const sPrices = sCandles.reverse().map((c) => c.close);
        return {
          id: String(s._id),
          symbol: s.symbol,
          sector: s.sector || 'General',
          prices: sPrices
        };
      })
    );

    const scored = scoreCompanies(universePayload);
    const myScore = scored.find((item) => item.id === String(stock._id) || item.symbol === stock.symbol) || {
      score: 50,
      overallRank: 1,
      sectorRank: 1,
      components: {}
    };

    // Key Risk Metrics
    const dt = 1 / TIME_CONFIG.DAYS_PER_YEAR;
    const { muAnnual, sigmaAnnual } = dailyReturns.length >= 2
      ? blendedParams(dailyReturns, dt, 0.94)
      : { muAnnual: stock.mu, sigmaAnnual: stock.sigma };

    const mddObj = maxDrawdown(prices);
    const sharpe = sharpeRatio(dailyReturns, 0.06);
    const sortino = sortinoRatio(dailyReturns, 0.06);

    const { closedFormVaR, historicalVaR } = valueAtRisk({
      portfolioValue: currentPrice,
      historicalReturns: dailyReturns,
      mu: muAnnual,
      sigma: sigmaAnnual,
      confidence: 0.95,
      horizonDays: 1
    });

    const es = expectedShortfall({
      portfolioValue: currentPrice,
      historicalReturns: dailyReturns,
      mu: muAnnual,
      sigma: sigmaAnnual,
      confidence: 0.95,
      horizonDays: 1
    });

    res.json({
      success: true,
      data: {
        stock: {
          id: stock._id,
          symbol: stock.symbol,
          name: stock.name,
          sector: stock.sector,
          currentPrice: Math.round(currentPrice * 100) / 100,
          previousClose: live?.previousClose || stock.previousClose,
          totalShares: stock.totalShares
        },
        livePriceSeries: live?.recentPrices?.map((p) => Math.round(p * 100) / 100) || [Math.round(currentPrice * 100) / 100],
        last10Days: last10Table,
        ranks: {
          overallRank: myScore.overallRank,
          totalCompanies: scored.length,
          sectorRank: myScore.sectorRank,
          score: Math.round(myScore.score * 10) / 10,
          components: myScore.components
        },
        riskMetrics: {
          estimatedVolatility: Math.round(sigmaAnnual * 10000) / 10000,
          estimatedDrift: Math.round(muAnnual * 10000) / 10000,
          maxDrawdown: Math.round(mddObj.value * 10000) / 10000,
          sharpeRatio: Math.round(sharpe * 100) / 100,
          sortinoRatio: Math.round(sortino * 100) / 100,
          valueAtRisk95_1Day: Math.round(closedFormVaR * 100) / 100,
          expectedShortfall95_1Day: Math.round((es.closedFormES || es.historicalES || closedFormVaR * 1.2) * 100) / 100
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 2. GET /api/company/profit-analytics
// ==========================================
router.get('/profit-analytics', async (req, res, next) => {
  try {
    const stock = await getCompanyStock(req.user._id);
    if (!stock) {
      return res.status(404).json({
        success: false,
        error: { code: 'STOCK_NOT_FOUND', message: 'Stock not found' }
      });
    }

    const compareSymbols = req.query.compare
      ? String(req.query.compare).split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
      : [];

    // Fetch all candles for own stock
    const ownCandles = await DailyCandle.find({ stockId: stock._id }).sort({ simDay: 1 }).lean();
    const ownPrices = ownCandles.map((c) => c.close);
    const S0 = ownPrices.length ? ownPrices[ownPrices.length - 1] : stock.currentPrice;

    // Price series rebased to 100
    const rebaseSeries = (series) => {
      if (!series.length) return [];
      const base = series[0];
      return series.map((p) => Math.round((p / base) * 100 * 100) / 100);
    };

    const rebasedComparison = [
      {
        symbol: stock.symbol,
        isOwn: true,
        series: rebaseSeries(ownPrices)
      }
    ];

    for (const sym of compareSymbols) {
      const cmpStock = await Stock.findOne({ symbol: sym });
      if (cmpStock) {
        const cmpCandles = await DailyCandle.find({ stockId: cmpStock._id }).sort({ simDay: 1 }).lean();
        rebasedComparison.push({
          symbol: cmpStock.symbol,
          isOwn: false,
          series: rebaseSeries(cmpCandles.map((c) => c.close))
        });
      }
    }

    // Monte Carlo fan chart for next 30 days
    const horizonDays = 30;
    const nPaths = 2000;
    const STEPS_PER_DAY = 1;
    const dt = 1 / TIME_CONFIG.DAYS_PER_YEAR;
    const sqrtDt = Math.sqrt(dt);

    const ownReturns = logReturns(ownPrices);
    const { muAnnual, sigmaAnnual } = ownReturns.length >= 2
      ? blendedParams(ownReturns, dt, 0.94)
      : { muAnnual: stock.mu, sigmaAnnual: stock.sigma };

    const drift = (muAnnual - 0.5 * sigmaAnnual * sigmaAnnual) * dt;
    const diffusion = sigmaAnnual * sqrtDt;

    const dailyPaths = Array.from({ length: horizonDays + 1 }, () => new Float64Array(nPaths));
    for (let p = 0; p < nPaths; p++) dailyPaths[0][p] = S0;

    let higherCount = 0;
    for (let p = 0; p < nPaths; p++) {
      let price = S0;
      for (let d = 1; d <= horizonDays; d++) {
        const Z = standardNormal();
        price *= Math.exp(drift + diffusion * Z);
        dailyPaths[d][p] = price;
      }
      if (price > S0) higherCount++;
    }

    const percentiles = { p5: [], p25: [], p50: [], p75: [], p95: [] };
    for (let d = 0; d <= horizonDays; d++) {
      const sorted = Float64Array.from(dailyPaths[d]).sort();
      percentiles.p5.push(Math.round(sorted[Math.floor(nPaths * 0.05)] * 100) / 100);
      percentiles.p25.push(Math.round(sorted[Math.floor(nPaths * 0.25)] * 100) / 100);
      percentiles.p50.push(Math.round(sorted[Math.floor(nPaths * 0.50)] * 100) / 100);
      percentiles.p75.push(Math.round(sorted[Math.floor(nPaths * 0.75)] * 100) / 100);
      percentiles.p95.push(Math.round(sorted[Math.floor(nPaths * 0.95)] * 100) / 100);
    }

    const probHigher = Math.round((higherCount / nPaths) * 10000) / 10000;

    // Life since listing
    const cumulativeReturn = ownPrices.length >= 2
      ? Math.round(((ownPrices[ownPrices.length - 1] - ownPrices[0]) / ownPrices[0]) * 10000) / 100
      : 0;

    // Drawdown series
    let peak = ownPrices[0] || 0;
    const drawdownSeries = ownPrices.map((p) => {
      if (p > peak) peak = p;
      return peak > 0 ? Math.round(((p - peak) / peak) * 10000) / 100 : 0;
    });

    const rollingVolSeries = rollingVolatility(ownReturns, 20).map((v) => Math.round(v * 10000) / 10000);

    res.json({
      success: true,
      data: {
        rebasedPriceSeries: rebasedComparison,
        fanChart30Days: {
          horizonDays,
          nPaths,
          probabilityHigher: probHigher,
          percentiles
        },
        lifeSinceListing: {
          totalDays: ownPrices.length,
          cumulativeReturnPercent: cumulativeReturn,
          drawdownSeries,
          rollingVolatilitySeries: rollingVolSeries
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 3. GET /api/company/customers
// ==========================================
router.get('/customers', async (req, res, next) => {
  try {
    const stock = await getCompanyStock(req.user._id);
    if (!stock) {
      return res.status(404).json({
        success: false,
        error: { code: 'STOCK_NOT_FOUND', message: 'Stock not found' }
      });
    }

    const category = req.query.category || 'all';
    const engine = getMarketEngine();
    const live = engine?.getState(String(stock._id)) || engine?.getState(stock.symbol);
    const currentPrice = live ? live.price : stock.currentPrice;
    const currentSimDay = engine?.globalTick ? Math.floor((engine.globalTick - 1) / TIME_CONFIG.TICKS_PER_DAY) + 1 : 30;

    const holdings = await Holding.find({ stockId: stock._id, quantity: { $gt: 0 } })
      .populate('userId', 'name email createdAt')
      .lean();

    // Fetch earliest and latest transaction for each holder to compute holding period and volume
    const enrichedHolders = await Promise.all(
      holdings.map(async (h) => {
        const uId = h.userId?._id || h.userId;
        const txs = await Transaction.find({ stockId: stock._id, userId: uId }).sort({ simDay: 1 }).lean();

        const earliestDay = txs.length ? txs[0].simDay : currentSimDay;
        const holdingPeriodDays = Math.max(1, currentSimDay - earliestDay + 1);
        const totalVolumeTraded = txs.reduce((sum, t) => sum + t.quantity, 0);

        const marketValue = h.quantity * currentPrice;
        const costBasis = h.quantity * h.avgBuyPrice;
        const unrealizedPnL = marketValue - costBasis;
        const unrealizedPnLPercent = costBasis > 0 ? (unrealizedPnL / costBasis) * 100 : 0;

        return {
          holderId: uId,
          name: h.userId?.name || 'Retail Investor',
          email: h.userId?.email || 'investor@tradesim.com',
          quantity: h.quantity,
          avgBuyPrice: Math.round(h.avgBuyPrice * 100) / 100,
          currentPrice: Math.round(currentPrice * 100) / 100,
          marketValue: Math.round(marketValue * 100) / 100,
          unrealizedPnL: Math.round(unrealizedPnL * 100) / 100,
          unrealizedPnLPercent: Math.round(unrealizedPnLPercent * 100) / 100,
          holdingPeriodDays,
          totalVolumeTraded,
          firstTradeSimDay: earliestDay
        };
      })
    );

    /**
     * Category Rules Documentation:
     * - 'all': All holders with positive share balance
     * - 'new': Holding period <= 3 simulated days
     * - 'long-term': Holding period >= 10 simulated days
     * - 'profit': Unrealized P&L > 0
     * - 'loss': Unrealized P&L < 0
     * - 'high-volume': Total volume traded in top 20% or >= 5,000 shares
     */
    const categoryRules = {
      all: 'All active holders with positive share balance',
      new: 'Holders who entered within the last 3 simulated days (holdingPeriodDays <= 3)',
      'long-term': 'Holders with holding period >= 10 simulated days',
      profit: 'Holders with positive unrealized P&L (marketValue > costBasis)',
      loss: 'Holders with negative unrealized P&L (marketValue < costBasis)',
      'high-volume': 'Holders with high trading activity (volume >= 5000 or top 20%)'
    };

    let filtered = enrichedHolders;
    if (category === 'new') {
      filtered = enrichedHolders.filter((h) => h.holdingPeriodDays <= 3);
    } else if (category === 'long-term') {
      filtered = enrichedHolders.filter((h) => h.holdingPeriodDays >= 10);
    } else if (category === 'profit') {
      filtered = enrichedHolders.filter((h) => h.unrealizedPnL > 0);
    } else if (category === 'loss') {
      filtered = enrichedHolders.filter((h) => h.unrealizedPnL < 0);
    } else if (category === 'high-volume') {
      filtered = enrichedHolders.filter((h) => h.totalVolumeTraded >= 5000 || h.quantity >= 5000);
    }

    res.json({
      success: true,
      data: {
        category,
        categoryRules,
        totalCount: filtered.length,
        holders: filtered
      }
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 4. GET /api/company/customers/trend
// ==========================================
router.get('/customers/trend', async (req, res, next) => {
  try {
    const stock = await getCompanyStock(req.user._id);
    if (!stock) {
      return res.status(404).json({
        success: false,
        error: { code: 'STOCK_NOT_FOUND', message: 'Stock not found' }
      });
    }

    const engine = getMarketEngine();
    const live = engine?.getState(String(stock._id)) || engine?.getState(stock.symbol);
    const currentPrice = live ? live.price : stock.currentPrice;

    // Daily buys vs sells aggregation
    const txAgg = await Transaction.aggregate([
      { $match: { stockId: stock._id } },
      {
        $group: {
          _id: { simDay: '$simDay', type: '$type' },
          count: { $sum: 1 },
          volume: { $sum: '$quantity' }
        }
      },
      { $sort: { '_id.simDay': 1 } }
    ]);

    const daysMap = new Map();
    for (const row of txAgg) {
      const day = row._id.simDay;
      if (!daysMap.has(day)) {
        daysMap.set(day, { simDay: day, buyCount: 0, buyVolume: 0, sellCount: 0, sellVolume: 0 });
      }
      const entry = daysMap.get(day);
      if (row._id.type === 'BUY') {
        entry.buyCount = row.count;
        entry.buyVolume = row.volume;
      } else if (row._id.type === 'SELL') {
        entry.sellCount = row.count;
        entry.sellVolume = row.volume;
      }
    }

    const dailyActivity = Array.from(daysMap.values()).sort((a, b) => a.simDay - b.simDay);

    // Holder profit rate histogram bins: [-50%, -25%), [-25%, 0%), [0%, 25%), [25%, 50%), [50%+]
    const holdings = await Holding.find({ stockId: stock._id, quantity: { $gt: 0 } }).lean();
    let totalBuyCost = 0;
    let totalShares = 0;

    const profitRates = holdings.map((h) => {
      totalBuyCost += h.quantity * h.avgBuyPrice;
      totalShares += h.quantity;
      return h.avgBuyPrice > 0 ? ((currentPrice - h.avgBuyPrice) / h.avgBuyPrice) * 100 : 0;
    });

    const avgBuyPrice = totalShares > 0 ? totalBuyCost / totalShares : currentPrice;

    const bins = [
      { range: '< -25%', min: -Infinity, max: -25, count: 0 },
      { range: '-25% to 0%', min: -25, max: 0, count: 0 },
      { range: '0% to +25%', min: 0, max: 25, count: 0 },
      { range: '+25% to +50%', min: 25, max: 50, count: 0 },
      { range: '> +50%', min: 50, max: Infinity, count: 0 }
    ];

    for (const rate of profitRates) {
      for (const b of bins) {
        if (rate >= b.min && rate < b.max) {
          b.count++;
          break;
        }
      }
    }

    res.json({
      success: true,
      data: {
        dailyActivity,
        priceComparison: {
          currentPrice: Math.round(currentPrice * 100) / 100,
          averageBuyPrice: Math.round(avgBuyPrice * 100) / 100
        },
        profitRateHistogram: bins
      }
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 5. POST /api/company/simulate (Monte Carlo with overrides & feasibility check)
// ==========================================
const simulateTestingSchema = z.object({
  horizonDays: z.number().int().min(5).max(365).default(30),
  mu: z.number().optional(),
  sigma: z.number().optional(),
  volatilityMultiplier: z.number().min(0.1).max(5).optional(),
  shocks: z.array(z.object({
    day: z.number().int().min(1),
    pct: z.number()
  })).default([]),
  targetPrice: z.number().optional(),
  nPaths: z.number().int().min(100).max(20000).default(3000),
  thresholds: z.object({
    minTargetProb: z.number().optional(), // e.g. 0.40
    maxLossProb: z.number().optional(),   // e.g. 0.25
    maxDrawdown: z.number().optional()    // e.g. 0.20
  }).default({})
});

/**
 * Runs a Monte Carlo simulation with optional daily shocks and parameter overrides.
 */
function runMonteCarloEngine({
  S0,
  mu,
  sigma,
  horizonDays,
  nPaths,
  shocks = [],
  targetPrice = null
}) {
  const dt = 1 / TIME_CONFIG.DAYS_PER_YEAR;
  const sqrtDt = Math.sqrt(dt);
  const drift = (mu - 0.5 * sigma * sigma) * dt;
  const diffusion = sigma * sqrtDt;

  const shockMap = new Map();
  for (const s of shocks) {
    shockMap.set(s.day, s.pct);
  }

  const dailyPaths = Array.from({ length: horizonDays + 1 }, () => new Float64Array(nPaths));
  for (let p = 0; p < nPaths; p++) dailyPaths[0][p] = S0;

  const terminalPrices = new Float64Array(nPaths);
  let targetHits = 0;
  let lossCount = 0;
  let totalTerminalReturn = 0;
  const pathDrawdowns = new Float64Array(nPaths);

  for (let p = 0; p < nPaths; p++) {
    let price = S0;
    let peak = S0;
    let mdd = 0;
    let hitTarget = targetPrice ? (targetPrice >= S0 ? price >= targetPrice : price <= targetPrice) : false;

    for (let day = 1; day <= horizonDays; day++) {
      const Z = standardNormal();
      price *= Math.exp(drift + diffusion * Z);

      // Apply discrete jump shock on scheduled day
      if (shockMap.has(day)) {
        price *= (1 + shockMap.get(day));
      }

      if (price > peak) peak = price;
      const dd = (peak - price) / peak;
      if (dd > mdd) mdd = dd;

      if (!hitTarget && targetPrice) {
        if (targetPrice >= S0 ? price >= targetPrice : price <= targetPrice) {
          hitTarget = true;
        }
      }

      dailyPaths[day][p] = price;
    }

    terminalPrices[p] = price;
    pathDrawdowns[p] = mdd;

    if (hitTarget) targetHits++;
    if (price < S0) lossCount++;
    totalTerminalReturn += (price - S0) / S0;
  }

  // Percentiles for fan chart
  const percentiles = { p5: [], p25: [], p50: [], p75: [], p95: [] };
  for (let d = 0; d <= horizonDays; d++) {
    const sorted = Float64Array.from(dailyPaths[d]).sort();
    percentiles.p5.push(Math.round(sorted[Math.floor(nPaths * 0.05)] * 100) / 100);
    percentiles.p25.push(Math.round(sorted[Math.floor(nPaths * 0.25)] * 100) / 100);
    percentiles.p50.push(Math.round(sorted[Math.floor(nPaths * 0.50)] * 100) / 100);
    percentiles.p75.push(Math.round(sorted[Math.floor(nPaths * 0.75)] * 100) / 100);
    percentiles.p95.push(Math.round(sorted[Math.floor(nPaths * 0.95)] * 100) / 100);
  }

  // Risk & Feasibility Metrics
  const sortedTerminals = Float64Array.from(terminalPrices).sort();
  const sortedLosses = sortedTerminals.map((p) => Math.max(0, S0 - p)).sort();
  const sortedMDD = Float64Array.from(pathDrawdowns).sort();

  const pTarget = targetPrice ? Math.round((targetHits / nPaths) * 10000) / 10000 : null;
  const pLoss = Math.round((lossCount / nPaths) * 10000) / 10000;
  const expectedReturn = Math.round((totalTerminalReturn / nPaths) * 10000) / 10000;

  // 95% Value at Risk (Loss quantile)
  const varIndex = Math.floor(nPaths * 0.95);
  const var95 = Math.round(sortedLosses[varIndex] * 100) / 100;

  // CVaR (Expected Shortfall) = mean of losses beyond 95%
  let sumTail = 0;
  let tailCount = 0;
  for (let i = varIndex; i < nPaths; i++) {
    sumTail += sortedLosses[i];
    tailCount++;
  }
  const cvar95 = tailCount > 0 ? Math.round((sumTail / tailCount) * 100) / 100 : var95;
  const medianMDD = Math.round(sortedMDD[Math.floor(nPaths * 0.50)] * 10000) / 10000;
  const mdd95 = Math.round(sortedMDD[Math.floor(nPaths * 0.95)] * 10000) / 10000;

  return {
    S0: Math.round(S0 * 100) / 100,
    mu: Math.round(mu * 10000) / 10000,
    sigma: Math.round(sigma * 10000) / 10000,
    horizonDays,
    nPaths,
    percentiles,
    pTarget,
    pLoss,
    expectedReturn,
    var95,
    cvar95,
    medianMaxDrawdown: medianMDD,
    maxDrawdown95: mdd95
  };
}

router.post('/simulate', async (req, res, next) => {
  try {
    const validated = simulateTestingSchema.parse(req.body);
    const stock = await getCompanyStock(req.user._id);
    if (!stock) {
      return res.status(404).json({
        success: false,
        error: { code: 'STOCK_NOT_FOUND', message: 'Stock not found' }
      });
    }

    const engine = getMarketEngine();
    const live = engine?.getState(String(stock._id)) || engine?.getState(stock.symbol);
    const S0 = live ? live.price : stock.currentPrice;

    // Estimate base params from candles
    const candles = await DailyCandle.find({ stockId: stock._id }).sort({ simDay: -1 }).limit(31).lean();
    const dt = 1 / TIME_CONFIG.DAYS_PER_YEAR;
    const baseReturns = candles.length >= 2 ? logReturns(candles.reverse().map((c) => c.close)) : [];
    const baseParams = baseReturns.length >= 2
      ? blendedParams(baseReturns, dt, 0.94)
      : { muAnnual: stock.mu, sigmaAnnual: stock.sigma };

    const baseMu = baseParams.muAnnual;
    const baseSigma = baseParams.sigmaAnnual;

    // Apply overrides
    let simMu = validated.mu != null ? validated.mu : baseMu;
    let simSigma = validated.sigma != null ? validated.sigma : baseSigma;
    if (validated.volatilityMultiplier != null) {
      simSigma *= validated.volatilityMultiplier;
    }

    // 1. Run simulation with overrides & shocks
    const scenarioRun = runMonteCarloEngine({
      S0,
      mu: simMu,
      sigma: simSigma,
      horizonDays: validated.horizonDays,
      nPaths: validated.nPaths,
      shocks: validated.shocks,
      targetPrice: validated.targetPrice
    });

    // 2. Run baseline simulation (zero overrides, zero shocks)
    const baselineRun = runMonteCarloEngine({
      S0,
      mu: baseMu,
      sigma: baseSigma,
      horizonDays: validated.horizonDays,
      nPaths: validated.nPaths,
      shocks: [],
      targetPrice: validated.targetPrice
    });

    // 3. Feasibility Check
    const checks = [];
    let overallPassed = true;

    if (validated.thresholds.minTargetProb != null && scenarioRun.pTarget != null) {
      const pass = scenarioRun.pTarget >= validated.thresholds.minTargetProb;
      checks.push({
        condition: 'minTargetProb',
        value: scenarioRun.pTarget,
        threshold: validated.thresholds.minTargetProb,
        pass
      });
      if (!pass) overallPassed = false;
    }

    if (validated.thresholds.maxLossProb != null) {
      const pass = scenarioRun.pLoss <= validated.thresholds.maxLossProb;
      checks.push({
        condition: 'maxLossProb',
        value: scenarioRun.pLoss,
        threshold: validated.thresholds.maxLossProb,
        pass
      });
      if (!pass) overallPassed = false;
    }

    if (validated.thresholds.maxDrawdown != null) {
      const pass = scenarioRun.maxDrawdown95 <= validated.thresholds.maxDrawdown;
      checks.push({
        condition: 'maxDrawdown',
        value: scenarioRun.maxDrawdown95,
        threshold: validated.thresholds.maxDrawdown,
        pass
      });
      if (!pass) overallPassed = false;
    }

    res.json({
      success: true,
      data: {
        simulation: scenarioRun,
        baseline: baselineRun,
        feasibilityCheck: {
          overallPassed,
          conditions: checks
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 6. POST /api/company/simulate/save, GET /api/company/simulations, DELETE /api/company/simulations/:id
// ==========================================
router.post('/simulate/save', async (req, res, next) => {
  try {
    const { name, inputs, results } = req.body;
    if (!name || !inputs || !results) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PAYLOAD', message: 'name, inputs, and results are required' }
      });
    }

    const scenario = await Scenario.create({
      companyId: req.user._id,
      name,
      inputs,
      results
    });

    res.status(201).json({
      success: true,
      data: scenario
    });
  } catch (err) {
    next(err);
  }
});

router.get('/simulations', async (req, res, next) => {
  try {
    const scenarios = await Scenario.find({ companyId: req.user._id }).sort({ createdAt: -1 }).lean();
    res.json({
      success: true,
      data: scenarios
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/simulations/:id', async (req, res, next) => {
  try {
    const scenario = await Scenario.findOneAndDelete({ _id: req.params.id, companyId: req.user._id });
    if (!scenario) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Simulation not found' }
      });
    }

    res.json({
      success: true,
      data: { message: 'Simulation deleted successfully', id: req.params.id }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
