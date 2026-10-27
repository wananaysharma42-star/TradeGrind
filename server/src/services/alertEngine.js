/**
 * alertEngine.js - In-memory Rule Engine for Real-Time Customizable Notifications
 *
 * Rules:
 * - PRICE_ABOVE: edge-triggered (prev <= threshold && current > threshold)
 * - PRICE_BELOW: edge-triggered (prev >= threshold && current < threshold)
 * - PCT_CHANGE: |price / dayOpen - 1| >= threshold%
 * - PROB_BELOW / PROB_ABOVE: For linked Target, recomputed closed-form probability every 30 ticks;
 *   triggers on threshold cross; stores lastProbability; emits `target:update` on every recompute.
 *
 * Respects cooldownTicks.
 * Emits `notification:new` to room `user:${userId}`.
 * Auto-notifies when a Target is HIT or MISSED.
 */

import { EventEmitter } from 'events';
import { AlertRule } from '../models/AlertRule.js';
import { Notification } from '../models/Notification.js';
import { Target } from '../models/Target.js';
import { Stock } from '../models/Stock.js';
import { DailyCandle } from '../models/DailyCandle.js';
import { closedFormTouchProb, closedFormTerminalProb } from '../math/probability.js';
import { blendedParams, logReturns } from '../math/returns.js';
import { TIME_CONFIG } from '../config/time.js';

let alertEngineSingleton = null;

export function getAlertEngine() {
  return alertEngineSingleton;
}

export function setAlertEngine(engine) {
  alertEngineSingleton = engine;
}

export class AlertEngine extends EventEmitter {
  constructor(marketEngine, io = null) {
    super();
    this.marketEngine = marketEngine;
    this.io = io;
    // Map: stockId (string) -> Array of AlertRule documents/objects
    this.rulesByStock = new Map();
    // Map: targetId (string) -> Array of AlertRule documents/objects
    this.rulesByTarget = new Map();
    // Cache previous tick price per stockId to support edge-triggering
    this.prevPriceByStock = new Map();
    // Cache estimated params per stock to avoid querying candles on every single tick
    this.stockParamsCache = new Map(); // stockId -> { mu, sigma, cachedAtTick }

    this.onTickHandler = this.onTick.bind(this);
    if (this.marketEngine) {
      this.marketEngine.on('tick', this.onTickHandler);
    }
  }

  destroy() {
    if (this.marketEngine && this.onTickHandler) {
      this.marketEngine.off('tick', this.onTickHandler);
    }
  }

  /**
   * Reload all active AlertRules from database into in-memory indices.
   */
  async reloadRules() {
    try {
      const activeRules = await AlertRule.find({ active: true })
        .populate('targetId')
        .populate('stockId')
        .lean();

      const byStock = new Map();
      const byTarget = new Map();

      for (const rule of activeRules) {
        if (rule.stockId) {
          const sId = String(rule.stockId._id || rule.stockId);
          if (!byStock.has(sId)) byStock.set(sId, []);
          byStock.get(sId).push(rule);
        }
        if (rule.targetId) {
          const tId = String(rule.targetId._id || rule.targetId);
          if (!byTarget.has(tId)) byTarget.set(tId, []);
          byTarget.get(tId).push(rule);

          // If rule is linked to target, also index under target's stockId if not already present
          const targetStockId = rule.targetId.stockId ? String(rule.targetId.stockId._id || rule.targetId.stockId) : null;
          if (targetStockId && targetStockId !== String(rule.stockId?._id || rule.stockId)) {
            if (!byStock.has(targetStockId)) byStock.set(targetStockId, []);
            byStock.get(targetStockId).push(rule);
          }
        }
      }

      this.rulesByStock = byStock;
      this.rulesByTarget = byTarget;
    } catch (err) {
      console.warn('[AlertEngine] Failed to reload rules from DB:', err.message);
    }
  }

