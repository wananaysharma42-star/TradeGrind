import { EventEmitter } from 'events';
import { Stock } from '../models/Stock.js';
import { PriceTick } from '../models/PriceTick.js';
import { DailyCandle } from '../models/DailyCandle.js';
import { Holding } from '../models/Holding.js';
import { User } from '../models/User.js';
import { PortfolioSnapshot } from '../models/PortfolioSnapshot.js';
import { mulberry32, randn, nextPrice, simulatePath } from '../math/gbm.js';
import { TIME_CONFIG, formatSimTime } from '../config/time.js';

const TICKS_PER_DAY = TIME_CONFIG.TICKS_PER_DAY;
const DT = TIME_CONFIG.DT;
const DAILY_DT = 1 / TIME_CONFIG.DAYS_PER_YEAR;
const MIN_CANDLES_TRIGGER = 90;
const BACKFILL_DAYS = 252; // cover 1Y
const INTRADAY_BACKFILL_DAYS = 5;
const SPARKLINE_LEN = 30;
const LOG_WINDOW = 390;
const PERSIST_EVERY = 10;
const COMPANY_EMIT_EVERY = 5;
const JUMP_LAMBDA = 1 / (20 * TICKS_PER_DAY); // ~1 jump per 20 sim days

let singleton = null;

export function setMarketEngine(engine) {
  singleton = engine;
}

