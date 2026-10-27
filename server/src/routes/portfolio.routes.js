/**
 * portfolio.routes.js - Customer Portfolio Endpoints:
 * - GET /api/portfolio: holdings with live value, P&L, allocation %, portfolio volatility, max drawdown, Sharpe
 * - GET /api/portfolio/history?range=1D|1W|1M|6M|1Y: from PortfolioSnapshot plus today's intraday points
 * - GET /api/transactions: paginated transaction history
 */

import express from 'express';
import { Holding } from '../models/Holding.js';
import { Stock } from '../models/Stock.js';
import { User } from '../models/User.js';
import { Transaction } from '../models/Transaction.js';
import { PortfolioSnapshot } from '../models/PortfolioSnapshot.js';
import { PriceTick } from '../models/PriceTick.js';
import { authenticateToken } from '../middleware/auth.js';
import { getMarketEngine } from '../services/marketEngine.js';
import { allocationPercent, portfolioValue } from '../math/portfolio.js';
import { sharpeRatio, maxDrawdown } from '../math/risk.js';
import { sampleStd, logReturns } from '../math/returns.js';

const router = express.Router();

const HISTORY_RANGES = {
  '1D': { days: 1, intraday: true },
  '1W': { days: 5, intraday: false },
  '1M': { days: 21, intraday: false },
  '6M': { days: 126, intraday: false },
  '1Y': { days: 252, intraday: false }
};

