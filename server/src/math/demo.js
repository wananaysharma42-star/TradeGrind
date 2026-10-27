/**
 * demo.js - CLI demonstration of closed-form vs Monte Carlo pricing across 3 scenarios.
 * Run with: node src/math/demo.js
 */

import { closedFormTerminalProb, closedFormTouchProb, monteCarloHitProbability, requiredReturn } from './probability.js';
import { mulberry32 } from './gbm.js';

const scenarios = [
  {
    name: 'Scenario 1: Moderate Growth (Reliance / Large Cap)',
    S0: 2500,
    K: 2750, // +10% target
    mu: 0.12,
    sigma: 0.20,
    days: 30, // ~1.5 months
    nPaths: 25000
  },
  {
    name: 'Scenario 2: High Volatility Tech / Growth Stock',
    S0: 100,
    K: 125, // +25% upside
    mu: 0.18,
    sigma: 0.40,
    days: 60,
    nPaths: 25000
  },
  {
    name: 'Scenario 3: Downside Protection / Stop Loss Touch',
    S0: 500,
    K: 450, // -10% drop barrier
    mu: 0.08,
    sigma: 0.25,
    days: 45,
    nPaths: 25000
  }
];

console.log('='.repeat(80));
console.log('       TRADESIM QUANT MATH ENGINE: CLOSED-FORM VS MONTE CARLO DEMO');
console.log('='.repeat(80));

for (const sc of scenarios) {
  const T = sc.days / 252;
  const cfTerm = closedFormTerminalProb(sc.S0, sc.K, sc.mu, sc.sigma, T);
  const cfTouch = closedFormTouchProb(sc.S0, sc.K, sc.mu, sc.sigma, T);
  const reqRet = requiredReturn(sc.S0, sc.K, sc.days);

  const rng = mulberry32(1337);
  const mcTerm = monteCarloHitProbability({
    S0: sc.S0,
    K: sc.K,
    mu: sc.mu,
    sigma: sc.sigma,
    days: sc.days,
    nPaths: sc.nPaths,
    mode: 'terminal',
    rng
  });

  const rng2 = mulberry32(4242);
  const mcTouch = monteCarloHitProbability({
    S0: sc.S0,
    K: sc.K,
    mu: sc.mu,
    sigma: sc.sigma,
    days: sc.days,
    nPaths: sc.nPaths,
    mode: 'touch',
    rng: rng2
  });

  const termDiffPct = Math.abs(mcTerm.probability - cfTerm) * 100;
  const touchDiffPct = Math.abs(mcTouch.probability - cfTouch) * 100;

  console.log(`\n▶ ${sc.name}`);
  console.log(`  Initial S0: ₹${sc.S0} | Target K: ₹${sc.K} | Days: ${sc.days} (T = ${T.toFixed(3)} yrs)`);
  console.log(`  Parameters: mu = ${(sc.mu * 100).toFixed(1)}% | sigma = ${(sc.sigma * 100).toFixed(1)}% | Req. Ann. Return = ${(reqRet * 100).toFixed(1)}%`);
  console.log(`  Paths: ${sc.nPaths.toLocaleString()} paths (15-min granularity = 26 steps/day)`);
  console.log('  ' + '-'.repeat(74));
  console.log(`  TERMINAL PROBABILITY:`);
  console.log(`    Closed-Form (N(d2)) : ${(cfTerm * 100).toFixed(2)}%`);
  console.log(`    Monte Carlo         : ${(mcTerm.probability * 100).toFixed(2)}%  [95% CI: ${(mcTerm.ciLow * 100).toFixed(2)}% - ${(mcTerm.ciHigh * 100).toFixed(2)}%]`);
  console.log(`    Absolute Difference : ${termDiffPct.toFixed(2)}% ${termDiffPct <= 2.0 ? '✓ (Within 2% tolerance)' : '✗'}`);
  console.log(`  TOUCH / BARRIER PROBABILITY:`);
  console.log(`    Closed-Form (Touch) : ${(cfTouch * 100).toFixed(2)}%`);
  console.log(`    Monte Carlo         : ${(mcTouch.probability * 100).toFixed(2)}%  [95% CI: ${(mcTouch.ciLow * 100).toFixed(2)}% - ${(mcTouch.ciHigh * 100).toFixed(2)}%]`);
  console.log(`    Absolute Difference : ${touchDiffPct.toFixed(2)}% ${touchDiffPct <= 3.0 ? '✓ (Within 3% tolerance)' : '✗'}`);
  if (mcTouch.meanTimeToHit !== null) {
    console.log(`    Mean Time to Touch  : ${mcTouch.meanTimeToHit.toFixed(1)} trading days`);
  }
}

console.log('\n' + '='.repeat(80));
console.log('Demo completed successfully.');