export function getMarketEngine() {
  return singleton;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function seedFromString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function lognormalVolume(rng, median = 1_200_000, sigma = 0.45) {
  const z = randn(rng);
  return Math.max(1, Math.round(Math.exp(Math.log(median) + sigma * z)));
}

function toId(value) {
  return value == null ? null : String(value);
}

export function simDayFromTick(tickIndex) {
  if (!tickIndex || tickIndex <= 0) return 1;
  return Math.floor((tickIndex - 1) / TICKS_PER_DAY) + 1;
}

export class MarketEngine extends EventEmitter {
  constructor(io = null) {
    super();
    this.io = io;
    this.intervalId = null;
    this.globalTick = 0;
    this.states = new Map(); // stockId -> in-memory state
    this.bySymbol = new Map();
    this.pendingTicks = [];
    this.pendingShocks = new Map(); // stockId -> pct
    this.persistCounter = 0;
    this.connectedCustomers = new Map();
    this.connectedCompanies = new Map();
    this.connectionCounts = new Map();
    this.holderCounts = new Map();
    this.lastTickDurationMs = 0;
    this.rng = mulberry32((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);
    this.enableRareJumps = process.env.ENABLE_RARE_JUMPS === 'true' || process.env.MARKET_JUMPS === 'true';
    this.persisting = false;
    this.closingDay = false;
  }

  async initialize() {
    const dbStocks = await Stock.find().lean();
    const tickAgg = await PriceTick.aggregate([
      { $group: { _id: null, maxTick: { $max: '$tickIndex' } } }
    ]);
    const maxTickFromTicks = tickAgg[0]?.maxTick || 0;
    const maxTickFromStocks = dbStocks.reduce((m, s) => Math.max(m, s.tickCount || 0), 0);
    this.globalTick = Math.max(maxTickFromTicks, maxTickFromStocks);

    for (const doc of dbStocks) {
      await this._hydrateStock(doc);
    }

    await this._backfillAll();
    await this._restoreOpenDay();
    await this._refreshHolderCounts();

    console.log(`[MarketEngine] Ready with ${this.states.size} stocks at tick ${this.globalTick}`);
    this.intervalMs = TIME_CONFIG.TICK_INTERVAL_MS;
    this.speedMultiplier = 1;
  }

  start() {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => {
      try {
        this.tick();
      } catch (err) {
        console.error('[MarketEngine] Tick failed:', err);
      }
    }, this.intervalMs);
    console.log(`[MarketEngine] Tick loop started (${this.intervalMs} ms)`);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  setSpeed(multiplier) {
    const num = Number(multiplier);
    if (!Number.isFinite(num) || num <= 0) return false;
    this.speedMultiplier = num;
    this.intervalMs = Math.max(10, Math.round(TIME_CONFIG.TICK_INTERVAL_MS / num));
    if (this.intervalId) {
      this.stop();
      this.start();
    }
    return true;
  }

  applyShock(stockId, pct) {
    const id = this._resolveStockId(stockId);
    if (!id || !Number.isFinite(pct)) return false;
    this.pendingShocks.set(id, pct);
    return true;
  }

  getState(stockIdOrSymbol) {
    const id = this._resolveStockId(stockIdOrSymbol);
    return id ? this.states.get(id) : null;
  }

  getStateMap() {
    return this.states;
  }

  /**
   * Register a newly created COMPANY stock without restarting the engine.
   */
  async ingestNewStock(stockDoc) {
    const doc = stockDoc.toObject ? stockDoc.toObject() : stockDoc;
    await this._hydrateStock(doc);
    await this._backfillStock(this.states.get(String(doc._id)));
    await this._refreshHolderCounts();
  }

  async addUserConnection(userId, role) {
    const id = String(userId);
    this.connectionCounts.set(id, (this.connectionCounts.get(id) || 0) + 1);
    if (role === 'CUSTOMER') {
      await this.syncUserPortfolio(id);
    } else if (role === 'COMPANY') {
      const user = await User.findById(id).select('stockId role').lean();
      if (user?.stockId) {
        this.connectedCompanies.set(id, String(user.stockId));
      }
    }
  }

  removeUserConnection(userId) {
    const id = String(userId);
    const next = (this.connectionCounts.get(id) || 1) - 1;
    if (next <= 0) {
      this.connectionCounts.delete(id);
      this.connectedCustomers.delete(id);
      this.connectedCompanies.delete(id);
    } else {
      this.connectionCounts.set(id, next);
    }
  }

  async syncUserPortfolio(userId, emitNow = false) {
    const id = String(userId);
    const user = await User.findById(id).select('virtualBalance role').lean();
    if (!user || user.role !== 'CUSTOMER') return null;

    const holdings = await Holding.find({ userId: id }).lean();
    const mapped = holdings
      .filter((h) => h.quantity > 0)
      .map((h) => ({
        stockId: String(h.stockId),
        quantity: h.quantity,
        avgBuyPrice: h.avgBuyPrice || h.averageBuyPrice || 0
      }));

    const totalValue = this._portfolioValue(user.virtualBalance, mapped);
    const existing = this.connectedCustomers.get(id);
    const dayStartValue = existing?.dayStartValue ?? totalValue;
    this.connectedCustomers.set(id, {
      cash: user.virtualBalance,
      holdings: mapped,
      dayStartValue
    });
    await this._refreshHolderCounts();

    const cash = user.virtualBalance;
    let holdingsValue = 0;
    const formattedHoldings = mapped.map((h) => {
      const st = this.states.get(h.stockId);
      const price = st ? st.price : h.avgBuyPrice;
      const val = h.quantity * price;
      holdingsValue += val;
      const cost = h.quantity * h.avgBuyPrice;
      const pnl = val - cost;
      const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0;
      return {
        stockId: h.stockId,
        symbol: st?.symbol,
        quantity: h.quantity,
        price: round2(price),
        currentPrice: round2(price),
        value: round2(val),
        marketValue: round2(val),
        currentValue: round2(val),
        pnl: round2(pnl),
        unrealizedPnL: round2(pnl),
        pnlPercent: round2(pnlPercent),
        unrealizedPnLPercent: round2(pnlPercent)
      };
    });

    const finalTotal = cash + holdingsValue;
    formattedHoldings.forEach((h) => {
      h.allocationPercent = finalTotal > 0 ? round2((h.value / finalTotal) * 100) : 0;
    });

    const dayPnL = finalTotal - dayStartValue;
    const totalInvested = mapped.reduce((acc, h) => acc + (h.quantity * h.avgBuyPrice), 0);
    const totalUnrealizedPnl = holdingsValue - totalInvested;
    const totalUnrealizedPnlPercent = totalInvested > 0 ? (totalUnrealizedPnl / totalInvested) * 100 : 0;
    const snapshot = {
      totalValue: round2(finalTotal),
      totalPortfolioValue: round2(finalTotal),
      cash: round2(cash),
      cashBalance: round2(cash),
      holdingsValue: round2(holdingsValue),
      totalHoldingsValue: round2(holdingsValue),
      dayPnL: round2(dayPnL),
      totalUnrealizedPnl: round2(totalUnrealizedPnl),
      totalUnrealizedPnlPercent: round2(totalUnrealizedPnlPercent),
      holdings: formattedHoldings
    };

    if (emitNow && this.io) {
      this.io.to(`user:${id}`).emit('portfolio:update', snapshot);
    }

    return snapshot;
  }

  /**
   * Hot path: advance every stock one tick. Persistence is async.
   */
  tick() {
    const t0 = performance.now();
    this.globalTick += 1;
    const tickIndex = this.globalTick;
    const simDay = simDayFromTick(tickIndex);
    const dayEnded = tickIndex % TICKS_PER_DAY === 0;
    const ts = new Date();

    const marketPayload = [];

    for (const state of this.states.values()) {
      const prev = state.price;

      const shock = this.pendingShocks.get(state.stockId);
      if (shock != null) {
        state.price = Math.max(0.01, state.price * (1 + shock));
        this.pendingShocks.delete(state.stockId);
      }

      if (this.enableRareJumps && this.rng() < JUMP_LAMBDA) {
        const jump = -0.01 + 0.03 * randn(this.rng);
        state.price = Math.max(0.01, state.price * (1 + jump));
      }

      const Z = randn(this.rng);
      state.price = Math.max(0.01, nextPrice(state.price, state.mu, state.sigma, DT, Z));
      state.tickIndex = tickIndex;
      state.simDay = simDay;

      if (state.dayOpen == null) state.dayOpen = state.price;
      state.dayHigh = Math.max(state.dayHigh, state.price);
      state.dayLow = Math.min(state.dayLow, state.price);
      state.dayVolume += 1;

      const lr = Math.log(state.price / prev);
      state.logReturns.push(lr);
      if (state.logReturns.length > LOG_WINDOW) state.logReturns.shift();

      state.recentPrices.push(state.price);
      if (state.recentPrices.length > SPARKLINE_LEN) state.recentPrices.shift();

      if (state.oid) {
        this.pendingTicks.push({
          stockId: state.oid,
          price: state.price,
          tickIndex,
          simDay,
          ts
        });
      }

      const changePct = state.previousClose > 0
        ? ((state.price - state.previousClose) / state.previousClose) * 100
        : 0;

      marketPayload.push({
        stockId: state.stockId,
        symbol: state.symbol,
        price: round2(state.price),
        currentPrice: round2(state.price),
        changePct: round2(changePct),
        dayChangePercent: round2(changePct),
        dayHigh: round2(state.dayHigh),
        dayLow: round2(state.dayLow),
        volume: state.dayVolume
      });

      this._emitStockTick(state);
    }

    const clock = formatSimTime(tickIndex);
    this._emitMarketTick({
      globalTick: tickIndex,
      simTime: {
        day: simDay,
        timeStr: clock.timeStr,
        formatted: clock.formatted
      },
      stocks: marketPayload
    });
    this._emitPortfolios();
    if (tickIndex % COMPANY_EMIT_EVERY === 0) {
      this._emitCompanies();
    }

    this.persistCounter += 1;
    const shouldPersist = this.persistCounter >= PERSIST_EVERY;
    if (shouldPersist) this.persistCounter = 0;

    this.lastTickDurationMs = performance.now() - t0;
    this.emit('tick', this.states);

    if (shouldPersist) {
      this._flushTicks().catch((err) => console.error('[MarketEngine] persist failed:', err.message));
    }
    if (dayEnded) {
      this._closeSimulatedDay(simDay).catch((err) => console.error('[MarketEngine] day close failed:', err.message));
    }
  }

  getPublicList() {
    const out = [];
    for (const state of this.states.values()) {
      const changePct = state.previousClose > 0
        ? ((state.price - state.previousClose) / state.previousClose) * 100
        : 0;
      out.push({
        _id: state.stockId,
        id: state.stockId,
        stockId: state.stockId,
        symbol: state.symbol,
        name: state.name,
        sector: state.sector,
        price: round2(state.price),
        currentPrice: round2(state.price),
        changePct: round2(changePct),
        dayChangePercent: round2(changePct),
        viewCount: state.viewCount,
        sparkline: state.recentPrices.map(round2)
      });
    }
    return out;
  }

  incrementViewCount(stockId) {
    const state = this.getState(stockId);
    if (!state) return 0;
    state.viewCount += 1;
    Stock.updateOne({ _id: state.oid }, { $inc: { viewCount: 1 } }).catch(() => {});
    return state.viewCount;
  }

  // --- internals ---

  _resolveStockId(stockIdOrSymbol) {
    if (stockIdOrSymbol == null) return null;
    const key = String(stockIdOrSymbol);
    if (this.states.has(key)) return key;
    if (this.bySymbol.has(key.toUpperCase())) return this.bySymbol.get(key.toUpperCase());
    return null;
  }

  _makeState(doc, extras = {}) {
    const stockId = String(doc._id);
    const price = doc.currentPrice;
    return {
      oid: doc._id,
      stockId,
      symbol: doc.symbol,
      name: doc.name || doc.companyName,
      sector: doc.sector,
      mu: doc.mu,
      sigma: doc.sigma,
      price,
      previousClose: doc.previousClose || price,
      tickIndex: doc.tickCount || this.globalTick,
      simDay: simDayFromTick(doc.tickCount || this.globalTick),
      dayOpen: price,
      dayHigh: price,
      dayLow: price,
      dayVolume: 0,
      logReturns: [],
      recentPrices: [price],
      viewCount: doc.viewCount || 0,
      ownerCompany: toId(doc.ownerCompany),
      totalShares: doc.totalShares || 50_000_000,
      ...extras
    };
  }

  async _hydrateStock(doc) {
    const state = this._makeState(doc);
    // Resume from last persisted tick price if a tick exists after stock.currentPrice write lag
    const lastTick = await PriceTick.findOne({ stockId: doc._id }).sort({ tickIndex: -1 }).lean();
    if (lastTick) {
      state.price = lastTick.price;
      state.tickIndex = lastTick.tickIndex;
      state.simDay = lastTick.simDay;
    }
    this.states.set(state.stockId, state);
    this.bySymbol.set(state.symbol, state.stockId);
  }

  async _backfillAll() {
    for (const state of this.states.values()) {
      await this._backfillStock(state);
    }
    const maxTick = [...this.states.values()].reduce((m, s) => Math.max(m, s.tickIndex || 0), 0);
    if (maxTick > this.globalTick) this.globalTick = maxTick;
  }

  async _backfillStock(state) {
    if (!state) return;
    const candleCount = await DailyCandle.countDocuments({ stockId: state.oid });
    if (candleCount < MIN_CANDLES_TRIGGER) {
      await this._generateDailyHistory(state, BACKFILL_DAYS);
    } else {
      const latest = await DailyCandle.find({ stockId: state.oid }).sort({ simDay: -1 }).limit(SPARKLINE_LEN).lean();
      if (latest.length) {
        state.recentPrices = latest.reverse().map((c) => c.close);
        if (!state.previousClose) {
          state.previousClose = latest[latest.length - 1].close;
        }
      }
    }

    const tickCount = await PriceTick.countDocuments({ stockId: state.oid });
    const wantTicks = INTRADAY_BACKFILL_DAYS * TICKS_PER_DAY;
    if (tickCount < wantTicks) {
      await this._generateIntradayHistory(state, INTRADAY_BACKFILL_DAYS);
    } else {
      const recent = await PriceTick.find({ stockId: state.oid })
        .sort({ tickIndex: -1 })
        .limit(SPARKLINE_LEN)
        .lean();
      if (recent.length) {
        state.recentPrices = recent.reverse().map((t) => t.price);
      }
    }
  }

  async _generateDailyHistory(state, days) {
    const rng = mulberry32(seedFromString(`${state.symbol}:daily:${days}`));
    // Walk backward from current live price so restart/backfill has no discontinuity.
    let close = state.price;
    const candles = [];
    const endDay = Math.max(days, state.simDay || days);
    for (let i = 0; i < days; i++) {
      const Z = randn(rng);
      const open = close / Math.exp((state.mu - 0.5 * state.sigma * state.sigma) * DAILY_DT + state.sigma * Math.sqrt(DAILY_DT) * Z);
      const high = Math.max(open, close) * (1 + Math.abs(Z) * 0.004);
      const low = Math.min(open, close) * (1 - Math.abs(Z) * 0.004);
      const volume = lognormalVolume(rng);
      const logReturn = Math.log(close / open);
      candles.push({
        stockId: state.oid,
        simDay: endDay - i,
        open: round2(open),
        high: round2(high),
        low: round2(low),
        close: round2(close),
        volume,
        logReturn
      });
      close = open;
    }
    candles.reverse();

    await DailyCandle.bulkWrite(
      candles.map((c) => ({
        updateOne: {
          filter: { stockId: c.stockId, simDay: c.simDay },
          update: { $setOnInsert: c },
          upsert: true
        }
      })),
      { ordered: false }
    );

    const last = candles[candles.length - 1];
    state.previousClose = last.close;
    state.dayOpen = last.close;
    state.dayHigh = last.close;
    state.dayLow = last.close;
    state.simDay = last.simDay;
    state.tickIndex = last.simDay * TICKS_PER_DAY;
    state.recentPrices = candles.slice(-SPARKLINE_LEN).map((c) => c.close);
    state.logReturns = candles.slice(-LOG_WINDOW).map((c) => c.logReturn);

    await Stock.updateOne(
      { _id: state.oid },
      {
        $set: {
          previousClose: last.close,
          currentPrice: state.price,
          tickCount: state.tickIndex
        }
      }
    );
  }

  async _generateIntradayHistory(state, days) {
    const rng = mulberry32(seedFromString(`${state.symbol}:intraday:${days}`));
    const steps = days * TICKS_PER_DAY;
    const endTick = Math.max(state.tickIndex, steps);
    const startPriceGuess = state.price;
    const path = simulatePath(startPriceGuess, state.mu, state.sigma, DT, steps, rng);
    const scale = state.price / path[path.length - 1];
    const startTick = endTick - steps;
    const simDay0 = Math.floor(startTick / TICKS_PER_DAY);

    const docs = [];
    for (let i = 1; i <= steps; i++) {
      const tickIndex = startTick + i;
      const simDay = Math.floor((tickIndex - 1) / TICKS_PER_DAY) + 1;
      const price = i === steps ? state.price : round2(path[i] * scale);
      docs.push({
        stockId: state.oid,
        price,
        tickIndex,
        simDay: Math.max(1, simDay || simDay0),
        ts: new Date(Date.now() - (steps - i) * 1000)
      });
    }

    const CHUNK = 500;
    for (let i = 0; i < docs.length; i += CHUNK) {
      await PriceTick.insertMany(docs.slice(i, i + CHUNK), { ordered: false });
    }

    state.tickIndex = endTick;
    state.recentPrices = docs.slice(-SPARKLINE_LEN).map((d) => d.price);
    if (endTick > this.globalTick) this.globalTick = endTick;
  }

  async _restoreOpenDay() {
    for (const state of this.states.values()) {
      const simDay = Math.floor(this.globalTick / TICKS_PER_DAY) + (this.globalTick % TICKS_PER_DAY === 0 && this.globalTick > 0 ? 0 : 1);
      const dayTicks = await PriceTick.find({ stockId: state.oid, simDay })
        .sort({ tickIndex: 1 })
        .select('price')
        .lean();
      if (dayTicks.length) {
        const prices = dayTicks.map((t) => t.price);
        state.dayOpen = prices[0];
        state.dayHigh = Math.max(...prices);
        state.dayLow = Math.min(...prices);
        state.dayVolume = prices.length;
      } else {
        state.dayOpen = state.price;
        state.dayHigh = state.price;
        state.dayLow = state.price;
        state.dayVolume = 0;
      }
      state.simDay = Math.max(1, Math.floor((this.globalTick - 1) / TICKS_PER_DAY) + 1);
      state.tickIndex = this.globalTick;
    }
  }

  async _refreshHolderCounts() {
    const rows = await Holding.aggregate([
      { $match: { quantity: { $gt: 0 } } },
      { $group: { _id: '$stockId', n: { $sum: 1 } } }
    ]);
    this.holderCounts.clear();
    for (const row of rows) {
      this.holderCounts.set(String(row._id), row.n);
    }
  }

  _portfolioValue(cash, holdings) {
    let hv = 0;
    for (const h of holdings) {
      const st = this.states.get(h.stockId);
      hv += h.quantity * (st ? st.price : h.avgBuyPrice);
    }
    return cash + hv;
  }

  _emitMarketTick(payload) {
    if (!this.io) return;
    this.io.to('market').emit('market:tick', payload);
  }

  _emitStockTick(state) {
    if (!this.io) return;
    const payload = {
      price: round2(state.price),
      tickIndex: state.tickIndex,
      simDay: state.simDay,
      dayHigh: round2(state.dayHigh),
      dayLow: round2(state.dayLow)
    };
    this.io.to(`stock:${state.stockId}`).emit('stock:tick', payload);
    this.io.to(`stock:${state.symbol}`).emit('stock:tick', payload);
  }

  _emitPortfolios() {
    if (!this.io) return;
    for (const [userId, cache] of this.connectedCustomers.entries()) {
      const cash = cache.cash;
      let holdingsValue = 0;
      const holdings = cache.holdings.map((h) => {
        const st = this.states.get(h.stockId);
        const price = st ? st.price : h.avgBuyPrice;
        const value = h.quantity * price;
        holdingsValue += value;
        const cost = h.quantity * h.avgBuyPrice;
        const pnl = value - cost;
        const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0;
        return {
          stockId: h.stockId,
          symbol: st?.symbol,
          quantity: h.quantity,
          price: round2(price),
          currentPrice: round2(price),
          value: round2(value),
          marketValue: round2(value),
          currentValue: round2(value),
          pnl: round2(pnl),
          unrealizedPnL: round2(pnl),
          pnlPercent: round2(pnlPercent),
          unrealizedPnLPercent: round2(pnlPercent)
        };
      });

      const totalValue = cash + holdingsValue;
      holdings.forEach((h) => {
        h.allocationPercent = totalValue > 0 ? round2((h.value / totalValue) * 100) : 0;
      });

      const dayPnL = totalValue - cache.dayStartValue;
      const totalCostBasis = cache.holdings.reduce((acc, h) => acc + (h.quantity * h.avgBuyPrice), 0);
      const totalUnrealizedPnl = holdingsValue - totalCostBasis;
      const totalUnrealizedPnlPercent = totalCostBasis > 0 ? (totalUnrealizedPnl / totalCostBasis) * 100 : 0;
      this.io.to(`user:${userId}`).emit('portfolio:update', {
        totalValue: round2(totalValue),
        totalPortfolioValue: round2(totalValue),
        cash: round2(cash),
        cashBalance: round2(cash),
        holdingsValue: round2(holdingsValue),
        totalHoldingsValue: round2(holdingsValue),
        dayPnL: round2(dayPnL),
        totalUnrealizedPnl: round2(totalUnrealizedPnl),
        totalUnrealizedPnlPercent: round2(totalUnrealizedPnlPercent),
        holdings
      });
    }
  }

  _rankedIds() {
    return [...this.states.values()]
      .sort((a, b) => (b.price * b.totalShares) - (a.price * a.totalShares))
      .map((s) => s.stockId);
  }

  _emitCompanies() {
    if (!this.io) return;
    const ranks = this._rankedIds();
    for (const [userId, stockId] of this.connectedCompanies.entries()) {
      const state = this.states.get(stockId);
      if (!state) continue;
      const dayChange = state.price - state.previousClose;
      const changePct = state.previousClose > 0 ? (dayChange / state.previousClose) * 100 : 0;
      this.io.to(`user:${userId}`).emit('company:update', {
        price: round2(state.price),
        dayChange: round2(dayChange),
        changePct: round2(changePct),
        holderCount: this.holderCounts.get(stockId) || 0,
        rank: ranks.indexOf(stockId) + 1
      });
    }
  }

  async _flushTicks() {
    if (this.persisting || this.pendingTicks.length === 0) return;
    this.persisting = true;
    const batch = this.pendingTicks;
    this.pendingTicks = [];
    try {
      await PriceTick.bulkWrite(
        batch.map((doc) => ({ insertOne: { document: doc } })),
        { ordered: false }
      );
      const byId = new Map();
      for (const doc of batch) {
        byId.set(String(doc.stockId), doc);
      }
      await Stock.bulkWrite(
        [...byId.values()].map((doc) => {
          const st = this.states.get(String(doc.stockId));
          return {
            updateOne: {
              filter: { _id: doc.stockId },
              update: {
                $set: {
                  currentPrice: st ? st.price : doc.price,
                  previousClose: st ? st.previousClose : doc.price,
                  tickCount: doc.tickIndex
                }
              }
            }
          };
        }),
        { ordered: false }
      );
    } finally {
      this.persisting = false;
    }
  }

  async _closeSimulatedDay(simDay) {
    if (this.closingDay) return;
    this.closingDay = true;
    try {
      const candleOps = [];
      const stockOps = [];
      for (const state of this.states.values()) {
        const volume = lognormalVolume(this.rng);
        const logReturn = state.dayOpen > 0 ? Math.log(state.price / state.dayOpen) : 0;
        candleOps.push({
          updateOne: {
            filter: { stockId: state.oid, simDay },
            update: {
              $set: {
                stockId: state.oid,
                simDay,
                open: round2(state.dayOpen),
                high: round2(state.dayHigh),
                low: round2(state.dayLow),
                close: round2(state.price),
                volume,
                logReturn
              }
            },
            upsert: true
          }
        });
        state.previousClose = state.price;
        state.dayOpen = state.price;
        state.dayHigh = state.price;
        state.dayLow = state.price;
        state.dayVolume = 0;
        stockOps.push({
          updateOne: {
            filter: { _id: state.oid },
            update: {
              $set: {
                currentPrice: state.price,
                previousClose: state.previousClose,
                tickCount: state.tickIndex
              }
            }
          }
        });
      }
      if (candleOps.length) await DailyCandle.bulkWrite(candleOps, { ordered: false });
      if (stockOps.length) await Stock.bulkWrite(stockOps, { ordered: false });

      const customers = await User.find({ role: 'CUSTOMER' }).select('virtualBalance').lean();
      const allHoldings = await Holding.find({ quantity: { $gt: 0 } }).lean();
      const byUser = new Map();
      for (const h of allHoldings) {
        const uid = String(h.userId);
        if (!byUser.has(uid)) byUser.set(uid, []);
        byUser.get(uid).push({
          stockId: String(h.stockId),
          quantity: h.quantity,
          avgBuyPrice: h.avgBuyPrice || 0
        });
      }

      const snapOps = [];
      for (const user of customers) {
        const uid = String(user._id);
        const holdings = byUser.get(uid) || [];
        const holdingsValue = holdings.reduce((sum, h) => {
          const st = this.states.get(h.stockId);
          return sum + h.quantity * (st ? st.price : h.avgBuyPrice);
        }, 0);
        const cash = user.virtualBalance;
        const totalValue = cash + holdingsValue;
        snapOps.push({
          updateOne: {
            filter: { userId: user._id, simDay },
            update: {
              $set: {
                userId: user._id,
                simDay,
                totalValue: round2(totalValue),
                cash: round2(cash),
                holdingsValue: round2(holdingsValue)
              }
            },
            upsert: true
          }
        });
        const cache = this.connectedCustomers.get(uid);
        if (cache) cache.dayStartValue = totalValue;
      }
      if (snapOps.length) await PortfolioSnapshot.bulkWrite(snapOps, { ordered: false });
    } finally {
      this.closingDay = false;
    }
  }
}
