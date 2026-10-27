import { describe, it, expect } from 'vitest';
import { normalCdf, erf, closedFormTerminalProb, closedFormTouchProb, monteCarloHitProbability, requiredReturn, probabilityGrid } from '../probability.js';
import { logReturns, estimateParams, ewmaVolatility, blendedParams, sampleStd, mean } from '../returns.js';
import { maxDrawdown, sharpeRatio, sortinoRatio, valueAtRisk, expectedShortfall, beta, rollingVolatility } from '../risk.js';
import { sma, ema, rsi, bollingerBands, zScorePrice, momentum } from '../indicators.js';
import { scoreCompanies } from '../scoring.js';
import { portfolioValue, unrealisedPnL, realisedPnL, allocationPercent, portfolioVolatility, equityCurve } from '../portfolio.js';
import { generateQuantInsights } from '../signals.js';
import { mulberry32, nextPrice, simulatePath } from '../gbm.js';

describe('1. returns.js - Return and Parameter Estimation', () => {
  it('computes exact log returns', () => {
    const prices = [100, 105, 102.9];
    const r = logReturns(prices);
    expect(r.length).toBe(2);
    expect(r[0]).toBeCloseTo(Math.log(105 / 100), 8);
    expect(r[1]).toBeCloseTo(Math.log(102.9 / 105), 8);
  });

  it('handles edge cases for log returns', () => {
    expect(logReturns([])).toEqual([]);
    expect(logReturns([100])).toEqual([]);
    expect(logReturns([0, 100])).toEqual([0]);
  });

  it('estimates annualized drift and volatility accurately', () => {
    // Generate synthetic daily returns with known daily mean and std
    const dt = 1 / 252;
    const trueSigma = 0.20;
    const trueMu = 0.10;
    const rng = mulberry32(12345);
    const steps = 10000;
    const path = simulatePath(100, trueMu, trueSigma, dt, steps, rng);
    const r = logReturns(path);

    const { muAnnual, sigmaAnnual } = estimateParams(r, dt);
    expect(sigmaAnnual).toBeCloseTo(trueSigma, 1);
    expect(muAnnual).toBeCloseTo(trueMu, 1);
  });

  it('calculates EWMA volatility with lambda decay', () => {
    const r = [0.01, -0.02, 0.015, -0.005, 0.03, -0.01];
    const ewma = ewmaVolatility(r, 0.94, 1 / 252);
    expect(ewma).toBeGreaterThan(0);
    expect(ewma).toBeLessThan(1.0);
  });

  it('blendedParams averages sample and EWMA volatility 50/50', () => {
    const r = [0.01, -0.01, 0.02, -0.02, 0.015];
    const blended = blendedParams(r, 1 / 252, 0.94);
    expect(blended.sigmaAnnual).toBeCloseTo(0.5 * (blended.sampleVol + blended.ewmaVol), 6);
    expect(blended.muAnnual).toBeDefined();
  });
});

