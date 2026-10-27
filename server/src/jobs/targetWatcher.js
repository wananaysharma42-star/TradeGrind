/**
 * targetWatcher.js - Background job to evaluate and resolve price targets:
 * - Resolves to HIT when price touches or crosses targetPrice
 * - Resolves to MISSED when deadline ticks / deadlineDays pass
 * - Emits `target:update` via Socket.io
 */

import { Target } from '../models/Target.js';
import { Stock } from '../models/Stock.js';
import { getMarketEngine } from '../services/marketEngine.js';
import { closedFormTouchProb, closedFormTerminalProb } from '../math/probability.js';
import { TIME_CONFIG } from '../config/time.js';
import { getEstimatedStockParams } from '../routes/target.routes.js';

let targetInterval = null;

/**
 * Checks all active targets against current market prices and deadline ticks.
 */
export async function checkAndResolveTargets(io = null) {
  const engine = getMarketEngine();
  if (!engine) return;

  const currentTick = engine.globalTick;
  const activeTargets = await Target.find({ status: 'ACTIVE' }).populate('stockId');
  const paramCache = new Map();

  for (const target of activeTargets) {
    const stock = target.stockId;
    if (!stock) continue;

    const live = engine.getState(String(stock._id)) || engine.getState(stock.symbol);
    const currentPrice = live ? live.price : stock.currentPrice;

    const isUpside = target.targetPrice >= target.startPrice;
    const isHit = isUpside ? currentPrice >= target.targetPrice : currentPrice <= target.targetPrice;

    // Deadline check: deadlineDays * 390 ticks from startTick
    const elapsedTicks = currentTick - target.startTick;
    const totalDeadlineTicks = target.deadlineDays * TIME_CONFIG.TICKS_PER_DAY;
    const isExpired = elapsedTicks >= totalDeadlineTicks;

    let updated = false;

    if (isHit) {
      target.status = 'HIT';
      updated = true;
    } else if (isExpired) {
      target.status = 'MISSED';
      updated = true;
    } else {
      // Update live probability
      const remainingTicks = Math.max(0, totalDeadlineTicks - elapsedTicks);
      const remainingDays = remainingTicks / TIME_CONFIG.TICKS_PER_DAY;
      const T = remainingDays / TIME_CONFIG.DAYS_PER_YEAR;

      let params = paramCache.get(String(stock._id));
      if (!params) {
        params = await getEstimatedStockParams(stock._id, 0.10, 0.20);
        paramCache.set(String(stock._id), params);
      }
      const muEst = params.muEstimated;
      const sigmaEst = params.sigmaEstimated;

      const prob = target.mode === 'terminal'
        ? closedFormTerminalProb(currentPrice, target.targetPrice, muEst, sigmaEst, T)
        : closedFormTouchProb(currentPrice, target.targetPrice, muEst, sigmaEst, T);

      target.lastProbability = Math.round(prob * 10000) / 10000;
      await target.save();
    }

    if (updated) {
      await target.save();
      const socketServer = io || engine.io;
      if (socketServer) {
        socketServer.to(`user:${target.userId}`).emit('target:update', {
          targetId: target._id,
          stockId: stock._id,
          symbol: stock.symbol,
          status: target.status,
          targetPrice: target.targetPrice,
          resolvedPrice: Math.round(currentPrice * 100) / 100,
          resolvedAtTick: currentTick
        });
      }

      // Auto-notify customer of Target resolution
      try {
        const { getAlertEngine } = await import('../services/alertEngine.js');
        const alertEng = getAlertEngine();
        if (alertEng) {
          await alertEng.notifyTargetResolution(target, stock, currentPrice, currentTick);
        }
      } catch (e) {
        console.warn('[TargetWatcher] Failed to trigger resolution notification:', e.message);
      }
    }
  }
}

/**
 * Starts target resolution background watcher (runs every 2 seconds).
 */
export function startTargetWatcher(io = null, intervalMs = 2000) {
  if (targetInterval) return;
  targetInterval = setInterval(() => {
    checkAndResolveTargets(io).catch((err) => {
      console.warn('[TargetWatcher] Error resolving targets:', err.message);
    });
  }, intervalMs);
}

export function stopTargetWatcher() {
  if (targetInterval) {
    clearInterval(targetInterval);
    targetInterval = null;
  }
}
