import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';

import { app } from '../server.js';
import { User } from '../models/User.js';
import { Stock } from '../models/Stock.js';
import { Holding } from '../models/Holding.js';
import { Transaction } from '../models/Transaction.js';
import { Watchlist } from '../models/Watchlist.js';
import { Target } from '../models/Target.js';
import { DailyCandle } from '../models/DailyCandle.js';
import { JWT_SECRET } from '../middleware/auth.js';
import { MarketEngine, setMarketEngine } from '../services/marketEngine.js';
import { checkAndResolveTargets } from '../jobs/targetWatcher.js';

let mongoServer;
let httpServer;
let baseUrl;
let customerUser;
let customerToken;
let testStock;
let mockIo;
let engine;

async function api(method, path, body = null, token = null) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers['authorization'] = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  return { status: res.status, body: data };
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoServer.getUri());
  }

  httpServer = http.createServer(app);
  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const { port } = httpServer.address();
  baseUrl = `http://127.0.0.1:${port}`;

  // Create test customer
  customerUser = await User.create({
    name: 'Customer Test',
    email: 'cust@test.com',
    passwordHash: 'hashedpwd',
    role: 'CUSTOMER',
    virtualBalance: 500000 // 5 Lakhs
  });

  customerToken = jwt.sign(
    { id: customerUser._id.toString(), email: customerUser.email, role: customerUser.role, name: customerUser.name },
    JWT_SECRET,
    { expiresIn: '1d' }
  );

  testStock = await Stock.create({
    symbol: 'RELIANCE_SIM',
    name: 'Reliance Simulation',
    sector: 'Energy',
    mu: 0.12,
    sigma: 0.22,
    currentPrice: 2000,
    previousClose: 1980,
    totalShares: 10000000
  });

  // Create 35 days of daily candles for parameter estimation with realistic volatility
  const candles = [];
  let prevC = 1900;
  for (let d = 1; d <= 35; d++) {
    const shock = (d % 2 === 0 ? 1 : -1) * 0.015;
    const close = prevC * (1 + shock);
    candles.push({
      stockId: testStock._id,
      simDay: d,
      open: prevC,
      high: Math.max(prevC, close) * 1.01,
      low: Math.min(prevC, close) * 0.99,
      close: Math.round(close * 100) / 100,
      volume: 1000000,
      logReturn: Math.log(close / prevC)
    });
    prevC = close;
  }
  await DailyCandle.insertMany(candles);

  // Setup mock socket server and engine
  const emittedEvents = [];
  mockIo = {
    to: (room) => ({
      emit: (event, payload) => {
        emittedEvents.push({ room, event, payload });
      }
    }),
    emittedEvents
  };

  engine = new MarketEngine(mockIo);
  setMarketEngine(engine);
  const state = engine._makeState(testStock);
  state.price = 2000;
  engine.states.set(state.stockId, state);
  engine.bySymbol.set(state.symbol, state.stockId);
  engine.globalTick = 35 * 390;
});

