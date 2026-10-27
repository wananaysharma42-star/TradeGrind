import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import http from 'http';
import { app, io as serverIO } from '../server.js';
import { User } from '../models/User.js';
import { Stock } from '../models/Stock.js';
import { Target } from '../models/Target.js';
import { AlertRule } from '../models/AlertRule.js';
import { Notification } from '../models/Notification.js';
import { DailyCandle } from '../models/DailyCandle.js';
import { AlertEngine, setAlertEngine } from '../services/alertEngine.js';
import { MarketEngine, setMarketEngine } from '../services/marketEngine.js';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../middleware/auth.js';

let mongod;
let testServer;
let baseUrl;
let testUser;
let authToken;
let testStock;

function makeToken(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

describe('AlertEngine & Real-time Notifications', () => {
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
    await Target.deleteMany({});
    await AlertRule.deleteMany({});
    await Notification.deleteMany({});
    await DailyCandle.deleteMany({});

    testUser = await User.create({
      name: 'Trader Joe',
      email: 'joe@tradesim.com',
      passwordHash: 'hashed_pw',
      role: 'CUSTOMER',
      balance: 100000
    });
    authToken = makeToken(testUser);

    testStock = await Stock.create({
      symbol: 'ALERT',
      name: 'Alert Corp',
      sector: 'Technology',
      currentPrice: 100.0,
      previousClose: 100.0,
      mu: 0.12,
      sigma: 0.25,
      tickCount: 100,
      totalShares: 10_000_000
    });

    // Populate 30 daily candles for parameter estimation and preview
    const candles = [];
    let p = 100;
    for (let day = 1; day <= 30; day++) {
      const wiggle = (day % 2 === 0 ? 0.015 : -0.012);
      const close = Math.round(p * (1 + wiggle) * 100) / 100;
      candles.push({
        stockId: testStock._id,
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
  });

  it('edge-trigger: PRICE_ABOVE fires ONLY when crossing threshold', async () => {
    const mockMarket = new MarketEngine(null);
    mockMarket.globalTick = 100;
    const alertEng = new AlertEngine(mockMarket, null);

    // Rule: Alert when price crosses above $105
    const rule = await AlertRule.create({
      ownerId: testUser._id,
      ownerRole: 'CUSTOMER',
      stockId: testStock._id,
      type: 'PRICE_ABOVE',
      threshold: 105.0,
      cooldownTicks: 390,
      active: true
    });

    await alertEng.reloadRules();

    // Tick 1: price starts at $102 (below $105) -> No trigger
    const stateTick1 = new Map([
      [String(testStock._id), { id: String(testStock._id), symbol: 'ALERT', price: 102.0, dayOpen: 100.0 }]
    ]);
    mockMarket.globalTick = 101;
    await alertEng.onTick(stateTick1);

    let notifs = await Notification.find({ userId: testUser._id });
    expect(notifs.length).toBe(0);

    // Tick 2: price rises to $106 (> 105, crossed from 102) -> Should FIRE
    const stateTick2 = new Map([
      [String(testStock._id), { id: String(testStock._id), symbol: 'ALERT', price: 106.0, dayOpen: 100.0 }]
    ]);
    mockMarket.globalTick = 102;
    await alertEng.onTick(stateTick2);

    notifs = await Notification.find({ userId: testUser._id });
    expect(notifs.length).toBe(1);
    expect(notifs[0].title).toContain('Crossed Above $105.00');

    // Tick 3: price moves from 106 to 108 (still > 105, but no crossing) -> Should NOT fire again
    const stateTick3 = new Map([
      [String(testStock._id), { id: String(testStock._id), symbol: 'ALERT', price: 108.0, dayOpen: 100.0 }]
    ]);
    mockMarket.globalTick = 103;
    await alertEng.onTick(stateTick3);

    notifs = await Notification.find({ userId: testUser._id });
    expect(notifs.length).toBe(1);
  });

  it('edge-trigger: PRICE_BELOW fires ONLY when crossing below threshold', async () => {
    const mockMarket = new MarketEngine(null);
    mockMarket.globalTick = 200;
    const alertEng = new AlertEngine(mockMarket, null);

    const rule = await AlertRule.create({
      ownerId: testUser._id,
      ownerRole: 'CUSTOMER',
      stockId: testStock._id,
      type: 'PRICE_BELOW',
      threshold: 95.0,
      cooldownTicks: 390,
      active: true
    });
    await alertEng.reloadRules();

    // Initial tick at 98 (above 95)
    mockMarket.globalTick = 201;
    await alertEng.onTick(new Map([
      [String(testStock._id), { id: String(testStock._id), symbol: 'ALERT', price: 98.0, dayOpen: 100.0 }]
    ]));
    expect(await Notification.countDocuments()).toBe(0);

    // Crosses down to 94 (< 95)
    mockMarket.globalTick = 202;
    await alertEng.onTick(new Map([
      [String(testStock._id), { id: String(testStock._id), symbol: 'ALERT', price: 94.0, dayOpen: 100.0 }]
    ]));
    expect(await Notification.countDocuments()).toBe(1);

    // Next tick at 92 (no new crossing)
    mockMarket.globalTick = 203;
    await alertEng.onTick(new Map([
      [String(testStock._id), { id: String(testStock._id), symbol: 'ALERT', price: 92.0, dayOpen: 100.0 }]
    ]));
    expect(await Notification.countDocuments()).toBe(1);
  });

  it('cooldownTicks: blocks triggers until cooldown period elapses', async () => {
    const mockMarket = new MarketEngine(null);
    mockMarket.globalTick = 300;
    const alertEng = new AlertEngine(mockMarket, null);

    // Rule: Cooldown of 50 ticks
    const rule = await AlertRule.create({
      ownerId: testUser._id,
      ownerRole: 'CUSTOMER',
      stockId: testStock._id,
      type: 'PRICE_ABOVE',
      threshold: 100.0,
      cooldownTicks: 50,
      active: true
    });
    await alertEng.reloadRules();

    // Tick 301: at 99
    mockMarket.globalTick = 301;
    await alertEng.onTick(new Map([
      [String(testStock._id), { id: String(testStock._id), symbol: 'ALERT', price: 99.0, dayOpen: 100.0 }]
    ]));

    // Tick 302: crosses to 101 -> FIRES (lastTriggeredTick = 302)
    mockMarket.globalTick = 302;
    await alertEng.onTick(new Map([
      [String(testStock._id), { id: String(testStock._id), symbol: 'ALERT', price: 101.0, dayOpen: 100.0 }]
    ]));
    expect(await Notification.countDocuments()).toBe(1);

    // Tick 310: drops back to 99
    mockMarket.globalTick = 310;
    await alertEng.onTick(new Map([
      [String(testStock._id), { id: String(testStock._id), symbol: 'ALERT', price: 99.0, dayOpen: 100.0 }]
    ]));

    // Tick 320: crosses to 102 (only 18 ticks since last trigger, cooldown is 50) -> BLOCKED
    mockMarket.globalTick = 320;
    await alertEng.onTick(new Map([
      [String(testStock._id), { id: String(testStock._id), symbol: 'ALERT', price: 102.0, dayOpen: 100.0 }]
    ]));
    expect(await Notification.countDocuments()).toBe(1);

    // Drops again
    mockMarket.globalTick = 340;
    await alertEng.onTick(new Map([
      [String(testStock._id), { id: String(testStock._id), symbol: 'ALERT', price: 98.0, dayOpen: 100.0 }]
    ]));

    // Tick 360: crosses to 103 (360 - 302 = 58 >= 50 ticks) -> FIRES AGAIN
    mockMarket.globalTick = 360;
    await alertEng.onTick(new Map([
      [String(testStock._id), { id: String(testStock._id), symbol: 'ALERT', price: 103.0, dayOpen: 100.0 }]
    ]));
    expect(await Notification.countDocuments()).toBe(2);
  });

  it('probability crossing: PROB_BELOW triggers when Target probability drops below threshold', async () => {
    const mockMarket = new MarketEngine(null);
    mockMarket.globalTick = 30; // multiple of 30
    const alertEng = new AlertEngine(mockMarket, null);

    // Target with target price $150 in 10 days
    const target = await Target.create({
      userId: testUser._id,
      stockId: testStock._id,
      targetPrice: 150.0,
      deadlineDays: 10,
      startTick: 0,
      startPrice: 100.0,
      mode: 'touch',
      status: 'ACTIVE',
      lastProbability: 0.65
    });

    const rule = await AlertRule.create({
      ownerId: testUser._id,
      ownerRole: 'CUSTOMER',
      stockId: testStock._id,
      targetId: target._id,
      type: 'PROB_BELOW',
      threshold: 0.40, // 40%
      cooldownTicks: 100,
      active: true
    });
    await alertEng.reloadRules();

    // Price drops drastically to $60, driving touch probability from 0.65 down below 0.40
    mockMarket.globalTick = 60; // multiple of 30
    await alertEng.onTick(new Map([
      [String(testStock._id), { id: String(testStock._id), symbol: 'ALERT', price: 60.0, dayOpen: 100.0, mu: 0.12, sigma: 0.25 }]
    ]));

    const notifs = await Notification.find({ userId: testUser._id });
    expect(notifs.length).toBe(1);
    expect(notifs[0].title).toContain('Target Probability Dropped Below');
  });

  it('backtest preview: POST /api/alerts/preview evaluates historical simulated days', async () => {
    const res = await fetch(`${baseUrl}/api/alerts/preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        stockId: testStock._id,
        type: 'PRICE_ABOVE',
        threshold: 101.0,
        cooldownTicks: 390
      })
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.totalSimulatedDays).toBe(30);
    expect(typeof json.data.triggerCount).toBe('number');
    expect(Array.isArray(json.data.triggers)).toBe(true);
  });

  it('CRUD /api/alerts & notifications unread management', async () => {
    // 1. Create alert rule
    const createRes = await fetch(`${baseUrl}/api/alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        stockId: testStock._id,
        type: 'PCT_CHANGE',
        threshold: 5,
        cooldownTicks: 390
      })
    });
    expect(createRes.status).toBe(201);
    const createJson = await createRes.json();
    const ruleId = createJson.data._id;

    // 2. GET /api/alerts
    const getRes = await fetch(`${baseUrl}/api/alerts`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const getJson = await getRes.json();
    expect(getJson.data.length).toBe(1);
    expect(getJson.data[0]._id).toBe(ruleId);

    // 3. PUT /api/alerts/:id
    const putRes = await fetch(`${baseUrl}/api/alerts/${ruleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ threshold: 8 })
    });
    const putJson = await putRes.json();
    expect(putJson.data.threshold).toBe(8);

    // 4. Create Notification & test read / read-all
    const notif = await Notification.create({
      userId: testUser._id,
      alertRuleId: ruleId,
      title: 'Test Notification',
      message: 'Testing notifications endpoint',
      read: false
    });

    const notifRes = await fetch(`${baseUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const notifJson = await notifRes.json();
    expect(notifJson.data.unreadCount).toBe(1);
    expect(notifJson.data.notifications.length).toBe(1);

    // Mark single as read
    const patchRes = await fetch(`${baseUrl}/api/notifications/${notif._id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${authToken}` }
    });
    expect(patchRes.status).toBe(200);

    // Read all
    const readAllRes = await fetch(`${baseUrl}/api/notifications/read-all`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${authToken}` }
    });
    expect(readAllRes.status).toBe(200);

    // 5. DELETE /api/alerts/:id
    const delRes = await fetch(`${baseUrl}/api/alerts/${ruleId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` }
    });
    expect(delRes.status).toBe(200);
  });

  it('dev endpoints: POST /api/dev/shock and POST /api/dev/speed', async () => {
    const mockEngine = new MarketEngine(null);
    await mockEngine.initialize();
    setMarketEngine(mockEngine);

    // Shock
    const shockRes = await fetch(`${baseUrl}/api/dev/shock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stockId: testStock._id, pct: 0.15 })
    });
    expect(shockRes.status).toBe(200);
    const shockJson = await shockRes.json();
    expect(shockJson.success).toBe(true);
    expect(shockJson.data.pct).toBe(0.15);

    // Speed
    const speedRes = await fetch(`${baseUrl}/api/dev/speed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ multiplier: 5 })
    });
    expect(speedRes.status).toBe(200);
    const speedJson = await speedRes.json();
    expect(speedJson.success).toBe(true);
    expect(speedJson.data.multiplier).toBe(5);
  });

  it('acceptance: alert fires in real time after dev shock, emits socket event, and persists', async () => {
    // 1. Set up engine with mocked io to capture socket emissions
    const emittedEvents = [];
    const mockIo = {
      to: (room) => ({
        emit: (event, payload) => {
          emittedEvents.push({ room, event, payload });
        }
      })
    };

    const engine = new MarketEngine(mockIo);
    await engine.initialize();
    setMarketEngine(engine);

    const alertEng = new AlertEngine(engine, mockIo);
    setAlertEngine(alertEng);

    // Initial stock price is ~100. Set rule for PRICE_ABOVE 115
    const rule = await AlertRule.create({
      ownerId: testUser._id,
      ownerRole: 'CUSTOMER',
      stockId: testStock._id,
      type: 'PRICE_ABOVE',
      threshold: 115.0,
      cooldownTicks: 100,
      active: true
    });
    await alertEng.reloadRules();
    // Prime initial price so the baseline is 100 before the jump
    const stockIdStr = String(testStock._id);
    const initialPrice = engine.getState(stockIdStr)?.price || 100;
    alertEng.prevPriceByStock.set(stockIdStr, initialPrice);

    // 2. Trigger dev shock of +25%
    const shockRes = await fetch(`${baseUrl}/api/dev/shock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stockId: testStock._id, pct: 0.25 })
    });
    expect(shockRes.status).toBe(200);

    // 3. Engine advances tick -> processes shock -> price jumps to ~125
    engine.tick();
    // Wait small tick for async _evaluateRule / DB persistence
    await new Promise((r) => setTimeout(r, 100));

    // 4. Verify socket event 'notification:new' was emitted to user room
    const notifEvent = emittedEvents.find(
      (e) => e.event === 'notification:new' && e.room === `user:${testUser._id}`
    );
    expect(notifEvent).toBeDefined();
    expect(notifEvent.payload.title).toContain('Crossed Above $115.00');

    // 5. Verify notification persisted in database
    const dbNotif = await Notification.findOne({ userId: testUser._id, alertRuleId: rule._id });
    expect(dbNotif).not.toBeNull();
    expect(dbNotif.title).toContain('Crossed Above $115.00');
    expect(dbNotif.payload.price).toBeGreaterThan(115.0);
  });
});
