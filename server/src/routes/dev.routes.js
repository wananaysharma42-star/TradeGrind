/**
 * dev.routes.js - Developer & Testing Endpoints
 * Restricted to non-production environments (process.env.NODE_ENV !== 'production').
 *
 * Endpoints:
 * - POST /api/dev/shock { stockId, pct }: trigger instant price shock on next tick
 * - POST /api/dev/speed { multiplier }: speed up or slow down market engine ticks
 */

import express from 'express';
import { getMarketEngine } from '../services/marketEngine.js';

const router = express.Router();

// Middleware: restrict to non-production
router.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Dev endpoints are disabled in production' }
    });
  }
  next();
});

// POST /api/dev/shock { stockId, pct }
router.post('/shock', (req, res, next) => {
  try {
    const { stockId, pct } = req.body;
    if (!stockId || pct == null || !Number.isFinite(Number(pct))) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PARAMETERS', message: 'stockId and numeric pct are required' }
      });
    }

    const engine = getMarketEngine();
    if (!engine) {
      return res.status(503).json({
        success: false,
        error: { code: 'ENGINE_NOT_READY', message: 'Market engine is not running' }
      });
    }

    const applied = engine.applyShock(stockId, Number(pct));
    if (!applied) {
      return res.status(404).json({
        success: false,
        error: { code: 'STOCK_NOT_FOUND', message: `Stock '${stockId}' not found in engine` }
      });
    }

    const state = engine.getState(stockId);
    res.json({
      success: true,
      data: {
        stockId,
        pct: Number(pct),
        currentPrice: state ? state.price : null,
        message: `Shock of ${(Number(pct) * 100).toFixed(2)}% scheduled for next tick`
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/dev/speed { multiplier }
router.post('/speed', (req, res, next) => {
  try {
    const { multiplier } = req.body;
    const mult = Number(multiplier);
    if (!Number.isFinite(mult) || mult <= 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PARAMETERS', message: 'Positive numeric multiplier is required' }
      });
    }

    const engine = getMarketEngine();
    if (!engine) {
      return res.status(503).json({
        success: false,
        error: { code: 'ENGINE_NOT_READY', message: 'Market engine is not running' }
      });
    }

    const success = engine.setSpeed(mult);
    res.json({
      success,
      data: {
        multiplier: mult,
        intervalMs: engine.intervalMs,
        message: `Engine speed adjusted to ${mult}x (${engine.intervalMs} ms interval)`
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