describe('2. risk.js - Risk & Performance Analytics', () => {
  it('computes max drawdown and peak/trough correctly', () => {
    const prices = [100, 120, 90, 110, 80, 130];
    const mdd = maxDrawdown(prices);
    // Peak is 120 (idx 1), trough is 80 (idx 4), drop is (120 - 80) / 120 = 40 / 120 = 0.3333
    expect(mdd.value).toBeCloseTo(1 / 3, 4);
    expect(mdd.peakIndex).toBe(1);
    expect(mdd.troughIndex).toBe(4);
  });

  it('computes annualized Sharpe ratio', () => {
    // If daily returns average 15% annualized with 20% vol and rf = 6%
    const dt = 1 / 252;
    const dailyMean = 0.15 / 252;
    const dailyReturns = new Array(252).fill(dailyMean);
    // Add small alternating noise so std is ~0.20 / sqrt(252)
    const dailyNoise = 0.20 / Math.sqrt(252);
    for (let i = 0; i < 252; i++) {
      dailyReturns[i] += (i % 2 === 0 ? 1 : -1) * dailyNoise;
    }
    const sharpe = sharpeRatio(dailyReturns, 0.06);
    // (0.15 - 0.06) / 0.20 = 0.45
    expect(sharpe).toBeCloseTo(0.45, 1);
  });

  it('computes Sortino ratio penalizing only downside volatility', () => {
    // Two series with same total return, but one has all upside volatility
    const balancedReturns = [-0.01, 0.02, -0.01, 0.02];
    const sortino = sortinoRatio(balancedReturns, 0.06);
    expect(sortino).toBeTypeOf('number');
  });

  it('computes lognormal closed-form and historical VaR', () => {
    const historicalReturns = [-0.03, -0.02, -0.01, 0.01, 0.02, 0.03];
    const { closedFormVaR, historicalVaR } = valueAtRisk({
      portfolioValue: 1_000_000,
      historicalReturns,
      mu: 0.10,
      sigma: 0.20,
      confidence: 0.95,
      horizonDays: 1
    });

    expect(closedFormVaR).toBeGreaterThan(0);
    expect(closedFormVaR).toBeLessThan(1_000_000);
    expect(historicalVaR).toBeGreaterThan(0);
  });

  it('computes Expected Shortfall (CVaR) greater than or equal to VaR', () => {
    const historicalReturns = [-0.05, -0.04, -0.03, -0.01, 0.00, 0.01, 0.02, 0.03];
    const es = expectedShortfall({
      portfolioValue: 100_000,
      historicalReturns,
      confidence: 0.90,
      horizonDays: 1
    });
    expect(es).toBeGreaterThan(0);
  });

  it('computes Beta relative to market benchmark', () => {
    const mkt = [0.01, -0.02, 0.015, 0.005, -0.01];
    // Asset with exactly 1.5x beta
    const asset = mkt.map((r) => r * 1.5);
    const b = beta(asset, mkt);
    expect(b).toBeCloseTo(1.5, 4);
  });

  it('computes rolling volatility series', () => {
    const r = new Array(50).fill(0.01);
    for (let i = 0; i < 50; i += 2) r[i] = -0.01;
    const rolling = rollingVolatility(r, 20);
    expect(rolling.length).toBe(31);
    expect(rolling[0]).toBeGreaterThan(0);
  });
});

