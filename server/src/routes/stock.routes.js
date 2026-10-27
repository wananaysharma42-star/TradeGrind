import express from 'express';
import { Stock } from '../models/Stock.js';
import { PriceTick } from '../models/PriceTick.js';
import { DailyCandle } from '../models/DailyCandle.js';
import { getMarketEngine } from '../services/marketEngine.js';

const router = express.Router();

export const HISTORY_RANGES = {
  '1D': { days: 1, ticks: true },
  '1W': { days: 5, ticks: false },
  '1M': { days: 21, ticks: false },
  '6M': { days: 126, ticks: false },
  '1Y': { days: 252, ticks: false }
};

async function findStock(idOrSymbol) {
  if (/^[a-fA-F0-9]{24}$/.test(idOrSymbol)) {
    const byId = await Stock.findById(idOrSymbol);
    if (byId) return byId;
  }
  return Stock.findOne({ symbol: String(idOrSymbol).toUpperCase() });
}

function liveOverlay(stock) {
  const engine = getMarketEngine();
  const state = engine?.getState(String(stock._id)) || engine?.getState(stock.symbol);
  if (!state) {
    const changePct = stock.previousClose > 0
      ? ((stock.currentPrice - stock.previousClose) / stock.previousClose) * 100
      : 0;
    return {
      price: stock.currentPrice,
      changePct: Math.round(changePct * 100) / 100,
      viewCount: stock.viewCount || 0,
      sparkline: []
    };
  }
  const changePct = state.previousClose > 0
    ? ((state.price - state.previousClose) / state.previousClose) * 100
    : 0;
  return {
    price: Math.round(state.price * 100) / 100,
    changePct: Math.round(changePct * 100) / 100,
    viewCount: state.viewCount,
    sparkline: state.recentPrices.map((p) => Math.round(p * 100) / 100)
  };
}

// GET /api/stocks
router.get('/', async (req, res, next) => {
  try {
    const engine = getMarketEngine();
    if (engine && engine.states.size > 0) {
      return res.json({ success: true, data: engine.getPublicList() });
    }

    const stocks = await Stock.find().lean();
    const data = stocks.map((s) => {
      const changePct = s.previousClose > 0
        ? ((s.currentPrice - s.previousClose) / s.previousClose) * 100
        : 0;
      return {
        stockId: s._id,
        symbol: s.symbol,
        name: s.name,
        sector: s.sector,
        price: s.currentPrice,
        changePct: Math.round(changePct * 100) / 100,
        viewCount: s.viewCount || 0,
        sparkline: []
      };
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /api/stocks/:id/history?range=1D|1W|1M|6M|1Y
router.get('/:id/history', async (req, res, next) => {
  try {
    const rangeKey = String(req.query.range || '1D').toUpperCase();
    const spec = HISTORY_RANGES[rangeKey];
    if (!spec) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_RANGE', message: 'range must be 1D, 1W, 1M, 6M or 1Y' }
      });
    }

    const stock = await findStock(req.params.id);
    if (!stock) {
      return res.status(404).json({
        success: false,
        error: { code: 'STOCK_NOT_FOUND', message: `Stock '${req.params.id}' not found` }
      });
    }

    const engine = getMarketEngine();
    const state = engine?.getState(String(stock._id));
    const currentSimDay = state?.simDay || Math.max(1, stock.tickCount ? Math.floor((stock.tickCount - 1) / 390) + 1 : 1);

    if (spec.ticks) {
      const ticks = await PriceTick.find({ stockId: stock._id, simDay: currentSimDay })
        .sort({ tickIndex: 1 })
        .select('price tickIndex simDay ts')
        .lean();
      // Fall back to last 390 ticks if today is empty
      const series = ticks.length
        ? ticks
        : await PriceTick.find({ stockId: stock._id }).sort({ tickIndex: -1 }).limit(390).lean().then((rows) => rows.reverse());

      return res.json({
        success: true,
        data: {
          stockId: stock._id,
          symbol: stock.symbol,
          range: rangeKey,
          type: 'ticks',
          series: series.map((t) => ({
            price: t.price,
            tickIndex: t.tickIndex,
            simDay: t.simDay,
            ts: t.ts
          }))
        }
      });
    }

    const fromDay = currentSimDay - spec.days + 1;
    let candles = await DailyCandle.find({
      stockId: stock._id,
      simDay: { $gte: fromDay }
    }).sort({ simDay: 1 }).lean();

    if (candles.length < spec.days && engine) {
      await engine._backfillStock(state || engine.getState(stock.symbol));
      candles = await DailyCandle.find({
        stockId: stock._id,
        simDay: { $gte: fromDay }
      }).sort({ simDay: 1 }).lean();
    }

    res.json({
      success: true,
      data: {
        stockId: stock._id,
        symbol: stock.symbol,
        range: rangeKey,
        type: 'candles',
        series: candles.map((c) => ({
          simDay: c.simDay,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
          logReturn: c.logReturn
        }))
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/stocks/:id — increments viewCount
router.get('/:id', async (req, res, next) => {
  try {
    const stock = await findStock(req.params.id);
    if (!stock) {
      return res.status(404).json({
        success: false,
        error: { code: 'STOCK_NOT_FOUND', message: `Stock '${req.params.id}' not found` }
      });
    }

    const engine = getMarketEngine();
    const viewCount = engine
      ? engine.incrementViewCount(String(stock._id))
      : (stock.viewCount || 0) + 1;
    if (!engine) {
      stock.viewCount = viewCount;
      await stock.save();
    }

    const live = liveOverlay(stock);
    res.json({
      success: true,
      data: {
        stockId: stock._id,
        symbol: stock.symbol,
        name: stock.name,
        sector: stock.sector,
        mu: stock.mu,
        sigma: stock.sigma,
        previousClose: engine?.getState(String(stock._id))?.previousClose ?? stock.previousClose,
        totalShares: stock.totalShares,
        ...live,
        viewCount
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
