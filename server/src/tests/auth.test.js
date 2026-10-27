import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import express from 'express';
import authRoutes from '../routes/auth.routes.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { Stock } from '../models/Stock.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

app.get('/api/test/customer-only', requireAuth, requireRole('CUSTOMER'), (req, res) => {
  res.json({ success: true, message: 'Welcome customer', user: req.user });
});

app.get('/api/test/company-only', requireAuth, requireRole('COMPANY'), (req, res) => {
  res.json({ success: true, message: 'Welcome company', user: req.user });
});

app.use(errorHandler);

let mongoServer;
let httpServer;
let baseUrl;
let customerToken = null;
let companyToken = null;

async function makeRequest(method, url, body = null, token = null) {
  const res = await fetch(`${baseUrl}${url}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  return { status: res.status, body: data };
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  httpServer = http.createServer(app);
  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const { port } = httpServer.address();
  baseUrl = `http://127.0.0.1:${port}`;
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

describe('Authentication & Role-Based Authorization Integration', () => {
  it('registers a CUSTOMER with 1,000,000 virtual balance and never returns passwordHash', async () => {
    const res = await makeRequest('POST', '/api/auth/register', {
      name: 'John Trader',
      email: 'john@test.com',
      password: 'SecurePassword123',
      role: 'CUSTOMER'
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();

    const user = res.body.data.user;
    expect(user.name).toBe('John Trader');
    expect(user.email).toBe('john@test.com');
    expect(user.role).toBe('CUSTOMER');
    expect(user.virtualBalance).toBe(1000000);
    expect(user.passwordHash).toBeUndefined();

    customerToken = res.body.data.token;
  });

  it('registers a COMPANY, automatically creates linked Stock with mu in [0.05, 0.25] and sigma in [0.15, 0.50]', async () => {
    const res = await makeRequest('POST', '/api/auth/register', {
      name: 'Elena Rostova',
      email: 'elena@test.com',
      password: 'SecurePassword123',
      role: 'COMPANY',
      companyName: 'Acme Technologies Ltd',
      sector: 'Information Technology',
      symbol: 'ACME',
      initialPrice: 1250.00
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();

    const user = res.body.data.user;
    expect(user.role).toBe('COMPANY');
    expect(user.virtualBalance).toBe(0);
    expect(user.stockId).toBeDefined();
    expect(user.passwordHash).toBeUndefined();

    const stock = await Stock.findById(user.stockId);
    expect(stock).not.toBeNull();
    expect(stock.symbol).toBe('ACME');
    expect(stock.currentPrice).toBe(1250.00);
    expect(stock.ownerCompany.toString()).toBe(user._id.toString() || user.id.toString());

    expect(stock.mu).toBeGreaterThanOrEqual(0.05);
    expect(stock.mu).toBeLessThanOrEqual(0.25);
    expect(stock.sigma).toBeGreaterThanOrEqual(0.15);
    expect(stock.sigma).toBeLessThanOrEqual(0.50);

    companyToken = res.body.data.token;
  });

  it('rejects duplicate email registrations with 409', async () => {
    const res = await makeRequest('POST', '/api/auth/register', {
      name: 'John Duplicate',
      email: 'john@test.com',
      password: 'Password123',
      role: 'CUSTOMER'
    });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('EMAIL_EXISTS');
  });

  it('logs in registered user, returns JWT and user without passwordHash', async () => {
    const res = await makeRequest('POST', '/api/auth/login', {
      email: 'john@test.com',
      password: 'SecurePassword123'
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('rejects invalid credentials with 401', async () => {
    const res = await makeRequest('POST', '/api/auth/login', {
      email: 'john@test.com',
      password: 'WrongPassword'
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('allows access to GET /api/auth/me with valid token and returns safe user data', async () => {
    const res = await makeRequest('GET', '/api/auth/me', null, customerToken);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('john@test.com');
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('blocks unauthenticated access to protected routes with 401', async () => {
    const res = await makeRequest('GET', '/api/test/customer-only', null, null);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 Forbidden when a CUSTOMER attempts to access a COMPANY-only route', async () => {
    const res = await makeRequest('GET', '/api/test/company-only', null, customerToken);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 403 Forbidden when a COMPANY attempts to access a CUSTOMER-only route', async () => {
    const res = await makeRequest('GET', '/api/test/customer-only', null, companyToken);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('allows access when user has the matching role', async () => {
    const res = await makeRequest('GET', '/api/test/company-only', null, companyToken);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Welcome company');
  });

  it('supports POST /api/auth/logout', async () => {
    const res = await makeRequest('POST', '/api/auth/logout', null, customerToken);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toBe('Logged out successfully');
  });
});