// GET /api/transactions handler
async function getTransactionsHandler(req, res, next) {
  try {
    const userId = req.user._id;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      Transaction.find({ userId })
        .populate('stockId', 'symbol name sector')
        .sort({ ts: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments({ userId })
    ]);

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/portfolio (or GET /api/transactions when mounted at /api/transactions)
router.get('/', authenticateToken, async (req, res, next) => {
  if (req.baseUrl === '/api/transactions') {
    return getTransactionsHandler(req, res, next);
  }
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
    }

    const holdingsDocs = await Holding.find({ userId, quantity: { $gt: 0 } }).populate('stockId').lean();
    const engine = getMarketEngine();

    let totalHoldingsValue = 0;
    let totalInvested = 0;
    const holdingItemsForAlloc = [];
    const returnsList = [];
    const weightsList = [];

    const formattedHoldings = holdingsDocs.map((h) => {
      const stock = h.stockId;
      const stockIdStr = stock ? String(stock._id) : String(h.stockId);
      const live = engine?.getState(stockIdStr) || (stock?.symbol ? engine?.getState(stock.symbol) : null);
      const currentPrice = live ? live.price : (stock ? stock.currentPrice : h.avgBuyPrice);
      const currentValue = Math.round(h.quantity * currentPrice * 100) / 100;
      const cost = Math.round(h.quantity * (h.avgBuyPrice || 0) * 100) / 100;
      const pnl = Math.round((currentValue - cost) * 100) / 100;
      const pnlPercent = cost > 0 ? Math.round((pnl / cost) * 10000) / 100 : 0;

      totalHoldingsValue += currentValue;
      totalInvested += cost;

      holdingItemsForAlloc.push({
        id: stockIdStr,
        symbol: stock?.symbol || 'STOCK',
        quantity: h.quantity,
        currentPrice
      });

      return {
        id: h._id,
        stockId: stock ? stock._id : h.stockId,
        symbol: stock ? stock.symbol : 'STOCK',
        name: stock ? stock.name : 'Unknown',
        sector: stock ? stock.sector : 'General',
        quantity: h.quantity,
        avgBuyPrice: h.avgBuyPrice,
        currentPrice: Math.round(currentPrice * 100) / 100,
        currentValue,
        totalInvested: cost,
        pnl,
        pnlPercent
      };
    });

    const cash = user.virtualBalance || 0;
    const totalVal = Math.round((cash + totalHoldingsValue) * 100) / 100;
    const totalUnrealizedPnl = Math.round((totalHoldingsValue - totalInvested) * 100) / 100;
    const totalUnrealizedPnlPercent = totalInvested > 0
      ? Math.round((totalUnrealizedPnl / totalInvested) * 10000) / 100
      : 0;

    // Allocation percentages (cash + holdings)
    const allocations = allocationPercent(cash, holdingItemsForAlloc);

    // Fetch user's PortfolioSnapshots to compute historical Sharpe & Max Drawdown
    const snapshots = await PortfolioSnapshot.find({ userId })
      .sort({ simDay: 1 })
      .lean();

    const snapshotValues = snapshots.map((s) => s.totalValue);
    // Add current live total value as the latest point
    snapshotValues.push(totalVal);

    const mddObj = maxDrawdown(snapshotValues);
    const dailyRets = logReturns(snapshotValues);
    const sharpe = dailyRets.length >= 2 ? sharpeRatio(dailyRets, 0.06) : 0;

    // Portfolio volatility: standard deviation of historical daily returns annualized, or weighted stock vol
    let portVol = 0;
    if (dailyRets.length >= 2) {
      portVol = sampleStd(dailyRets) * Math.sqrt(252);
    } else if (holdingsDocs.length > 0 && totalHoldingsValue > 0) {
      // Weighted average of individual stock volatilities
      let wVol = 0;
      for (const h of formattedHoldings) {
        const live = engine?.getState(String(h.stockId));
        const vol = live ? live.sigma : 0.25;
        wVol += (h.currentValue / totalHoldingsValue) * vol;
      }
      portVol = wVol * (totalHoldingsValue / totalVal);
    }

    res.json({
      success: true,
      data: {
        totalPortfolioValue: totalVal,
        cash,
        totalHoldingsValue: Math.round(totalHoldingsValue * 100) / 100,
        totalInvested: Math.round(totalInvested * 100) / 100,
        totalUnrealizedPnl,
        totalUnrealizedPnlPercent,
        riskMetrics: {
          portfolioVolatility: Math.round(portVol * 10000) / 10000,
          maxDrawdown: Math.round(mddObj.value * 10000) / 10000,
          sharpeRatio: Math.round(sharpe * 100) / 100
        },
        holdings: formattedHoldings,
        allocations
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/portfolio/history?range=1D|1W|1M|6M|1Y
router.get('/history', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const rangeKey = String(req.query.range || '1M').toUpperCase();
    const spec = HISTORY_RANGES[rangeKey] || HISTORY_RANGES['1M'];

    const engine = getMarketEngine();
    const currentSimDay = engine?.globalTick ? Math.floor((engine.globalTick - 1) / 390) + 1 : 1;

    // If 1D requested, return today's intraday evaluation
    if (spec.intraday) {
      const holdings = await Holding.find({ userId, quantity: { $gt: 0 } }).lean();
      const user = await User.findById(userId).lean();
      const cash = user?.virtualBalance || 0;

      // Find ticks for today across user's holdings
      const stockIds = holdings.map((h) => h.stockId);
      const dayTicks = await PriceTick.find({ stockId: { $in: stockIds }, simDay: currentSimDay })
        .sort({ tickIndex: 1 })
        .lean();

      // Group ticks by tickIndex
      const byTick = new Map();
      for (const t of dayTicks) {
        if (!byTick.has(t.tickIndex)) byTick.set(t.tickIndex, { tickIndex: t.tickIndex, ts: t.ts, prices: new Map() });
        byTick.get(t.tickIndex).prices.set(String(t.stockId), t.price);
      }

      const series = [];
      for (const [tickIndex, data] of byTick.entries()) {
        let hVal = 0;
        for (const h of holdings) {
          const p = data.prices.get(String(h.stockId)) || h.avgBuyPrice;
          hVal += h.quantity * p;
        }
        series.push({
          tickIndex,
          totalValue: Math.round((cash + hVal) * 100) / 100,
          ts: data.ts
        });
      }

      if (series.length === 0) {
        // Return at least current valuation point
        const liveVal = engine ? (await engine.syncUserPortfolio(String(userId)))?.totalValue || cash : cash;
        series.push({
          tickIndex: engine?.globalTick || 1,
          totalValue: liveVal,
          ts: new Date()
        });
      }

      return res.json({
        success: true,
        data: {
          range: rangeKey,
          type: 'intraday',
          series
        }
      });
    }

    // Historical daily snapshots
    const fromDay = Math.max(1, currentSimDay - spec.days + 1);
    const snapshots = await PortfolioSnapshot.find({
      userId,
      simDay: { $gte: fromDay }
    }).sort({ simDay: 1 }).lean();

    const series = snapshots.map((s) => ({
      simDay: s.simDay,
      totalValue: s.totalValue,
      cash: s.cash,
      holdingsValue: s.holdingsValue
    }));

    // Append today's live point
    const user = await User.findById(userId).lean();
    const holdings = await Holding.find({ userId, quantity: { $gt: 0 } }).lean();
    let currentHV = 0;
    for (const h of holdings) {
      const live = engine?.getState(String(h.stockId));
      currentHV += h.quantity * (live ? live.price : h.avgBuyPrice);
    }
    const currentTotal = (user?.virtualBalance || 0) + currentHV;

    series.push({
      simDay: currentSimDay,
      totalValue: Math.round(currentTotal * 100) / 100,
      cash: Math.round((user?.virtualBalance || 0) * 100) / 100,
      holdingsValue: Math.round(currentHV * 100) / 100
    });

    res.json({
      success: true,
      data: {
        range: rangeKey,
        type: 'daily',
        series
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/transactions', authenticateToken, getTransactionsHandler);

export default router;