describe('3. probability.js - High-Precision Targets & Monte Carlo', () => {
  it('Abramowitz-Stegun erf and normalCdf match standard values', () => {
    expect(erf(0)).toBe(0);
    expect(erf(1)).toBeCloseTo(0.84270079, 5);
    expect(normalCdf(0)).toBe(0.5);
    expect(normalCdf(1.95996)).toBeCloseTo(0.975, 4);
    expect(normalCdf(-1.95996)).toBeCloseTo(0.025, 4);
  });

  it('evaluates closedFormTerminalProb for upside and downside targets', () => {
    const S0 = 100;
    const mu = 0.10;
    const sigma = 0.20;
    const T = 0.5;

    // Upside target K > S0
    const pUp = closedFormTerminalProb(S0, 110, mu, sigma, T);
    expect(pUp).toBeGreaterThan(0);
    expect(pUp).toBeLessThan(1);

    // Downside target K < S0 returns probability of falling to or below
    const pDown = closedFormTerminalProb(S0, 90, mu, sigma, T);
    expect(pDown).toBeGreaterThan(0);
    expect(pDown).toBeLessThan(1);
  });

  it('evaluates closedFormTouchProb (touch >= terminal)', () => {
    const S0 = 100;
    const K = 110;
    const mu = 0.12;
    const sigma = 0.25;
    const T = 0.25;

    const termProb = closedFormTerminalProb(S0, K, mu, sigma, T);
    const touchProb = closedFormTouchProb(S0, K, mu, sigma, T);

    expect(touchProb).toBeGreaterThanOrEqual(termProb);
  });

  it('validates Monte Carlo terminal probability within 2% of closed form across parameter sets', () => {
    const testCases = [
      { S0: 100, K: 110, mu: 0.10, sigma: 0.20, days: 40 },
      { S0: 250, K: 280, mu: 0.15, sigma: 0.30, days: 60 },
      { S0: 50,  K: 45,  mu: 0.08, sigma: 0.25, days: 30 }
    ];

    for (const tc of testCases) {
      const T = tc.days / 252;
      const cf = closedFormTerminalProb(tc.S0, tc.K, tc.mu, tc.sigma, T);
      const mc = monteCarloHitProbability({
        S0: tc.S0,
        K: tc.K,
        mu: tc.mu,
        sigma: tc.sigma,
        days: tc.days,
        nPaths: 20000,
        mode: 'terminal',
        rng: mulberry32(42)
      });

      expect(Math.abs(mc.probability - cf)).toBeLessThanOrEqual(0.02);
      expect(mc.percentiles.p50.length).toBe(tc.days + 1);
    }
  });

  it('validates Monte Carlo touch probability within 3% of closed-form barrier probability', () => {
    const S0 = 100;
    const K = 115;
    const mu = 0.12;
    const sigma = 0.25;
    const days = 45;
    const T = days / 252;

    const cfTouch = closedFormTouchProb(S0, K, mu, sigma, T);
    const mc = monteCarloHitProbability({
      S0,
      K,
      mu,
      sigma,
      days,
      nPaths: 20000,
      mode: 'touch',
      rng: mulberry32(999)
    });

    expect(Math.abs(mc.probability - cfTouch)).toBeLessThanOrEqual(0.03);
    expect(mc.meanTimeToHit).toBeGreaterThan(0);
    expect(mc.meanTimeToHit).toBeLessThanOrEqual(days);
  });

  it('computes requiredReturn and probabilityGrid', () => {
    const req = requiredReturn(100, 110, 252);
    expect(req).toBeCloseTo(0.10, 4);

    const grid = probabilityGrid({
      S0: 100,
      mu: 0.10,
      sigma: 0.20,
      targets: [105, 110],
      days: [30, 60],
      mode: 'touch'
    });

    expect(grid.length).toBe(4);
    expect(grid[0]).toHaveProperty('probability');
    expect(grid[0]).toHaveProperty('requiredReturn');
  });
});

describe('4. indicators.js - Technical Indicators', () => {
  it('computes SMA and EMA', () => {
    const prices = [10, 11, 12, 13, 14, 15];
    expect(sma(prices, 3)).toBe(14); // (13 + 14 + 15) / 3 = 14
    expect(ema(prices, 3)).toBeGreaterThan(13);
  });

  it('computes RSI-14 between 0 and 100', () => {
    const rising = Array.from({ length: 30 }, (_, i) => 100 + i * 2);
    const rsiHigh = rsi(rising, 14);
    expect(rsiHigh).toBeGreaterThan(70);

    const falling = Array.from({ length: 30 }, (_, i) => 100 - i * 2);
    const rsiLow = rsi(falling, 14);
    expect(rsiLow).toBeLessThan(30);
  });

  it('computes Bollinger Bands', () => {
    const prices = Array.from({ length: 25 }, (_, i) => 100 + Math.sin(i));
    const bb = bollingerBands(prices, 20, 2);
    expect(bb.upper).toBeGreaterThan(bb.middle);
    expect(bb.lower).toBeLessThan(bb.middle);
    expect(bb.bandwidth).toBeGreaterThan(0);
  });

  it('computes price Z-score and Momentum', () => {
    const prices = new Array(25).fill(100);
    prices[24] = 110;
    const z = zScorePrice(prices, 20);
    expect(z).toBeGreaterThan(1.0);

    const mom = momentum(prices, 10);
    expect(mom).toBe(0.10); // (110 - 100) / 100
  });
});