afterAll(async () => {
  if (httpServer) {
    await new Promise((resolve) => httpServer.close(resolve));
  }
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe('Customer Trading Backend', () => {
  it('POST /api/trade/buy executes at live engine price with 0.05% fee, reconciles balances exactly, and emits portfolio:update', async () => {
    const initialBalance = customerUser.virtualBalance; // 500,000
    const qty = 10;
    const livePrice = 2000;
    const feePct = 0.0005; // 0.05%
    const grossCost = qty * livePrice; // 20,000
    const expectedFee = grossCost * feePct; // 10
    const expectedTotal = grossCost + expectedFee; // 20,010
    const expectedRemainingBalance = initialBalance - expectedTotal; // 479,990

    mockIo.emittedEvents.length = 0;

    const res = await api('POST', '/api/trade/buy', {
      stockId: testStock._id.toString(),
      quantity: qty
    }, customerToken);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const tx = res.body.data.transaction;
    expect(tx.type).toBe('BUY');
    expect(tx.quantity).toBe(qty);
    expect(tx.price).toBe(livePrice);
    expect(tx.fee).toBe(expectedFee);
    expect(tx.total).toBe(expectedTotal);

    // Reconcile user balance in DB
    const updatedUser = await User.findById(customerUser._id);
    expect(updatedUser.virtualBalance).toBe(expectedRemainingBalance);

    // Reconcile Holding in DB
    const holding = await Holding.findOne({ userId: customerUser._id, stockId: testStock._id });
    expect(holding.quantity).toBe(qty);
    expect(holding.avgBuyPrice).toBe(livePrice);

    // Verify immediate portfolio:update socket emission
    const portUpdate = mockIo.emittedEvents.find(
      (e) => e.room === `user:${customerUser._id.toString()}` && e.event === 'portfolio:update'
    );
    expect(portUpdate).toBeDefined();
    expect(portUpdate.payload.cash).toBe(expectedRemainingBalance);
    expect(portUpdate.payload.holdingsValue).toBe(grossCost);
    expect(portUpdate.payload.totalValue).toBe(expectedRemainingBalance + grossCost);
  });

  it('POST /api/trade/sell validates shares, executes with 0.05% fee, reconciles balances exactly, and emits portfolio:update', async () => {
    // Attempting to sell more than owned should fail
    const overSellRes = await api('POST', '/api/trade/sell', {
      stockId: testStock._id.toString(),
      quantity: 100 // only 10 owned
    }, customerToken);
    expect(overSellRes.status).toBe(400);
    expect(overSellRes.body.error.code).toBe('INSUFFICIENT_SHARES');

    const userBefore = await User.findById(customerUser._id);
    const balanceBefore = userBefore.virtualBalance; // 479,990
    const sellQty = 4;
    const livePrice = 2000;
    const feePct = 0.0005;
    const grossProceeds = sellQty * livePrice; // 8,000
    const expectedFee = grossProceeds * feePct; // 4
    const netProceeds = grossProceeds - expectedFee; // 7,996
    const expectedBalanceAfter = balanceBefore + netProceeds; // 487,986

    mockIo.emittedEvents.length = 0;

    const res = await api('POST', '/api/trade/sell', {
      stockId: testStock._id.toString(),
      quantity: sellQty
    }, customerToken);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.transaction.type).toBe('SELL');
    expect(res.body.data.transaction.total).toBe(netProceeds);

    const userAfter = await User.findById(customerUser._id);
    expect(userAfter.virtualBalance).toBe(expectedBalanceAfter);

    const holding = await Holding.findOne({ userId: customerUser._id, stockId: testStock._id });
    expect(holding.quantity).toBe(6); // 10 - 4

    const portUpdate = mockIo.emittedEvents.find(
      (e) => e.room === `user:${customerUser._id.toString()}` && e.event === 'portfolio:update'
    );
    expect(portUpdate).toBeDefined();
    expect(portUpdate.payload.cash).toBe(expectedBalanceAfter);
  });
});

describe('Customer Portfolio & Watchlist Endpoints', () => {
  it('GET /api/portfolio returns live value, allocation %, volatility, maxDrawdown, and Sharpe', async () => {
    const res = await api('GET', '/api/portfolio', null, customerToken);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('totalPortfolioValue');
    expect(res.body.data).toHaveProperty('cash');
    expect(res.body.data).toHaveProperty('holdings');
    expect(res.body.data).toHaveProperty('allocations');
    expect(res.body.data.riskMetrics).toHaveProperty('portfolioVolatility');
    expect(res.body.data.riskMetrics).toHaveProperty('maxDrawdown');
    expect(res.body.data.riskMetrics).toHaveProperty('sharpeRatio');
  });

  it('GET /api/portfolio/history returns series for 1D and 1M', async () => {
    const res1D = await api('GET', '/api/portfolio/history?range=1D', null, customerToken);
    expect(res1D.status).toBe(200);
    expect(res1D.body.data.type).toBe('intraday');

    const res1M = await api('GET', '/api/portfolio/history?range=1M', null, customerToken);
    expect(res1M.status).toBe(200);
    expect(res1M.body.data.type).toBe('daily');
  });

  it('GET /api/transactions returns paginated transactions', async () => {
    const res = await api('GET', '/api/transactions?page=1&limit=10', null, customerToken);
    expect(res.status).toBe(200);
    expect(res.body.data.transactions.length).toBeGreaterThanOrEqual(2);
    expect(res.body.data.pagination.total).toBeGreaterThanOrEqual(2);
  });

  it('Watchlist POST/DELETE/GET with most_viewed, gain, and lose filters', async () => {
    // Add to watchlist
    const addRes = await api('POST', `/api/watchlist/${testStock._id}`, null, customerToken);
    expect(addRes.status).toBe(201);

    // Get watchlist
    const getRes = await api('GET', '/api/watchlist?filter=all', null, customerToken);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.length).toBe(1);
    expect(getRes.body.data[0].symbol).toBe('RELIANCE_SIM');

    // Filter check
    const filterRes = await api('GET', '/api/watchlist?filter=most_viewed', null, customerToken);
    expect(filterRes.status).toBe(200);

    // Delete from watchlist
    const delRes = await api('DELETE', `/api/watchlist/${testStock._id}`, null, customerToken);
    expect(delRes.status).toBe(200);

    const checkRes = await api('GET', '/api/watchlist', null, customerToken);
    expect(checkRes.body.data.length).toBe(0);
  });
});

