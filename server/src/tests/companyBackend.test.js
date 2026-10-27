import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import http from 'http';
import { app } from '../server.js';
import { User } from '../models/User.js';
import { Stock } from '../models/Stock.js';
import { DailyCandle } from '../models/DailyCandle.js';
import { Holding } from '../models/Holding.js';
import { Transaction } from '../models/Transaction.js';
import { AlertRule } from '../models/AlertRule.js';
import { Notification } from '../models/Notification.js';
import { AlertEngine } from '../services/alertEngine.js';
import { MarketEngine, setMarketEngine } from '../services/marketEngine.js';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../middleware/auth.js';

let mongod;
let testServer;
let baseUrl;
let companyUser;
let companyToken;
let customerUser;
let customerToken;
let companyStock;

function makeToken(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

describe('Company Backend Integration & Simulation', () => {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());

    testServer = http.createServer(app);
    await new Promise((resolve) => testServer.listen(0, resolve));
    const port = testServer.address().port;
    baseUrl = `http://localhost:${port}`;
  });

  afterAll(async () => {
    await testServer.close();
    await mongoose.disconnect();
    await mongod.stop();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Stock.deleteMany({});
    await DailyCandle.deleteMany({});
    await Holding.deleteMany({});
    await Transaction.deleteMany({});
    await AlertRule.deleteMany({});
    await Notification.deleteMany({});

    // Create Company User & Customer User
    companyUser = await User.create({
      name: 'Acme Corp Exec',
      email: 'exec@acme.com',
      passwordHash: 'hashed_pw',
      role: 'COMPANY',
      balance: 5000000
    });
    companyToken = makeToken(companyUser);

    customerUser = await User.create({
      name: 'Retail Trader',
      email: 'trader@retail.com',
      passwordHash: 'hashed_pw',
      role: 'CUSTOMER',
      balance: 100000
    });
    customerToken = makeToken(customerUser);

    // Create Company's Stock
    companyStock = await Stock.create({
      symbol: 'ACME',
      name: 'Acme Corp',
      sector: 'Technology',
      currentPrice: 100.0,
      previousClose: 100.0,
      mu: 0.12,
      sigma: 0.22,
      ownerCompany: companyUser._id,
      tickCount: 200,
      totalShares: 10_000_000
    });

    // Link stockId to companyUser
    companyUser.stockId = companyStock._id;
    await companyUser.save();

    // Populate 30 days of candles
    const candles = [];
    let p = 100;
    for (let day = 1; day <= 30; day++) {
      const wiggle = (day % 2 === 0 ? 0.015 : -0.012);
      const close = Math.round(p * (1 + wiggle) * 100) / 100;
      candles.push({
        stockId: companyStock._id,
        simDay: day,
        open: p,
        high: Math.round(Math.max(p, close) * 1.01 * 100) / 100,
        low: Math.round(Math.min(p, close) * 0.99 * 100) / 100,
        close,
        volume: 500000,
        logReturn: Math.log(close / p)
      });
      p = close;
    }
    await DailyCandle.insertMany(candles);

    // Populate Holdings & Transactions for customer
    await Holding.create({
      userId: customerUser._id,
      stockId: companyStock._id,
      quantity: 500,
      avgBuyPrice: 95.0
    });

    await Transaction.create({
      userId: customerUser._id,
      stockId: companyStock._id,
      type: 'BUY',
      quantity: 500,
      price: 95.0,
      fee: 23.75,
      total: 47523.75,
      simDay: 5
    });
  });

  it('requireRole COMPANY blocks CUSTOMER access with 403', async () => {
    const res = await fetch(`${baseUrl}/api/company/home`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    expect(res.status).toBe(403);
  });

  it('GET /api/company/home returns live price, 10-day insights, sector/overall ranks, and risk metrics', async () => {
    const res = await fetch(`${baseUrl}/api/company/home`, {
      headers: { Authorization: `Bearer ${companyToken}` }
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    const data = json.data;
    expect(data.stock.symbol).toBe('ACME');
    expect(data.last10Days.length).toBe(10);
    expect(typeof data.ranks.overallRank).toBe('number');
    expect(typeof data.ranks.sectorRank).toBe('number');
    expect(typeof data.ranks.score).toBe('number');
    expect(data.riskMetrics.estimatedVolatility).toBeGreaterThan(0);
    expect(typeof data.riskMetrics.sharpeRatio).toBe('number');
    expect(typeof data.riskMetrics.valueAtRisk95_1Day).toBe('number');
  });

  it('GET /api/company/profit-analytics returns rebased series, 30-day fan chart, and life since listing', async () => {
    const res = await fetch(`${baseUrl}/api/company/profit-analytics`, {
      headers: { Authorization: `Bearer ${companyToken}` }
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    const data = json.data;
    expect(data.rebasedPriceSeries[0].symbol).toBe('ACME');
    expect(data.rebasedPriceSeries[0].series[0]).toBe(100); // Rebased to 100
    expect(data.fanChart30Days.percentiles.p50.length).toBe(31);
    expect(data.fanChart30Days.probabilityHigher).toBeGreaterThanOrEqual(0);
    expect(data.fanChart30Days.probabilityHigher).toBeLessThanOrEqual(1);
    expect(data.lifeSinceListing.totalDays).toBe(30);
    expect(data.lifeSinceListing.drawdownSeries.length).toBe(30);
  });

  it('GET /api/company/customers filters by category and returns documented category rules', async () => {
    const res = await fetch(`${baseUrl}/api/company/customers?category=profit`, {
      headers: { Authorization: `Bearer ${companyToken}` }
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.category).toBe('profit');
    expect(json.data.categoryRules).toBeDefined();
    expect(json.data.categoryRules.profit).toContain('positive unrealized P&L');
    expect(json.data.holders.length).toBe(1);
    expect(json.data.holders[0].avgBuyPrice).toBe(95.0);
    expect(json.data.holders[0].unrealizedPnL).toBeGreaterThan(0); // Current price ~100 > 95
  });

  it('GET /api/company/customers/trend returns daily buys/sells and profit histogram bins', async () => {
    const res = await fetch(`${baseUrl}/api/company/customers/trend`, {
      headers: { Authorization: `Bearer ${companyToken}` }
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data.dailyActivity)).toBe(true);
    expect(json.data.priceComparison.averageBuyPrice).toBe(95.0);
    expect(json.data.profitRateHistogram.length).toBe(5);
  });

  it('POST /api/company/simulate zero-override matches baseline, shocks visibly shift distribution', async () => {
    // 1. Zero-override simulation
    const resZero = await fetch(`${baseUrl}/api/company/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${companyToken}` },
      body: JSON.stringify({
        horizonDays: 30,
        targetPrice: 120.0,
        nPaths: 2000,
        thresholds: {
          minTargetProb: 0.05,
          maxLossProb: 0.90,
          maxDrawdown: 0.35
        }
      })
    });
    expect(resZero.status).toBe(200);
    const zeroJson = await resZero.json();
    expect(zeroJson.success).toBe(true);

    const sim = zeroJson.data.simulation;
    const base = zeroJson.data.baseline;

    // Zero-override simulation matches baseline within Monte Carlo random error (tolerance: < 8% difference in expected return)
    expect(Math.abs(sim.expectedReturn - base.expectedReturn)).toBeLessThan(0.08);
    expect(zeroJson.data.feasibilityCheck.conditions.length).toBe(3);

    // 2. Simulation with severe negative shock (-30% on Day 5)
    const resShock = await fetch(`${baseUrl}/api/company/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${companyToken}` },
      body: JSON.stringify({
        horizonDays: 30,
        targetPrice: 120.0,
        shocks: [{ day: 5, pct: -0.30 }],
        nPaths: 2000,
        thresholds: { maxLossProb: 0.50 }
      })
    });
    expect(resShock.status).toBe(200);
    const shockJson = await resShock.json();
    const shockSim = shockJson.data.simulation;

    // Shock visibly shifts distribution downward: higher loss probability and lower median terminal
    expect(shockSim.pLoss).toBeGreaterThan(sim.pLoss);
    expect(shockSim.percentiles.p50[30]).toBeLessThan(sim.percentiles.p50[30]);
  });

  it('CRUD /api/company/simulations saves and deletes scenario records', async () => {
    // 1. Save
    const saveRes = await fetch(`${baseUrl}/api/company/simulate/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${companyToken}` },
      body: JSON.stringify({
        name: 'Aggressive Growth Scenario',
        inputs: { horizonDays: 60, mu: 0.20 },
        results: { pTarget: 0.75, expectedReturn: 0.18 }
      })
    });
    expect(saveRes.status).toBe(201);
    const saveJson = await saveRes.json();
    const scenarioId = saveJson.data._id;

    // 2. List
    const listRes = await fetch(`${baseUrl}/api/company/simulations`, {
      headers: { Authorization: `Bearer ${companyToken}` }
    });
    const listJson = await listRes.json();
    expect(listJson.data.length).toBe(1);
    expect(listJson.data[0].name).toBe('Aggressive Growth Scenario');

    // 3. Delete
    const delRes = await fetch(`${baseUrl}/api/company/simulations/${scenarioId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${companyToken}` }
    });
    expect(delRes.status).toBe(200);
  });

  it('alertEngine: triggers VOLATILITY_ABOVE, RANK_BELOW, and HOLDER_COUNT_BELOW', async () => {
    const mockMarket = new MarketEngine(null);
    mockMarket.globalTick = 500;
    const alertEng = new AlertEngine(mockMarket, null);

    // Rule 1: VOLATILITY_ABOVE 30%
    const volRule = await AlertRule.create({
      ownerId: companyUser._id,
      ownerRole: 'COMPANY',
      stockId: companyStock._id,
      type: 'VOLATILITY_ABOVE',
      threshold: 0.30,
      cooldownTicks: 100,
      active: true
    });

    // Rule 2: RANK_BELOW 10 (triggers when overall rank goes above 10, e.g. 15)
    const rankRule = await AlertRule.create({
      ownerId: companyUser._id,
      ownerRole: 'COMPANY',
      stockId: companyStock._id,
      type: 'RANK_BELOW',
      threshold: 10,
      cooldownTicks: 100,
      active: true
    });

    // Rule 3: HOLDER_COUNT_BELOW 5
    const holderRule = await AlertRule.create({
      ownerId: companyUser._id,
      ownerRole: 'COMPANY',
      stockId: companyStock._id,
      type: 'HOLDER_COUNT_BELOW',
      threshold: 5,
      cooldownTicks: 100,
      active: true
    });

    await alertEng.reloadRules();

    // Setup initial state: vol = 0.20, rank = 3, holders = 10
    const sId = String(companyStock._id);
    mockMarket.holderCounts.set(sId, 10);
    const loadedRules = alertEng.rulesByStock.get(sId) || [];
    for (const r of loadedRules) {
      if (r.type === 'VOLATILITY_ABOVE') r.lastValue = 0.20;
      if (r.type === 'RANK_BELOW') r.lastValue = 3;
      if (r.type === 'HOLDER_COUNT_BELOW') r.lastValue = 10;
    }

    // Simulate tick where vol surges to 0.40, rank drops to 15, and holders fall to 2
    mockMarket.holderCounts.set(sId, 2);
    mockMarket.globalTick = 501;

    await alertEng.onTick(new Map([
      [sId, {
        id: sId,
        stockId: sId,
        symbol: 'ACME',
        price: 100.0,
        dayOpen: 100.0,
        sigma: 0.40,
        rollingVol: 0.40,
        overallRank: 15
      }]
    ]));

    const notifs = await Notification.find({ userId: companyUser._id });
    expect(notifs.length).toBe(3);

    const volNotif = notifs.find((n) => n.title.includes('Volatility Surpassed'));
    expect(volNotif).toBeDefined();

    const rankNotif = notifs.find((n) => n.title.includes('Dropped Below Rank #10'));
    expect(rankNotif).toBeDefined();

    const holderNotif = notifs.find((n) => n.title.includes('Holder Count Dropped Below 5'));
    expect(holderNotif).toBeDefined();
  });
});
