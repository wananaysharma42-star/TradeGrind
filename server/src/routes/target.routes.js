/**
 * target.routes.js - Customer Target & Probability Endpoints:
 * - POST /api/targets: snapshot startPrice/startTick, compute and store initial probability
 * - GET /api/targets: list user's targets with live closed-form probability
 * - POST /api/targets/analyse: full Monte Carlo payload with fan chart percentiles & methodology
 * - POST /api/targets/what-if: instant closed-form probability matrix (< 300 ms response)
 * - DELETE /api/targets/:id: cancel target
 */

import express from 'express';
import { z } from 'zod';
import { Target } from '../models/Target.js';
import { Stock } from '../models/Stock.js';
import { DailyCandle } from '../models/DailyCandle.js';
import { authenticateToken } from '../middleware/auth.js';
import { getMarketEngine } from '../services/marketEngine.js';
import {
  closedFormTouchProb,
  closedFormTerminalProb,
  monteCarloHitProbability,
  probabilityGrid,
  requiredReturn
} from '../math/probability.js';
import { blendedParams, logReturns } from '../math/returns.js';
import { TIME_CONFIG } from '../config/time.js';

const router = express.Router();

async function resolveStock(idOrSymbol) {
  if (/^[a-fA-F0-9]{24}$/.test(idOrSymbol)) {
    const byId = await Stock.findById(idOrSymbol);
    if (byId) return byId;
  }
  return Stock.findOne({ symbol: String(idOrSymbol).toUpperCase() });
}

/**
 * Estimates mu and sigma from the stock's last 30 simulated days of DailyCandles
 * using blendedParams (50/50 blend of sample and EWMA volatility).
 * Never uses the hidden true mu/sigma.
 */
export async function getEstimatedStockParams(stockId, fallbackMu = 0.10, fallbackSigma = 0.20) {
  const candles = await DailyCandle.find({ stockId })
    .sort({ simDay: -1 })
    .limit(31)
    .lean();

  if (candles.length >= 5) {
    const prices = candles.reverse().map((c) => c.close);
    const r = logReturns(prices);
    if (r.length >= 2) {
      const dt = 1 / TIME_CONFIG.DAYS_PER_YEAR;
      const { muAnnual, sigmaAnnual, sampleVol, ewmaVol } = blendedParams(r, dt, 0.94);
      return {
        muEstimated: muAnnual,
        sigmaEstimated: Math.max(0.05, sigmaAnnual),
        windowDays: candles.length - 1,
        sampleVol,
        ewmaVol
      };
    }
  }

  return {
    muEstimated: fallbackMu,
    sigmaEstimated: fallbackSigma,
    windowDays: 30,
    sampleVol: fallbackSigma,
    ewmaVol: fallbackSigma
  };
}

const createTargetSchema = z.object({
  stockId: z.string().min(1),
  targetPrice: z.number().positive(),
  deadlineDays: z.number().int().positive().max(365),
  mode: z.enum(['touch', 'terminal']).default('touch')
});

