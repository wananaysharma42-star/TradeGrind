import { describe, it, expect } from 'vitest';
import { normalCdf, normalPdf, createPseudoRandom, standardNormal } from '../normal.js';
import { gbmStep, gbmPath, mulberry32, randn, nextPrice, simulatePath } from '../gbm.js';
import { calculateTerminalProbability, calculateHittingProbability } from '../probability.js';
import {
  calculateReturns,
  calculateMean,
  calculateVariance,
  calculateStdDev,
  calculateBeta,
  calculateSharpeRatio,
  calculateVaR95
} from '../statistics.js';
import {
  calculateSma,
  calculateEma,
  calculateRsi,
  calculateMacd,
  calculateBollingerBands
} from '../technical.js';
import { runWhatIfSimulation } from '../simulation.js';
import { TIME_CONFIG, ticksToDays, daysToTicks, formatSimTime } from '../../config/time.js';

describe('Simulation Time Model', () => {
  it('converts ticks and days accurately', () => {
    expect(TIME_CONFIG.TICKS_PER_DAY).toBe(390);
    expect(TIME_CONFIG.DAYS_PER_YEAR).toBe(252);
    expect(daysToTicks(1)).toBe(390);
    expect(ticksToDays(390)).toBe(1);
    expect(ticksToDays(780)).toBe(2);
  });

  it('formats simulated market time correctly', () => {
    const t0 = formatSimTime(0);
    expect(t0.day).toBe(1);
    expect(t0.timeStr).toBe('09:15 AM');

    const t389 = formatSimTime(389);
    expect(t389.day).toBe(1);
    expect(t389.timeStr).toBe('03:44 PM');

    const t390 = formatSimTime(390);
    expect(t390.day).toBe(2);
    expect(t390.timeStr).toBe('09:15 AM');
  });
});

describe('Normal Distribution & Pseudo-Random', () => {
  it('computes standard normal CDF with high precision', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 5);
    expect(normalCdf(1.95996)).toBeCloseTo(0.975, 4);
    expect(normalCdf(-1.95996)).toBeCloseTo(0.025, 4);
    expect(normalCdf(2.5758)).toBeCloseTo(0.995, 3);
  });

  it('computes normal PDF accurately', () => {
    expect(normalPdf(0)).toBeCloseTo(0.39894, 4);
    expect(normalPdf(1)).toBeCloseTo(0.24197, 4);
  });

  it('generates reproducible numbers with seedable PRNG', () => {
    const prng1 = createPseudoRandom(42);
    const prng2 = createPseudoRandom(42);
    const v1 = [prng1(), prng1(), prng1()];
    const v2 = [prng2(), prng2(), prng2()];
    expect(v1).toEqual(v2);
  });
});

describe('Geometric Brownian Motion (GBM)', () => {
  it('computes expected price step with zero shock (z=0)', () => {
    const s0 = 1000;
    const mu = 0.10;
    const sigma = 0.20;
    const dt = TIME_CONFIG.DT; // 1 / (252*390)
    // with z = 0, nextPrice = 1000 * exp((0.10 - 0.5 * 0.04) * dt)
    const expected = s0 * Math.exp((0.10 - 0.02) * dt);
    const step = gbmStep(s0, mu, sigma, dt, 0);
    expect(step).toBeCloseTo(expected, 2);
  });

  it('generates deterministic multi-step path with fixed z', () => {
    const s0 = 500;
    const path = gbmPath(s0, 0.12, 0.25, 5, 0.001, [0, 0, 0, 0, 0]);
    expect(path.length).toBe(6);
    expect(path[0]).toBe(500);
    expect(path[5]).toBeGreaterThan(path[0]); // positive drift
  });

  it('mulberry32 is seedable and randn+nextPrice match the closed-form step', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);

    const S = 100;
    const mu = 0.1;
    const sigma = 0.2;
    const dt = 1 / 252;
    const Z = 0;
    expect(nextPrice(S, mu, sigma, dt, Z)).toBe(S * Math.exp((mu - 0.5 * sigma * sigma) * dt));
    expect(randn(mulberry32(7))).toBeTypeOf('number');
  });

  it('mean and std of ln(S_T/S_0) match GBM theory over 20,000 seeded paths', () => {
    const S0 = 100;
    const mu = 0.10;
    const sigma = 0.20;
    const dt = 1 / 252;
    const steps = 252;
    const T = steps * dt;
    const n = 20_000;
    const rng = mulberry32(20261027);

    const logs = new Array(n);
    for (let i = 0; i < n; i++) {
      const path = simulatePath(S0, mu, sigma, dt, steps, rng);
      expect(path.length).toBe(steps + 1);
      logs[i] = Math.log(path[steps] / S0);
    }

    const mean = logs.reduce((s, x) => s + x, 0) / n;
    const variance = logs.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1);
    const std = Math.sqrt(variance);

    const expectedMean = (mu - 0.5 * sigma * sigma) * T;
    const expectedStd = sigma * Math.sqrt(T);
    const se = std / Math.sqrt(n);

    expect(Math.abs(mean - expectedMean)).toBeLessThanOrEqual(3 * se);
    expect(Math.abs(std - expectedStd)).toBeLessThanOrEqual(0.03 * expectedStd);
  });
});

