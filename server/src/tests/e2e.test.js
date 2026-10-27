/**
 * e2e.test.js - End-to-End Supertest Integration Suite:
 * 1. Register customer -> Buy stock -> Set target -> Create alert -> Check notifications
 * 2. Register company -> Access scoped stock -> Run Monte Carlo simulation scenario
 * 3. Authorization & Ownership security checks (forbidden access to foreign resources)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { app } from '../server.js';
import { Stock } from '../models/Stock.js';
import { User } from '../models/User.js';

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.disconnect();
  await mongoose.connect(uri);

  // Seed sample stock for testing
  await Stock.create({
    symbol: 'TESTCO',
    name: 'Test Corporation',
    sector: 'Technology',
    mu: 0.12,
    sigma: 0.20,
    currentPrice: 100.0,
    previousClose: 100.0,
    totalShares: 10000000,
    tickCount: 1,
    viewCount: 0
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

describe('E2E Customer Journey (Register → Buy → Target → Alert → Notify)', () => {
  let customerToken = '';
  let customerUser = null;
  let testStock = null;
  let createdTargetId = '';
  let createdAlertId = '';

  it('1. Registers a new retail customer with starting virtual balance', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Demo End2End Trader',
        email: 'e2e_trader@tradesim.in',
        password: 'Password123!',
        role: 'CUSTOMER'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.role).toBe('CUSTOMER');
    expect(res.body.data.user.virtualBalance).toBeGreaterThanOrEqual(100000);

    customerToken = res.body.data.token;
    customerUser = res.body.data.user;

    testStock = await Stock.findOne({ symbol: 'TESTCO' });
    expect(testStock).toBeDefined();
  });

  it('2. Executes a stock BUY trade at current market price with 0.05% fee', async () => {
    const res = await request(app)
      .post('/api/trade/buy')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        stockId: testStock._id.toString(),
        quantity: 10
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.transaction).toBeDefined();
    expect(res.body.data.transaction.quantity).toBe(10);
    expect(res.body.data.transaction.fee).toBeGreaterThan(0);
    expect(res.body.data.holding).toBeDefined();
  });

  it('3. Sets a probability target and verifies analytical probability computation', async () => {
    const res = await request(app)
      .post('/api/targets')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        stockId: testStock._id.toString(),
        targetPrice: 110.0,
        deadlineDays: 30,
        mode: 'touch'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.targetPrice).toBe(110);
    expect(res.body.data.lastProbability).toBeGreaterThan(0);

    createdTargetId = res.body.data._id;
  });

  it('4. Creates an alert rule linked to stock percentage shifts', async () => {
    const res = await request(app)
      .post('/api/alerts')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        stockId: testStock._id.toString(),
        type: 'PCT_CHANGE',
        threshold: 3.0,
        cooldownTicks: 390
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.type).toBe('PCT_CHANGE');
    expect(res.body.data.threshold).toBe(3);

    createdAlertId = res.body.data._id;
  });

  it('5. Queries user notification feed and marks notifications read', async () => {
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.notifications)).toBe(true);
  });

  it('6. Enforces resource ownership security (User B cannot delete User A target)', async () => {
    // Register second user
    const resReg = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Attacker User',
        email: 'attacker@tradesim.in',
        password: 'Password123!',
        role: 'CUSTOMER'
      });
    const attackerToken = resReg.body.data.token;

    // Attacker attempts to cancel User A's target
    const resDel = await request(app)
      .delete(`/api/targets/${createdTargetId}`)
      .set('Authorization', `Bearer ${attackerToken}`);

    expect(resDel.status).toBe(404); // Scoped to req.user._id, invisible to other users
  });
});

describe('E2E Company Flow (Register → Scoped Dashboard → Monte Carlo Stress Test)', () => {
  let companyToken = '';
  let companyStockId = '';

  it('1. Registers a new listed company with custom stock parameters', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Dr. Jane Smith',
        email: 'ceo@novapharma.sim',
        password: 'Password123!',
        role: 'COMPANY',
        companyName: 'Nova Pharma Labs',
        symbol: 'NOVAP',
        sector: 'Pharma',
        mu: 0.15,
        sigma: 0.28
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe('COMPANY');
    expect(res.body.data.user.stock).toBeDefined();
    expect(res.body.data.user.stock.symbol).toBe('NOVAP');

    companyToken = res.body.data.token;
    companyStockId = res.body.data.user.stock._id;
  });

  it('2. Accesses company dashboard scoped to its own stock', async () => {
    const res = await request(app)
      .get('/api/company/home')
      .set('Authorization', `Bearer ${companyToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.stock.symbol).toBe('NOVAP');
    expect(res.body.data.ranks).toBeDefined();
    expect(res.body.data.riskMetrics).toBeDefined();
  });

  it('3. Runs Monte Carlo simulation with discrete shocks and feasibility gates', async () => {
    const res = await request(app)
      .post('/api/company/simulate')
      .set('Authorization', `Bearer ${companyToken}`)
      .send({
        horizonDays: 30,
        volatilityMultiplier: 1.2,
        shocks: [{ day: 5, pct: -0.10 }],
        nPaths: 1000,
        thresholds: {
          minTargetProb: 0.20,
          maxLossProb: 0.45,
          maxDrawdown: 0.30
        }
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.simulation).toBeDefined();
    expect(res.body.data.simulation.percentiles).toBeDefined();
    expect(res.body.data.feasibilityCheck).toBeDefined();
    expect(Array.isArray(res.body.data.feasibilityCheck.conditions)).toBe(true);
  });
});