  /**
   * Estimates mu and sigma for a stock from the last 30 daily candles (cached for 100 ticks).
   */
  async getEstimatedParams(stockId, currentTick, fallbackMu = 0.10, fallbackSigma = 0.20) {
    const sId = String(stockId);
    const cached = this.stockParamsCache.get(sId);
    if (cached && (currentTick - cached.cachedAtTick) < 100) {
      return cached;
    }

    try {
      const candles = await DailyCandle.find({ stockId })
        .sort({ simDay: -1 })
        .limit(31)
        .lean();

      if (candles.length >= 5) {
        const prices = candles.reverse().map((c) => c.close);
        const r = logReturns(prices);
        if (r.length >= 2) {
          const dt = 1 / TIME_CONFIG.DAYS_PER_YEAR;
          const { muAnnual, sigmaAnnual } = blendedParams(r, dt, 0.94);
          const params = {
            mu: muAnnual,
            sigma: Math.max(0.05, sigmaAnnual),
            cachedAtTick: currentTick
          };
          this.stockParamsCache.set(sId, params);
          return params;
        }
      }
    } catch (e) {
      // ignore
    }

    const fallback = { mu: fallbackMu, sigma: fallbackSigma, cachedAtTick: currentTick };
    this.stockParamsCache.set(sId, fallback);
    return fallback;
  }

  /**
   * Main tick listener called whenever MarketEngine emits 'tick'.
   * @param {Map} states - Map of stockId -> in-memory market state
   */
  async onTick(states) {
    if (!states || states.size === 0) return;
    const currentTick = this.marketEngine?.globalTick || 1;

    for (const [stockId, state] of states.entries()) {
      const sId = String(stockId);
      const currentPrice = state.price;
      const prevPrice = this.prevPriceByStock.has(sId)
        ? this.prevPriceByStock.get(sId)
        : currentPrice; // First tick: treat as same price so edge won't spuriously fire
      const dayOpen = state.dayOpen || state.price;

      // Update stored previous price for next tick edge detection
      this.prevPriceByStock.set(sId, currentPrice);

      const rules = this.rulesByStock.get(sId);
      if (!rules || rules.length === 0) continue;

      for (const rule of rules) {
        await this._evaluateRule(rule, state, prevPrice, currentPrice, dayOpen, currentTick);
      }
    }
  }