describe('Target Probability Calculations', () => {
  it('evaluates terminal probability for in-the-money targets as 1.0', () => {
    expect(calculateTerminalProbability(105, 100, 10, 0.1, 0.2, 'ABOVE')).toBe(1.0);
    expect(calculateTerminalProbability(95, 100, 10, 0.1, 0.2, 'BELOW')).toBe(1.0);
  });

  it('evaluates realistic upside target probability', () => {
    const s0 = 100;
    const target = 110;
    const days = 30;
    const mu = 0.15;
    const sigma = 0.25;

    const termProb = calculateTerminalProbability(s0, target, days, mu, sigma, 'ABOVE');
    expect(termProb).toBeGreaterThan(0.05);
    expect(termProb).toBeLessThan(0.60);

    const hitProb = calculateHittingProbability(s0, target, days, mu, sigma);
    // First hitting probability must be strictly greater than or equal to terminal probability
    expect(hitProb).toBeGreaterThanOrEqual(termProb);
  });

  it('returns 0 for expired unreachable targets', () => {
    expect(calculateTerminalProbability(100, 150, 0, 0.1, 0.2, 'ABOVE')).toBe(0.0);
  });
});

describe('Statistical & Risk Metrics', () => {
  it('computes mean, variance and std dev', () => {
    const data = [2, 4, 4, 4, 5, 5, 7, 9];
    expect(calculateMean(data)).toBe(5);
    // Population variance is 32 / 8 = 4
    expect(calculateVariance(data, false)).toBe(4);
    expect(calculateStdDev(data, false)).toBe(2);
    // Sample variance is 32 / 7 ~ 4.5714
    expect(calculateVariance(data, true)).toBeCloseTo(4.5714, 3);
  });

  it('calculates log returns', () => {
    const prices = [100, 110, 105];
    const rets = calculateReturns(prices);
    expect(rets.length).toBe(2);
    expect(rets[0]).toBeCloseTo(Math.log(1.1), 4);
  });

  it('computes Beta accurately', () => {
    const marketRets = [0.01, 0.02, -0.01, 0.03, -0.02];
    const assetRets = [0.015, 0.03, -0.015, 0.045, -0.03]; // Exactly 1.5x market
    const beta = calculateBeta(assetRets, marketRets);
    expect(beta).toBeCloseTo(1.5, 1);
  });

  it('computes Sharpe Ratio and VaR95', () => {
    const sharpe = calculateSharpeRatio(0.18, 0.20, 0.065);
    // (0.18 - 0.065) / 0.20 = 0.575 -> 0.58
    expect(sharpe).toBeCloseTo(0.58, 2);

    const var95 = calculateVaR95(1000000, 0.20);
    // dailyVol = 0.20 / sqrt(252) ~ 0.0125988
    // 1000000 * 0.0125988 * 1.64485 ~ 20,723
    expect(var95).toBeGreaterThan(18000);
    expect(var95).toBeLessThan(23000);
  });
});

describe('Technical Analysis Indicators', () => {
  const prices = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29];

  it('calculates SMA and EMA', () => {
    const sma5 = calculateSma(prices, 5);
    expect(sma5).toBe(27); // (25+26+27+28+29)/5 = 27

    const ema5 = calculateEma(prices, 5);
    expect(ema5).toBeGreaterThan(25);
  });

  it('calculates RSI for upward trend', () => {
    const rsi = calculateRsi(prices, 14);
    // Strictly increasing prices yields 100 RSI
    expect(rsi).toBe(100);

    const mixed = [100, 102, 101, 103, 102, 104, 101, 100, 102, 103, 101, 102, 103, 102, 101, 102];
    const mixedRsi = calculateRsi(mixed, 14);
    expect(mixedRsi).toBeGreaterThan(40);
    expect(mixedRsi).toBeLessThan(70);
  });

  it('calculates Bollinger Bands', () => {
    const bb = calculateBollingerBands(prices, 10, 2);
    expect(bb).not.toBeNull();
    expect(bb.upper).toBeGreaterThan(bb.middle);
    expect(bb.lower).toBeLessThan(bb.middle);
  });
});

describe('Company What-If Simulation', () => {
  it('runs scenario projection with bounds and sensitivity matrix', () => {
    const result = runWhatIfSimulation({
      currentPrice: 1000,
      mu: 0.12,
      sigma: 0.20,
      sharesOutstanding: 10000000,
      horizonDays: 60,
      deltaMu: 0.03, // increase drift to 15%
      deltaSigma: -0.02, // reduce volatility to 18%
      shareAdjustmentPercent: -2, // 2% buyback
      dividendPerShare: 10 // ₹10 dividend
    });

    expect(result.trajectory.length).toBeGreaterThan(10);
    expect(result.trajectory[0].day).toBe(0);
    expect(result.trajectory[0].p50).toBe(990); // 1000 - 10
    
    // Check 10th <= 50th <= 90th percentile bounds
    result.trajectory.forEach(pt => {
      expect(pt.p10).toBeLessThanOrEqual(pt.p50 + 0.01);
      expect(pt.p50).toBeLessThanOrEqual(pt.p90 + 0.01);
    });

    expect(result.sensitivityMatrix.length).toBe(5);
    expect(result.sensitivityMatrix[0].length).toBe(5);
  });
});
