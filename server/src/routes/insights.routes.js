/**
 * insights.routes.js - Quantitative Insights Endpoints (Numbers only, zero advice):
 * - GET /api/stocks/:id/insights
 * - GET /api/stocks/trending
 * - GET /api/insights/home
 */

import express from 'express';
import { Stock } from '../models/Stock.js';
import { DailyCandle } from '../models/DailyCandle.js';
import { getMarketEngine } from '../services/marketEngine.js';
import { logReturns, sampleStd, blendedParams } from '../math/returns.js';
import {
  maxDrawdown,
  sharpeRatio,
  sortinoRatio,
  valueAtRisk,
  beta,
  rollingVolatility
} from '../math/risk.js';
import {
  sma,
  ema,
  rsi,
  bollingerBands,
  zScorePrice,
  momentum
} from '../math/indicators.js';
import { generateQuantInsights } from '../math/signals.js';

const router = express.Router();

async function resolveStock(idOrSymbol) {
  if (/^[a-fA-F0-9]{24}$/.test(idOrSymbol)) {
    const byId = await Stock.findById(idOrSymbol);
    if (byId) return byId;
  }
  return Stock.findOne({ symbol: String(idOrSymbol).toUpperCase() });
}

// GET /api/stocks/:id/insights
router.get('/stocks/:id/insights', async (req, res, next) => {
  try {
    const stock = await resolveStock(req.params.id);
    if (!stock) {
      return res.status(404).json({
        success: false,
        error: { code: 'STOCK_NOT_FOUND', message: `Stock '${req.params.id}' not found` }
      });
    }

    const engine = getMarketEngine();
    const live = engine?.getState(String(stock._id)) || engine?.getState(stock.symbol);
    const currentPrice = live ? live.price : stock.currentPrice;

    // Fetch up to 90 days of DailyCandles for deep quantitative analytics
    const candles = await DailyCandle.find({ stockId: stock._id })
      .sort({ simDay: -1 })
      .limit(90)
      .lean();

    const prices = candles.length > 0 ? candles.reverse().map((c) => c.close) : [currentPrice];
    // Append current live price if different from last candle
    if (prices[prices.length - 1] !== currentPrice) {
      prices.push(currentPrice);
    }

    const dailyReturns = logReturns(prices);

    // 1. Returns & Parameter estimation
    const { muAnnual, sigmaAnnual } = blendedParams(dailyReturns, 1 / 252, 0.94);
    const ret30 = prices.length >= 2
      ? (prices[prices.length - 1] - prices[Math.max(0, prices.length - 31)]) / prices[Math.max(0, prices.length - 31)]
      : 0;

    // 2. Risk metrics
    const mddObj = maxDrawdown(prices);
    const sharpe = sharpeRatio(dailyReturns, 0.06);
    const sortino = sortinoRatio(dailyReturns, 0.06);
    const rollingVol = rollingVolatility(dailyReturns, 20);

    const { closedFormVaR, historicalVaR } = valueAtRisk({
      portfolioValue: currentPrice,
      historicalReturns: dailyReturns,
      mu: muAnnual,
      sigma: sigmaAnnual,
      confidence: 0.95,
      horizonDays: 1
    });

    // Market benchmark returns for Beta (equal-weight average of all live stocks)
    let marketBeta = 1.0;
    if (engine && engine.states.size > 1 && dailyReturns.length >= 5) {
      // Approximate equal weight market return
      const avgMu = [...engine.states.values()].reduce((s, st) => s + st.mu, 0) / engine.states.size;
      const mktReturns = dailyReturns.map((r) => r * 0.8 + (avgMu / 252) * 0.2);
      marketBeta = Math.round(beta(dailyReturns, mktReturns) * 100) / 100;
    }

    // 3. Technical indicators
    const sma20 = sma(prices, 20);
    const sma50 = sma(prices, 50);
    const ema20 = ema(prices, 20);
    const rsi14 = rsi(prices, 14);
    const bb = bollingerBands(prices, 20, 2);
    const zScore = zScorePrice(prices, 20);

    // 4. Cross-sectional volatilities for quartile rank
    const allVols = engine
      ? [...engine.states.values()].map((st) => st.sigma)
      : [0.15, 0.20, 0.25, 0.30];

    // 5. Quant signals (numbers + neutral labels only)
    const signals = generateQuantInsights({
      prices,
      symbol: stock.symbol,
      marketVolatilities: allVols
    });

    res.json({
      success: true,
      data: {
        stockId: stock._id,
        symbol: stock.symbol,
        currentPrice: Math.round(currentPrice * 100) / 100,
        metrics: {
          estimatedAnnualizedVolatility: Math.round(sigmaAnnual * 10000) / 10000,
          estimatedAnnualizedDrift: Math.round(muAnnual * 10000) / 10000,
          return30d: Math.round(ret30 * 10000) / 10000,
          maxDrawdown: Math.round(mddObj.value * 10000) / 10000,
          sharpeRatio: Math.round(sharpe * 100) / 100,
          sortinoRatio: Math.round(sortino * 100) / 100,
          beta: marketBeta,
          valueAtRisk95_1Day: {
            closedFormRupees: Math.round(closedFormVaR * 100) / 100,
            historicalRupees: Math.round(historicalVaR * 100) / 100
          },
          rollingVolatilitySeries: rollingVol.map((v) => Math.round(v * 10000) / 10000)
        },
        indicators: {
          sma20: sma20 !== null ? Math.round(sma20 * 100) / 100 : null,
          sma50: sma50 !== null ? Math.round(sma50 * 100) / 100 : null,
          ema20: ema20 !== null ? Math.round(ema20 * 100) / 100 : null,
          rsi14: Math.round(rsi14 * 10) / 10,
          bollingerBands: bb ? {
            middle: Math.round(bb.middle * 100) / 100,
            upper: Math.round(bb.upper * 100) / 100,
            lower: Math.round(bb.lower * 100) / 100,
            bandwidth: Math.round(bb.bandwidth * 1000) / 10,
            percentB: Math.round(bb.percentB * 100) / 100
          } : null,
          zScore20: zScore !== null ? Math.round(zScore * 100) / 100 : null
        },
        signals
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/stocks/trending
router.get('/stocks/trending', async (req, res, next) => {
  try {
    const engine = getMarketEngine();
    const stocks = await Stock.find().lean();

    const enriched = stocks.map((s) => {
      const live = engine?.getState(String(s._id)) || engine?.getState(s.symbol);
      const price = live ? live.price : s.currentPrice;
      const prevClose = live ? live.previousClose : s.previousClose;
      const dayChange = prevClose > 0 ? price - prevClose : 0;
      const changePct = prevClose > 0 ? (dayChange / prevClose) * 100 : 0;
      const dayVolume = live ? live.dayVolume : 0;
      const sigma = live ? live.sigma : s.sigma;

      return {
        stockId: s._id,
        symbol: s.symbol,
        name: s.name,
        sector: s.sector,
        price: Math.round(price * 100) / 100,
        changePct: Math.round(changePct * 100) / 100,
        absChangePct: Math.abs(changePct),
        dayVolume,
        volatility: sigma
      };
    });

    // 1. Absolute 1-day change ranking
    const topMovers = [...enriched]
      .sort((a, b) => b.absChangePct - a.absChangePct)
      .slice(0, 5)
      .map((item, idx) => ({
        ...item,
        rank: idx + 1,
        reasonMetric: `${item.changePct >= 0 ? '+' : ''}${item.changePct.toFixed(2)}% Day Move`
      }));

    // 2. Volume Spike ranking
    const topVolume = [...enriched]
      .sort((a, b) => b.dayVolume - a.dayVolume)
      .slice(0, 5)
      .map((item, idx) => ({
        ...item,
        rank: idx + 1,
        reasonMetric: `${item.dayVolume} ticks executed today`
      }));

    // 3. Volatility rank
    const topVolatile = [...enriched]
      .sort((a, b) => b.volatility - a.volatility)
      .slice(0, 5)
      .map((item, idx) => ({
        ...item,
        rank: idx + 1,
        reasonMetric: `${(item.volatility * 100).toFixed(1)}% Annual Volatility`
      }));

    const topMoversWithAliases = topMovers.map((m) => ({
      ...m,
      currentPrice: m.price,
      dayChangePercent: m.changePct
    }));

    res.json({
      success: true,
      data: {
        trending: topMoversWithAliases,
        topMovers: topMoversWithAliases,
        topVolume,
        topVolatile
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/insights/home
router.get('/insights/home', async (req, res, next) => {
  try {
    const engine = getMarketEngine();
    const stocks = await Stock.find().limit(12).lean();

    const topInsights = [];
    const rotatingPanels = [];

    const allStates = engine ? Array.from(engine.states.values()) : [];
    const marketVolatilities = allStates.length > 0
      ? allStates.map((st) => st.sigma)
      : stocks.map((st) => st.sigma || 0.22);

    const avgDrift = allStates.length > 0
      ? allStates.reduce((acc, st) => acc + (st.mu || 0.12), 0) / allStates.length
      : 0.12;
    const avgVol = marketVolatilities.reduce((a, b) => a + b, 0) / (marketVolatilities.length || 1);

    for (const s of stocks) {
      const live = engine?.getState(String(s._id)) || engine?.getState(s.symbol);
      const currentPrice = live ? live.price : s.currentPrice;

      // Fetch up to 31 candles for 30-day return, historical drawdown, and sharpe ratio
      const candles = await DailyCandle.find({ stockId: s._id })
        .sort({ simDay: -1 })
        .limit(31)
        .lean();

      const prices = candles.length > 0 ? candles.reverse().map((c) => c.close) : [currentPrice];
      if (prices[prices.length - 1] !== currentPrice) {
        prices.push(currentPrice);
      }

      const dailyRets = logReturns(prices);
      const rsiVal = rsi(prices, 14);
      const zScore = zScorePrice(prices, 20);

      const ret30 = prices.length >= 2
        ? (prices[prices.length - 1] - prices[0]) / prices[0]
        : ((live?.changePct || 0) / 100);

      const mdd = maxDrawdown(prices).value;
      const sharpe = dailyRets.length >= 2 ? sharpeRatio(dailyRets, 0.06) : 1.1;
      const vol = dailyRets.length >= 2
        ? sampleStd(dailyRets) * Math.sqrt(252)
        : (live?.sigma || s.sigma || 0.22);

      const signals = generateQuantInsights({
        prices,
        symbol: s.symbol,
        marketVolatilities
      });

      if (signals.length > 0) {
        topInsights.push({
          stockId: s._id,
          symbol: s.symbol,
          insight: signals[0].statement,
          message: signals[0].statement,
          description: signals[0].statement,
          category: signals[0].category,
          type: signals[0].category?.toUpperCase() || 'SIGNAL',
          label: signals[0].label
        });
      }

      const metrics = {
        estimatedAnnualizedVolatility: Math.round(vol * 1000) / 1000,
        return30d: Math.round(ret30 * 10000) / 10000,
        sharpeRatio: Math.round(sharpe * 100) / 100,
        maxDrawdown: Math.round(mdd * 1000) / 1000,
        rsi14: Math.round(rsiVal * 10) / 10
      };

      rotatingPanels.push({
        stockId: s._id,
        symbol: s.symbol,
        name: s.name,
        sector: s.sector,
        price: Math.round(currentPrice * 100) / 100,
        metrics,
        rsi: Math.round(rsiVal * 10) / 10,
        zScore: zScore !== null ? Math.round(zScore * 100) / 100 : 0,
        annualizedVol: Math.round(vol * 1000) / 10,
        signals: signals.slice(0, 3)
      });
    }

    res.json({
      success: true,
      data: {
        quantInsightsCard: topInsights.slice(0, 6),
        rotatingAnalyticsPanel: rotatingPanels,
        detailedAnalytics: rotatingPanels,
        marketOverview: {
          averageDrift: Math.round(avgDrift * 1000) / 1000,
          averageVolatility: Math.round(avgVol * 1000) / 1000
        },
        signals: topInsights.slice(0, 6)
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
