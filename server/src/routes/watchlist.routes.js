/**
 * watchlist.routes.js - Customer Watchlist Endpoints:
 * - POST /api/watchlist/:stockId: Add stock to user's watchlist
 * - DELETE /api/watchlist/:stockId: Remove stock from watchlist
 * - GET /api/watchlist: List user's watchlist stocks with live quotes,
 *   supporting filter query params: ?filter=all|most_viewed|gain|lose
 */

import express from 'express';
import { Watchlist } from '../models/Watchlist.js';
import { Stock } from '../models/Stock.js';
import { authenticateToken } from '../middleware/auth.js';
import { getMarketEngine } from '../services/marketEngine.js';

const router = express.Router();

async function resolveStock(stockIdOrSymbol) {
  if (/^[a-fA-F0-9]{24}$/.test(stockIdOrSymbol)) {
    const byId = await Stock.findById(stockIdOrSymbol);
    if (byId) return byId;
  }
  return Stock.findOne({ symbol: String(stockIdOrSymbol).toUpperCase() });
}

// POST /api/watchlist/:stockId
router.post('/:stockId', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const stock = await resolveStock(req.params.stockId);
    if (!stock) {
      return res.status(404).json({
        success: false,
        error: { code: 'STOCK_NOT_FOUND', message: `Stock '${req.params.stockId}' not found` }
      });
    }

    const item = await Watchlist.findOneAndUpdate(
      { userId, stockId: stock._id },
      { userId, stockId: stock._id },
      { upsert: true, new: true }
    );

    res.status(201).json({
      success: true,
      data: item
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/watchlist/:stockId
router.delete('/:stockId', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const stock = await resolveStock(req.params.stockId);
    if (!stock) {
      return res.status(404).json({
        success: false,
        error: { code: 'STOCK_NOT_FOUND', message: `Stock '${req.params.stockId}' not found` }
      });
    }

    await Watchlist.findOneAndDelete({ userId, stockId: stock._id });

    res.json({
      success: true,
      data: { message: 'Stock removed from watchlist' }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/watchlist?filter=most_viewed|gain|lose|all
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const filter = String(req.query.filter || 'all').toLowerCase();

    const items = await Watchlist.find({ userId }).populate('stockId').lean();
    const engine = getMarketEngine();

    let stocks = items
      .filter((item) => item.stockId)
      .map((item) => {
        const s = item.stockId;
        const live = engine?.getState(String(s._id)) || engine?.getState(s.symbol);
        const price = live ? live.price : s.currentPrice;
        const prevClose = live ? live.previousClose : s.previousClose;
        const dayChange = prevClose > 0 ? price - prevClose : 0;
        const changePct = prevClose > 0 ? (dayChange / prevClose) * 100 : 0;
        const viewCount = live ? live.viewCount : (s.viewCount || 0);

        return {
          watchlistId: item._id,
          stockId: s._id,
          symbol: s.symbol,
          name: s.name,
          sector: s.sector,
          price: Math.round(price * 100) / 100,
          changePct: Math.round(changePct * 100) / 100,
          dayChange: Math.round(dayChange * 100) / 100,
          viewCount,
          sparkline: live ? live.recentPrices.map((p) => Math.round(p * 100) / 100) : []
        };
      });

    // Apply filters
    if (filter === 'most_viewed') {
      stocks.sort((a, b) => b.viewCount - a.viewCount);
    } else if (filter === 'gain') {
      stocks = stocks.filter((s) => s.changePct > 0).sort((a, b) => b.changePct - a.changePct);
    } else if (filter === 'lose') {
      stocks = stocks.filter((s) => s.changePct < 0).sort((a, b) => a.changePct - b.changePct);
    }

    res.json({
      success: true,
      data: stocks
    });
  } catch (err) {
    next(err);
  }
});

export default router;