  /**
   * Evaluates a single alert rule against current tick information.
   */
  async _evaluateRule(rule, state, prevPrice, currentPrice, dayOpen, currentTick) {
    if (!rule.active) return;

    // Check cooldown
    const cooldown = rule.cooldownTicks != null ? rule.cooldownTicks : 390;
    if (rule.lastTriggeredTick != null && (currentTick - rule.lastTriggeredTick) < cooldown) {
      return;
    }

    const threshold = Number(rule.threshold);
    let triggered = false;
    let title = '';
    let message = '';
    let payload = {
      stockId: state.id,
      symbol: state.symbol,
      tick: currentTick,
      price: currentPrice
    };

    switch (rule.type) {
      case 'PRICE_ABOVE': {
        // Edge triggered: previously <= threshold AND currently > threshold
        if (prevPrice <= threshold && currentPrice > threshold) {
          triggered = true;
          title = `${state.symbol} Crossed Above $${threshold.toFixed(2)}`;
          message = `${state.symbol} rose from $${prevPrice.toFixed(2)} to $${currentPrice.toFixed(2)}, crossing above $${threshold.toFixed(2)}.`;
          payload.prevPrice = prevPrice;
          payload.threshold = threshold;
        }
        break;
      }

      case 'PRICE_BELOW': {
        // Edge triggered: previously >= threshold AND currently < threshold
        if (prevPrice >= threshold && currentPrice < threshold) {
          triggered = true;
          title = `${state.symbol} Crossed Below $${threshold.toFixed(2)}`;
          message = `${state.symbol} dropped from $${prevPrice.toFixed(2)} to $${currentPrice.toFixed(2)}, crossing below $${threshold.toFixed(2)}.`;
          payload.prevPrice = prevPrice;
          payload.threshold = threshold;
        }
        break;
      }

      case 'PCT_CHANGE': {
        // |price / dayOpen - 1| >= threshold%
        // threshold can be given in percent (e.g. 5 for 5%) or fraction (0.05). If threshold < 1, assume fraction; if >= 1, assume percent.
        const threshPct = threshold >= 1 ? threshold : threshold * 100;
        const currentPct = Math.abs((currentPrice / dayOpen) - 1) * 100;
        if (currentPct >= threshPct) {
          triggered = true;
          const signedPct = ((currentPrice / dayOpen) - 1) * 100;
          title = `${state.symbol} Day Move of ${signedPct >= 0 ? '+' : ''}${signedPct.toFixed(2)}%`;
          message = `${state.symbol} intraday price has shifted by ${Math.abs(signedPct).toFixed(2)}% from day open of $${dayOpen.toFixed(2)}.`;
          payload.dayOpen = dayOpen;
          payload.changePct = signedPct;
          payload.thresholdPct = threshPct;
        }
        break;
      }

      case 'PROB_BELOW':
      case 'PROB_ABOVE': {
        if (!rule.targetId) break;

        // Recompute every 30 ticks
        const shouldRecompute = (currentTick % 30 === 0) || (rule.lastProbability == null);
        if (!shouldRecompute) break;

        const target = await Target.findById(rule.targetId._id || rule.targetId);
        if (!target || target.status !== 'ACTIVE') break;

        const elapsedTicks = Math.max(0, currentTick - target.startTick);
        const totalDeadlineTicks = target.deadlineDays * TIME_CONFIG.TICKS_PER_DAY;
        const remainingTicks = Math.max(0, totalDeadlineTicks - elapsedTicks);
        const remainingDays = remainingTicks / TIME_CONFIG.TICKS_PER_DAY;
        const T = remainingDays / TIME_CONFIG.DAYS_PER_YEAR;

        const params = await this.getEstimatedParams(target.stockId, currentTick, state.mu, state.sigma);

        const newProb = target.mode === 'terminal'
          ? closedFormTerminalProb(currentPrice, target.targetPrice, params.mu, params.sigma, T)
          : closedFormTouchProb(currentPrice, target.targetPrice, params.mu, params.sigma, T);

        const roundedProb = Math.round(newProb * 10000) / 10000;
        const prevProb = rule.lastProbability != null ? rule.lastProbability : target.lastProbability;

        // Store lastProbability on Target & emit target:update on every recompute
        target.lastProbability = roundedProb;
        await target.save();

        const socketServer = this.io || this.marketEngine?.io;
        if (socketServer) {
          socketServer.to(`user:${target.userId}`).emit('target:update', {
            targetId: target._id,
            stockId: target.stockId,
            symbol: state.symbol,
            status: target.status,
            targetPrice: target.targetPrice,
            currentPrice: Math.round(currentPrice * 100) / 100,
            probability: roundedProb,
            tick: currentTick
          });
        }

        // Compare against rule threshold (e.g. 0.50 or 50)
        const threshProb = threshold > 1 ? threshold / 100 : threshold;
        const prevProbNorm = prevProb != null ? (prevProb > 1 ? prevProb / 100 : prevProb) : roundedProb;

        if (rule.type === 'PROB_BELOW') {
          // Edge/crossing trigger: prev >= threshold && current < threshold
          if (prevProbNorm >= threshProb && roundedProb < threshProb) {
            triggered = true;
            title = `${state.symbol} Target Probability Dropped Below ${(threshProb * 100).toFixed(1)}%`;
            message = `Probability of hitting target $${target.targetPrice.toFixed(2)} dropped to ${(roundedProb * 100).toFixed(1)}%.`;
            payload.targetPrice = target.targetPrice;
            payload.probability = roundedProb;
            payload.prevProbability = prevProbNorm;
          }
        } else if (rule.type === 'PROB_ABOVE') {
          // Edge/crossing trigger: prev <= threshold && current > threshold
          if (prevProbNorm <= threshProb && roundedProb > threshProb) {
            triggered = true;
            title = `${state.symbol} Target Probability Rose Above ${(threshProb * 100).toFixed(1)}%`;
            message = `Probability of hitting target $${target.targetPrice.toFixed(2)} rose to ${(roundedProb * 100).toFixed(1)}%.`;
            payload.targetPrice = target.targetPrice;
            payload.probability = roundedProb;
            payload.prevProbability = prevProbNorm;
          }
        }

        // Save last probability on rule in memory and in DB
        rule.lastProbability = roundedProb;
        await AlertRule.findByIdAndUpdate(rule._id, { lastProbability: roundedProb });
        break;
      }

      case 'VOLATILITY_ABOVE': {
        // threshold in percent (e.g. 25 for 25% or 0.25)
        const threshVol = threshold > 1 ? threshold / 100 : threshold;
        const currentVol = state.rollingVol != null ? state.rollingVol : state.sigma;
        const prevVol = rule.lastValue != null ? rule.lastValue : currentVol;

        // Edge triggered: prevVol <= threshVol && currentVol > threshVol
        if (prevVol <= threshVol && currentVol > threshVol) {
          triggered = true;
          title = `${state.symbol} Volatility Surpassed ${(threshVol * 100).toFixed(1)}%`;
          message = `${state.symbol} annualized volatility increased to ${(currentVol * 100).toFixed(1)}% (threshold: ${(threshVol * 100).toFixed(1)}%).`;
          payload.volatility = currentVol;
          payload.prevVolatility = prevVol;
          payload.threshold = threshVol;
        }
        rule.lastValue = currentVol;
        break;
      }

      case 'RANK_BELOW': {
        // Overall market score rank: e.g. dropped below rank 10
        const currentRank = state.overallRank != null ? state.overallRank : 1;
        const prevRank = rule.lastValue != null ? rule.lastValue : currentRank;

        if (prevRank <= threshold && currentRank > threshold) {
          triggered = true;
          title = `${state.symbol} Dropped Below Rank #${threshold}`;
          message = `${state.symbol} overall market rank degraded to #${currentRank} (previously #${prevRank}).`;
          payload.overallRank = currentRank;
          payload.prevRank = prevRank;
          payload.threshold = threshold;
        }
        rule.lastValue = currentRank;
        break;
      }

      case 'HOLDER_COUNT_BELOW': {
        // Holder count drops below threshold
        const engine = this.marketEngine;
        const sId = String(state.stockId || state.id);
        const count = engine?.holderCounts?.get(sId) ?? 0;
        const prevCount = rule.lastValue != null ? rule.lastValue : count;

        if (prevCount >= threshold && count < threshold) {
          triggered = true;
          title = `${state.symbol} Holder Count Dropped Below ${threshold}`;
          message = `Active holders of ${state.symbol} decreased to ${count} (threshold: ${threshold}).`;
          payload.holderCount = count;
          payload.prevHolderCount = prevCount;
          payload.threshold = threshold;
        }
        rule.lastValue = count;
        break;
      }

      default:
        break;
    }

    if (triggered) {
      await this.triggerAlert(rule, title, message, payload, currentTick);
    }
  }