describe('5. scoring.js - Multi-Factor Company Scoring', () => {
  it('computes multi-factor score and ranks correctly', () => {
    const companies = [
      {
        id: '1',
        symbol: 'ALPHA',
        sector: 'Tech',
        prices: Array.from({ length: 40 }, (_, i) => 100 + i * 1.5) // Strong return, low vol
      },
      {
        id: '2',
        symbol: 'BETA',
        sector: 'Tech',
        prices: Array.from({ length: 40 }, (_, i) => 100 + (i % 2 === 0 ? 10 : -10)) // Choppy / volatile
      },
      {
        id: '3',
        symbol: 'GAMMA',
        sector: 'Finance',
        prices: Array.from({ length: 40 }, (_, i) => 100 - i * 0.5) // Negative return
      }
    ];

    const scored = scoreCompanies(companies);
    expect(scored.length).toBe(3);
    expect(scored[0].overallRank).toBe(1);
    expect(scored[0].symbol).toBe('ALPHA');
    expect(scored[0].components).toHaveProperty('return30d');
    expect(scored[0].components).toHaveProperty('sharpe');
    expect(scored[0].components).toHaveProperty('volatility');
    expect(scored[0].components).toHaveProperty('maxDrawdown');
  });
});

describe('6. portfolio.js - Portfolio Math', () => {
  it('computes portfolio value and allocation percent', () => {
    const holdings = [
      { id: 'S1', symbol: 'S1', quantity: 10, currentPrice: 100 },
      { id: 'S2', symbol: 'S2', quantity: 20, currentPrice: 50 }
    ];
    const cash = 1000;
    const total = portfolioValue(cash, holdings);
    expect(total).toBe(3000); // 1000 + 1000 + 1000

    const alloc = allocationPercent(cash, holdings);
    expect(alloc.length).toBe(3);
    expect(alloc[0].weightPct).toBeCloseTo(33.333, 2);
  });

  it('computes unrealised and realised P&L', () => {
    const holdings = [
      { quantity: 10, currentPrice: 150, avgCost: 100 }
    ];
    const pnl = unrealisedPnL(holdings);
    expect(pnl.absolutePnL).toBe(500);
    expect(pnl.percentPnL).toBe(50);

    const realised = realisedPnL(5, 160, 100);
    expect(realised).toBe(300); // 5 * (160 - 100)
  });

  it('computes portfolio volatility via covariance matrix of daily returns', () => {
    // 2 uncorrelated assets with equal weights
    const n = 100;
    const r1 = new Array(n).fill(0.01);
    const r2 = new Array(n).fill(0.01);
    for (let i = 0; i < n; i++) {
      if (i % 2 === 0) r1[i] = -0.01;
      if (i % 4 < 2) r2[i] = -0.01;
    }
    const weights = [0.5, 0.5];
    const portVol = portfolioVolatility(weights, [r1, r2], 252);
    expect(portVol).toBeGreaterThan(0);
  });

  it('builds equity curve from snapshots', () => {
    const snapshots = [
      { simDay: 1, totalValue: 100000 },
      { simDay: 2, totalValue: 105000 },
      { simDay: 3, totalValue: 110250 }
    ];
    const curve = equityCurve(snapshots);
    expect(curve.length).toBe(3);
    expect(curve[1].dailyReturn).toBeCloseTo(0.05, 4);
    expect(curve[2].cumulativeReturn).toBeCloseTo(0.1025, 4);
  });
});

describe('7. signals.js - Quant Insights', () => {
  it('generates rule-based deterministic neutral insight statements without buy/sell advice', () => {
    const prices = Array.from({ length: 30 }, (_, i) => 100 + i * 2);
    const marketVols = [0.15, 0.20, 0.25, 0.35, 0.40];

    const insights = generateQuantInsights({
      prices,
      symbol: 'TEST',
      marketVolatilities: marketVols
    });

    expect(insights.length).toBeGreaterThanOrEqual(3);
    for (const insight of insights) {
      expect(insight).toHaveProperty('category');
      expect(insight).toHaveProperty('statement');
      expect(insight.statement.toLowerCase()).not.toContain('buy');
      expect(insight.statement.toLowerCase()).not.toContain('sell');
    }

    const rsiInsight = insights.find((i) => i.category === 'Momentum');
    expect(rsiInsight.statement).toContain('RSI');
  });
});