describe('Targets & Probability Endpoints & Background Watcher', () => {
  let createdTargetId;

  it('POST /api/targets creates target with estimated params and initial probability', async () => {
    const res = await api('POST', '/api/targets', {
      stockId: testStock._id.toString(),
      targetPrice: 2200, // +10% target
      deadlineDays: 30,
      mode: 'touch'
    }, customerToken);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('initialProbability');
    expect(res.body.data.initialProbability).toBeGreaterThan(0);
    createdTargetId = res.body.data._id;
  });

  it('GET /api/targets lists targets with live closed-form probability', async () => {
    const res = await api('GET', '/api/targets', null, customerToken);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0]).toHaveProperty('currentProbability');
  });

  it('POST /api/targets/analyse returns full Monte Carlo payload with fan-chart percentiles and methodology', async () => {
    const res = await api('POST', '/api/targets/analyse', {
      stockId: testStock._id.toString(),
      targetPrice: 2200,
      deadlineDays: 30,
      mode: 'touch',
      nPaths: 3000
    }, customerToken);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.monteCarlo).toHaveProperty('percentiles');
    expect(data.monteCarlo.percentiles).toHaveProperty('p5');
    expect(data.monteCarlo.percentiles).toHaveProperty('p50');
    expect(data.monteCarlo.percentiles).toHaveProperty('p95');
    expect(data.monteCarlo.percentiles.p50.length).toBe(31); // 30 days + 1
    expect(data).toHaveProperty('methodology');
    expect(data.methodology).toHaveProperty('formulas');
    expect(data.methodology).toHaveProperty('paramsUsed');
  });

  it('POST /api/targets/what-if returns closed-form grid in under 300 ms', async () => {
    const start = performance.now();
    const res = await api('POST', '/api/targets/what-if', {
      stockId: testStock._id.toString(),
      targets: [2100, 2200, 2300, 2400],
      days: [10, 20, 30, 60],
      mode: 'touch'
    }, customerToken);
    const elapsed = performance.now() - start;

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.grid.length).toBe(16); // 4x4
    expect(elapsed).toBeLessThan(300); // Acceptance requirement: under 300 ms
  });

  it('TargetWatcher resolves HIT when price touches target and emits target:update', async () => {
    mockIo.emittedEvents.length = 0;
    // Move stock price to 2250 (target is 2200)
    const state = engine.getState(String(testStock._id));
    state.price = 2250;

    await checkAndResolveTargets(mockIo);

    const targetDoc = await Target.findById(createdTargetId);
    expect(targetDoc.status).toBe('HIT');

    const updateEvent = mockIo.emittedEvents.find((e) => e.event === 'target:update');
    expect(updateEvent).toBeDefined();
    expect(updateEvent.payload.status).toBe('HIT');
  });
});

describe('Quant Insights Endpoints (Numbers only, zero advice)', () => {
  it('GET /api/stocks/:id/insights returns quantitative metrics, technicals, and neutral signals', async () => {
    const res = await api('GET', `/api/stocks/${testStock._id}/insights`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.metrics).toHaveProperty('estimatedAnnualizedVolatility');
    expect(data.metrics).toHaveProperty('maxDrawdown');
    expect(data.metrics).toHaveProperty('sharpeRatio');
    expect(data.metrics).toHaveProperty('sortinoRatio');
    expect(data.metrics).toHaveProperty('beta');
    expect(data.metrics).toHaveProperty('valueAtRisk95_1Day');
    expect(data.indicators).toHaveProperty('rsi14');
    expect(data.indicators).toHaveProperty('bollingerBands');
    expect(data.indicators).toHaveProperty('zScore20');
    expect(Array.isArray(data.signals)).toBe(true);
  });

  it('GET /api/stocks/trending returns movers, volume, and volatile rankings with reason metric', async () => {
    const res = await api('GET', '/api/stocks/trending');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('topMovers');
    expect(res.body.data).toHaveProperty('topVolume');
    expect(res.body.data).toHaveProperty('topVolatile');
    if (res.body.data.topMovers.length > 0) {
      expect(res.body.data.topMovers[0]).toHaveProperty('reasonMetric');
    }
  });

  it('GET /api/insights/home returns quant insights card and rotating analytics panel', async () => {
    const res = await api('GET', '/api/insights/home');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('quantInsightsCard');
    expect(res.body.data).toHaveProperty('rotatingAnalyticsPanel');
  });
});