  /**
   * Persists a Notification, updates rule cooldown / lastTriggeredTick,
   * and emits `notification:new` to `user:${userId}`.
   */
  async triggerAlert(rule, title, message, payload, currentTick) {
    const ownerId = rule.ownerId?._id || rule.ownerId;
    if (!ownerId) return;

    // Update rule in memory & DB
    rule.lastTriggeredTick = currentTick;
    await AlertRule.findByIdAndUpdate(rule._id, { lastTriggeredTick: currentTick });

    // Persist Notification
    const notif = await Notification.create({
      userId: ownerId,
      alertRuleId: rule._id,
      title,
      message,
      payload,
      severity: 'info',
      read: false
    });

    // Emit live event
    const socketServer = this.io || this.marketEngine?.io;
    if (socketServer) {
      socketServer.to(`user:${ownerId}`).emit('notification:new', {
        _id: notif._id,
        userId: ownerId,
        alertRuleId: rule._id,
        title,
        message,
        payload,
        severity: 'info',
        read: false,
        createdAt: notif.createdAt
      });
    }

    this.emit('alert:triggered', { rule, notif });
  }

  /**
   * Auto-notify when a Target resolves to HIT or MISSED.
   */
  async notifyTargetResolution(target, stock, currentPrice, currentTick) {
    const isHit = target.status === 'HIT';
    const title = isHit
      ? `🎯 Target HIT: ${stock.symbol} reached $${target.targetPrice.toFixed(2)}`
      : `⏳ Target MISSED: ${stock.symbol} deadline expired`;

    const message = isHit
      ? `${stock.symbol} crossed your target price of $${target.targetPrice.toFixed(2)} at $${Number(currentPrice).toFixed(2)}.`
      : `${stock.symbol} did not reach $${target.targetPrice.toFixed(2)} within the ${target.deadlineDays}-day window.`;

    const notif = await Notification.create({
      userId: target.userId,
      alertRuleId: null,
      title,
      message,
      payload: {
        targetId: target._id,
        stockId: stock._id,
        symbol: stock.symbol,
        status: target.status,
        targetPrice: target.targetPrice,
        resolvedPrice: Number(currentPrice),
        tick: currentTick
      },
      severity: isHit ? 'success' : 'warning',
      read: false
    });

    const socketServer = this.io || this.marketEngine?.io;
    if (socketServer) {
      socketServer.to(`user:${target.userId}`).emit('notification:new', {
        _id: notif._id,
        userId: target.userId,
        alertRuleId: null,
        title,
        message,
        payload: notif.payload,
        severity: notif.severity,
        read: false,
        createdAt: notif.createdAt
      });
    }
  }