// POST /api/targets
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const validated = createTargetSchema.parse(req.body);
    const userId = req.user._id;

    const stock = await resolveStock(validated.stockId);
    if (!stock) {
      return res.status(404).json({
        success: false,
        error: { code: 'STOCK_NOT_FOUND', message: `Stock '${validated.stockId}' not found` }
      });
    }

    const engine = getMarketEngine();
    const live = engine?.getState(String(stock._id)) || engine?.getState(stock.symbol);
    const currentPrice = live ? live.price : stock.currentPrice;
    const currentTick = engine?.globalTick || (stock.tickCount || 1);

    // Estimate params from historical candles
    const { muEstimated, sigmaEstimated } = await getEstimatedStockParams(stock._id, stock.mu, stock.sigma);

    const T = validated.deadlineDays / TIME_CONFIG.DAYS_PER_YEAR;
    const initialProb = validated.mode === 'terminal'
      ? closedFormTerminalProb(currentPrice, validated.targetPrice, muEstimated, sigmaEstimated, T)
      : closedFormTouchProb(currentPrice, validated.targetPrice, muEstimated, sigmaEstimated, T);

    const target = await Target.create({
      userId,
      stockId: stock._id,
      targetPrice: Math.round(validated.targetPrice * 100) / 100,
      deadlineDays: validated.deadlineDays,
      startTick: currentTick,
      startPrice: Math.round(currentPrice * 100) / 100,
      mode: validated.mode,
      status: 'ACTIVE',
      lastProbability: Math.round(initialProb * 10000) / 10000
    });

    res.status(201).json({
      success: true,
      data: {
        ...target.toObject(),
        symbol: stock.symbol,
        currentPrice: Math.round(currentPrice * 100) / 100,
        initialProbability: Math.round(initialProb * 10000) / 10000
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/targets
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const targets = await Target.find({ userId })
      .populate('stockId', 'symbol name sector mu sigma')
      .sort({ createdAt: -1 })
      .lean();

    const engine = getMarketEngine();
    const currentTick = engine?.globalTick || 1;

    const enriched = await Promise.all(targets.map(async (t) => {
      const stock = t.stockId;
      if (!stock) return t;

      const live = engine?.getState(String(stock._id)) || engine?.getState(stock.symbol);
      const currentPrice = live ? live.price : t.startPrice;

      const elapsedTicks = Math.max(0, currentTick - t.startTick);
      const totalDeadlineTicks = t.deadlineDays * TIME_CONFIG.TICKS_PER_DAY;
      const remainingTicks = Math.max(0, totalDeadlineTicks - elapsedTicks);
      const remainingDays = remainingTicks / TIME_CONFIG.TICKS_PER_DAY;
      const T = remainingDays / TIME_CONFIG.DAYS_PER_YEAR;

      const { muEstimated, sigmaEstimated } = await getEstimatedStockParams(stock._id, stock.mu, stock.sigma);

      const liveProb = t.status === 'HIT'
        ? 1.0
        : (t.status === 'MISSED' || remainingDays <= 0)
          ? 0.0
          : (t.mode === 'terminal'
            ? closedFormTerminalProb(currentPrice, t.targetPrice, muEstimated, sigmaEstimated, T)
            : closedFormTouchProb(currentPrice, t.targetPrice, muEstimated, sigmaEstimated, T));

      return {
        ...t,
        symbol: stock.symbol,
        currentStockPrice: Math.round(currentPrice * 100) / 100,
        remainingDays: Math.round(remainingDays * 10) / 10,
        currentProbability: Math.round(liveProb * 10000) / 10000
      };
    }));

    res.json({
      success: true,
      data: enriched
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/targets/analyse
const analyseSchema = z.object({
  stockId: z.string().min(1),
  targetPrice: z.number().positive(),
  deadlineDays: z.number().int().positive().max(365),
  mode: z.enum(['touch', 'terminal']).default('touch'),
  nPaths: z.number().int().positive().max(20000).default(5000)
});

router.post('/analyse', authenticateToken, async (req, res, next) => {
  try {
    const validated = analyseSchema.parse(req.body);
    const stock = await resolveStock(validated.stockId);
    if (!stock) {
      return res.status(404).json({
        success: false,
        error: { code: 'STOCK_NOT_FOUND', message: `Stock '${validated.stockId}' not found` }
      });
    }

    const engine = getMarketEngine();
    const live = engine?.getState(String(stock._id)) || engine?.getState(stock.symbol);
    const S0 = live ? live.price : stock.currentPrice;

    // Estimate params from 30 days of daily returns using blendedParams
    const { muEstimated, sigmaEstimated, windowDays, sampleVol, ewmaVol } = await getEstimatedStockParams(stock._id, stock.mu, stock.sigma);

    const T = validated.deadlineDays / TIME_CONFIG.DAYS_PER_YEAR;
    const closedFormProb = validated.mode === 'terminal'
      ? closedFormTerminalProb(S0, validated.targetPrice, muEstimated, sigmaEstimated, T)
      : closedFormTouchProb(S0, validated.targetPrice, muEstimated, sigmaEstimated, T);

    // Monte Carlo simulation with fan chart percentiles
    const mcResult = monteCarloHitProbability({
      S0,
      K: validated.targetPrice,
      mu: muEstimated,
      sigma: sigmaEstimated,
      days: validated.deadlineDays,
      nPaths: validated.nPaths,
      mode: validated.mode
    });

    const methodology = {
      window: `${windowDays} simulated days`,
      formulas: {
        drift: 'mu = mean(r)/dt + 0.5 * sigma^2',
        volatility: 'sigma = 50% Sample Volatility + 50% EWMA(lambda=0.94)',
        simulation: 'GBM with 15-minute granularity (26 steps/day)',
        confidenceInterval: 'Wilson 95% Score Interval'
      },
      paramsUsed: {
        muEstimated: Math.round(muEstimated * 10000) / 10000,
        sigmaEstimated: Math.round(sigmaEstimated * 10000) / 10000,
        sampleVol: Math.round(sampleVol * 10000) / 10000,
        ewmaVol: Math.round(ewmaVol * 10000) / 10000,
        nPaths: validated.nPaths
      }
    };

    const reqReturn = requiredReturn(S0, validated.targetPrice, validated.deadlineDays);

    const formattedPercentiles = {
      p5: mcResult.percentiles.p5.map((p) => Math.round(p * 100) / 100),
      p25: mcResult.percentiles.p25.map((p) => Math.round(p * 100) / 100),
      p50: mcResult.percentiles.p50.map((p) => Math.round(p * 100) / 100),
      p75: mcResult.percentiles.p75.map((p) => Math.round(p * 100) / 100),
      p95: mcResult.percentiles.p95.map((p) => Math.round(p * 100) / 100)
    };

    res.json({
      success: true,
      data: {
        stockId: stock._id,
        symbol: stock.symbol,
        currentPrice: Math.round(S0 * 100) / 100,
        targetPrice: validated.targetPrice,
        deadlineDays: validated.deadlineDays,
        mode: validated.mode,
        closedFormProbability: Math.round(closedFormProb * 10000) / 10000,
        monteCarloProbability: Math.round(mcResult.probability * 10000) / 10000,
        requiredAnnualReturn: Math.round(reqReturn * 10000) / 10000,
        confidenceInterval: {
          low: Math.round(mcResult.ciLow * 10000) / 10000,
          high: Math.round(mcResult.ciHigh * 10000) / 10000
        },
        expectedTerminalPrice: Math.round(mcResult.expectedTerminal * 100) / 100,
        medianTerminalPrice: Math.round(mcResult.medianTerminal * 100) / 100,
        percentiles: formattedPercentiles,
        monteCarlo: {
          probability: Math.round(mcResult.probability * 10000) / 10000,
          ciLow: Math.round(mcResult.ciLow * 10000) / 10000,
          ciHigh: Math.round(mcResult.ciHigh * 10000) / 10000,
          expectedTerminal: Math.round(mcResult.expectedTerminal * 100) / 100,
          medianTerminal: Math.round(mcResult.medianTerminal * 100) / 100,
          meanTimeToHitDays: mcResult.meanTimeToHit ? Math.round(mcResult.meanTimeToHit * 10) / 10 : null,
          percentiles: formattedPercentiles
        },
        methodology
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/targets/what-if (responds < 300 ms via closed-form grid)
const whatIfSchema = z.object({
  stockId: z.string().min(1),
  targets: z.array(z.number().positive()).min(1),
  days: z.array(z.number().int().positive()).min(1),
  mode: z.enum(['touch', 'terminal']).default('touch')
});

router.post('/what-if', authenticateToken, async (req, res, next) => {
  try {
    const t0 = performance.now();
    const validated = whatIfSchema.parse(req.body);

    const stock = await resolveStock(validated.stockId);
    if (!stock) {
      return res.status(404).json({
        success: false,
        error: { code: 'STOCK_NOT_FOUND', message: `Stock '${validated.stockId}' not found` }
      });
    }

    const engine = getMarketEngine();
    const live = engine?.getState(String(stock._id)) || engine?.getState(stock.symbol);
    const S0 = live ? live.price : stock.currentPrice;

    const { muEstimated, sigmaEstimated } = await getEstimatedStockParams(stock._id, stock.mu, stock.sigma);

    const grid = probabilityGrid({
      S0,
      mu: muEstimated,
      sigma: sigmaEstimated,
      targets: validated.targets,
      days: validated.days,
      mode: validated.mode
    });

    const elapsedMs = Math.round((performance.now() - t0) * 100) / 100;

    res.json({
      success: true,
      data: {
        stockId: stock._id,
        symbol: stock.symbol,
        currentPrice: Math.round(S0 * 100) / 100,
        mode: validated.mode,
        elapsedMs,
        grid
      }
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/targets/:id
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    const target = await Target.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { status: 'CANCELLED' },
      { new: true }
    );
    if (!target) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Target not found' }
      });
    }

    res.json({
      success: true,
      data: { message: 'Target cancelled successfully' }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
