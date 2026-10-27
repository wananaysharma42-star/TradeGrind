import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Stock } from '../models/Stock.js';
import { PriceTick } from '../models/PriceTick.js';
import { DailyCandle } from '../models/DailyCandle.js';
import { User } from '../models/User.js';
import { Holding } from '../models/Holding.js';
import { PortfolioSnapshot } from '../models/PortfolioSnapshot.js';
import { MarketEngine } from '../services/marketEngine.js';

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe('MarketEngine Integration & Performance', () => {
  it('initializes, runs backfill under 90 candles, advances ticks, and tests shock', async () => {
    const stock = await Stock.create({
      symbol: 'TEST1',
      name: 'Test Stock 1',
      sector: 'Tech',
      mu: 0.1,
      sigma: 0.2,
      currentPrice: 100,
      previousClose: 100,
      totalShares: 1000000
    });

    const mockIo = {
      to: () => ({ emit: () => {} })
    };

    const engine = new MarketEngine(mockIo);
    await engine.initialize();

    // Check backfill populated candles and intraday ticks
    const candleCount = await DailyCandle.countDocuments({ stockId: stock._id });
    expect(candleCount).toBeGreaterThanOrEqual(90);

    const tickCount = await PriceTick.countDocuments({ stockId: stock._id });
    expect(tickCount).toBeGreaterThanOrEqual(5 * 390);

    // Initial state check
    const state = engine.getState(String(stock._id));
    expect(state).toBeDefined();
    expect(state.price).toBeGreaterThan(0);

    // Apply shock
    const prePrice = state.price;
    engine.applyShock(stock._id, 0.10); // +10% shock
    engine.tick();
    expect(state.price).toBeGreaterThan(prePrice);

    // Test EventEmitter 'tick'
    let eventFired = false;
    engine.once('tick', (states) => {
      eventFired = true;
      expect(states.has(String(stock._id))).toBe(true);
    });
    engine.tick();
    expect(eventFired).toBe(true);
  });

  it('tick processing stays well under 50 ms for 50 stocks', async () => {
    // Generate 50 stocks
    const stockDocs = [];
    for (let i = 1; i <= 50; i++) {
      stockDocs.push({
        symbol: `SYM${i}`,
        name: `Symbol ${i}`,
        sector: 'Finance',
        mu: 0.12,
        sigma: 0.25,
        currentPrice: 50 + i,
        previousClose: 50 + i,
        totalShares: 5000000
      });
    }
    const inserted = await Stock.insertMany(stockDocs);

    const mockIo = {
      to: () => ({ emit: () => {} })
    };

    const engine = new MarketEngine(mockIo);
    // Directly hydrate without heavy backfill for the speed benchmark
    for (const doc of inserted) {
      const state = engine._makeState(doc);
      engine.states.set(state.stockId, state);
      engine.bySymbol.set(state.symbol, state.stockId);
    }
    expect(engine.states.size).toBeGreaterThanOrEqual(50);

    // Run 10 ticks and measure execution time
    const durations = [];
    for (let t = 0; t < 10; t++) {
      const start = performance.now();
      engine.tick();
      const elapsed = performance.now() - start;
      durations.push(elapsed);
    }

    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    // Requirement: stays under 50 ms for 50 stocks
    expect(avgDuration).toBeLessThan(50);
  });

  it('resumes from last persisted price on restart without discontinuity', async () => {
    // Clean up temporary benchmark stocks
    await Stock.deleteMany({ symbol: { $regex: '^SYM' } });

    const stock = await Stock.create({
      symbol: 'RESUME1',
      name: 'Resume Stock',
      sector: 'Energy',
      mu: 0.15,
      sigma: 0.3,
      currentPrice: 200,
      previousClose: 200,
      totalShares: 1000000
    });

    const mockIo = {
      to: () => ({ emit: () => {} })
    };

    const engine1 = new MarketEngine(mockIo);
    await engine1.initialize();

    // Run some ticks and flush
    for (let i = 0; i < 15; i++) {
      engine1.tick();
    }
    while (engine1.persisting) {
      await new Promise((r) => setTimeout(r, 10));
    }
    await engine1._flushTicks();

    const lastPriceEngine1 = engine1.getState(String(stock._id)).price;

    // Simulate restart with a new engine instance
    const engine2 = new MarketEngine(mockIo);
    await engine2.initialize();

    const resumedPrice = engine2.getState(String(stock._id)).price;
    expect(resumedPrice).toBe(lastPriceEngine1);
  }, 20000);
});