  /**
   * Backtest / preview a draft rule over the last 30 simulated days.
   * Checks how many times the rule WOULD have triggered and records timestamps/ticks.
   */
  static async previewRule({ stockId, type, threshold, cooldownTicks = 390 }) {
    const candles = await DailyCandle.find({ stockId })
      .sort({ simDay: 1 })
      .limit(30)
      .lean();

    const thresh = Number(threshold);
    let triggers = [];
    let lastTriggerDay = -999;
    let prevClose = null;

    for (const candle of candles) {
      let fired = false;
      let triggerPrice = candle.close;

      if (type === 'PRICE_ABOVE') {
        if (prevClose != null && prevClose <= thresh && candle.high > thresh) {
          fired = true;
          triggerPrice = thresh;
        }
      } else if (type === 'PRICE_BELOW') {
        if (prevClose != null && prevClose >= thresh && candle.low < thresh) {
          fired = true;
          triggerPrice = thresh;
        }
      } else if (type === 'PCT_CHANGE') {
        const threshPct = thresh >= 1 ? thresh : thresh * 100;
        const maxMovePct = Math.max(
          Math.abs((candle.high / candle.open) - 1) * 100,
          Math.abs((candle.low / candle.open) - 1) * 100
        );
        if (maxMovePct >= threshPct) {
          fired = true;
        }
      }

      if (fired) {
        // In days, cooldownTicks / 390 is cooldown in days
        const cooldownDays = Math.max(1, Math.round(cooldownTicks / TIME_CONFIG.TICKS_PER_DAY));
        if (candle.simDay - lastTriggerDay >= cooldownDays) {
          triggers.push({
            simDay: candle.simDay,
            price: triggerPrice,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            date: candle.createdAt
          });
          lastTriggerDay = candle.simDay;
        }
      }

      prevClose = candle.close;
    }

    return {
      totalSimulatedDays: candles.length,
      triggerCount: triggers.length,
      triggers
    };
  }
}
