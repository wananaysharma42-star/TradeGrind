import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { PriceTick } from '../models/PriceTick.js';
import { prunePriceTicks } from '../jobs/tickRetention.js';
import { Stock } from '../models/Stock.js';
import { User } from '../models/User.js';

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

describe('PriceTick retention', () => {
  it('keeps only the last 2000 ticks per stock', async () => {
    const company = await User.create({
      name: 'Retention Co',
      email: 'retention@test.com',
      passwordHash: 'hash',
      role: 'COMPANY',
      virtualBalance: 0,
      companyName: 'Retention Ltd',
      sector: 'Tech'
    });

    const stock = await Stock.create({
      symbol: 'KEEP',
      name: 'Retention Ltd',
      sector: 'Tech',
      mu: 0.1,
      sigma: 0.2,
      currentPrice: 100,
      previousClose: 100,
      ownerCompany: company._id,
      totalShares: 1000
    });

    const docs = Array.from({ length: 2010 }, (_, i) => ({
      stockId: stock._id,
      price: 100 + i * 0.01,
      tickIndex: i + 1,
      simDay: 1,
      ts: new Date()
    }));
    await PriceTick.insertMany(docs);

    await prunePriceTicks(2000);

    const remaining = await PriceTick.countDocuments({ stockId: stock._id });
    expect(remaining).toBe(2000);

    const oldest = await PriceTick.findOne({ stockId: stock._id }).sort({ tickIndex: 1 });
    expect(oldest.tickIndex).toBe(11);
  });
});
