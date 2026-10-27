# TradeGrind System Audit Report (Phase 1)

## Executive Summary
This document provides a comprehensive audit of the **TradeGrind** codebase across server and client components, real-time socket architecture, quantitative mathematical formulations, database integrity, and UI/UX fidelity.

---

## 1. Test, Build & Runtime Status

| Component | Status | Details |
|---|---|---|
| Server Vitest Suite | ✅ PASS | 113 / 113 tests passed across 10 test files (`alertEngine`, `customerBackend`, `math_exhaustive`, `companyBackend`, `math`, `e2e`, `auth`, `marketEngine`, `validators`, `models`). |
| Client Build (`vite build`) | ✅ PASS | Exits 0, bundled assets cleanly generated in `dist/`. |
| Runtime Database | ✅ CONNECTED | MongoDB Atlas cluster (`tradesim` db) active. |
| Background Jobs | ✅ RUNNING | Market engine tick loop (1000ms), tick retention job, target watcher active. |

---

## 2. Identified Issues & Violations by Category

### Category A: Critical & High Severity Bugs (Data Flow, Crashes, Socket Mismatch)

1. **`market:tick` Payload Shape Mismatch Breaking Live Prices**
   - **File**: `server/src/services/marketEngine.js:314`, `client/src/store/slices/marketSlice.js:32`, `client/src/services/socket.js:33`
   - **Severity**: HIGH
   - **Root Cause**: Server `_emitMarketTick(marketPayload)` sends a flat array `[{ stockId, symbol, price, changePct }]`, while client `processMarketTick` expects an object `{ simTime, globalTick, stocks: [] }`. As a result, `simTime`, `globalTick`, and `stocks` remain undefined on the client, completely halting real-time price updates and market clock progression in Redux.

2. **Portfolio Data Field Name & Casing Incompatibilities**
   - **File**: `server/src/routes/portfolio.routes.js:164`, `server/src/services/marketEngine.js:635`, `client/src/store/slices/portfolioSlice.js:29,43`, `client/src/pages/customer/CustomerPortfolioView.jsx:62-65`, `client/src/pages/customer/CustomerDashboardView.jsx:108-111`
   - **Severity**: HIGH
   - **Root Cause**: Server REST returns `{ cash, totalPortfolioValue, totalUnrealizedPnl }`, server socket returns `{ cash, totalValue, holdingsValue, dayPnL }`, while client Redux and views look for `{ cashBalance, totalValue, totalUnrealizedPnL }`. The mismatch causes cash balances and portfolio values to evaluate to `undefined` or fall back to static constants.

3. **Missing Unique Key Warning & Null Hook Exceptions in Company Portal**
   - **File**: `client/src/components/ui/Input.jsx:80`, `client/src/pages/company/CompanyAlertsView.jsx:326`, `client/src/pages/company/CompanyDashboardView.jsx:32`
   - **Severity**: MEDIUM (Previously diagnosed & patched in session)
   - **Root Cause**: Select options lacked explicit keys; `useSocket()` returned null if accessed before initialization; `notifications` payload from API had wrapped `{ notifications: [...] }` causing `.some()` to fail on non-arrays.

4. **Estimated Parameters vs Hidden True Parameters in Target Resolution**
   - **File**: `server/src/jobs/targetWatcher.js:56`
   - **Severity**: MEDIUM
   - **Root Cause**: `targetWatcher` invoked probability formulas with `live?.mu || stock.mu` and `live?.sigma || stock.sigma`, which pull the hidden true GBM parameters rather than parameter estimates derived from observed daily candle returns.

---

### Category B: Hardcoded, Static & Placeholder Values (Violation of Dynamic Requirement)

1. **Hardcoded Portfolio Performance Chart Fallback**
   - **File**: `client/src/pages/customer/CustomerDashboardView.jsx:119-125`
   - **Severity**: HIGH
   - **Occurrence**: Hardcoded mock array `[{ date: 'Day 1', value: 980000 }, { date: 'Day 5', value: 995000 }, { date: 'Day 10', value: 1010000 }, { date: 'Day 20', value: 1025000 }]` rendered whenever `portfolioHistory` is initially empty.
   - **Root Cause**: Lack of dynamic fallback from the user's initial virtual balance or portfolio snapshot history.

2. **Hardcoded Active Strip Stock Fallback**
   - **File**: `client/src/pages/customer/CustomerDashboardView.jsx:131-138`
   - **Severity**: MEDIUM
   - **Occurrence**: `symbol: 'INFY', name: 'Infosys Ltd', price: 1540.20, mu: 0.12, sigma: 0.22, dayChangePercent: 1.25` hardcoded as fallback for rotating strip.

3. **Hardcoded Rotating Detailed Analytics Fallback**
   - **File**: `client/src/pages/customer/CustomerDashboardView.jsx:142-148`
   - **Severity**: MEDIUM
   - **Occurrence**: `return30d: 0.045, sharpeRatio: 1.35, maxDrawdown: 0.052, rsi14: 54.2` hardcoded if analytics not matched.

4. **Hardcoded Redux Initial Portfolio Balance**
   - **File**: `client/src/store/slices/portfolioSlice.js:5,7`
   - **Severity**: MEDIUM
   - **Occurrence**: `cashBalance: 1000000, totalPortfolioValue: 1000000` hardcoded in slice initial state instead of loading state.

5. **Hardcoded Risk Metrics Display in Portfolio Page**
   - **File**: `client/src/pages/customer/CustomerPortfolioView.jsx:209`
   - **Severity**: MEDIUM
   - **Occurrence**: `portfolioData?.sharpeRatio || 1.35` and `portfolioData?.portfolioVolatility || 0.16` hardcoded in JSX template.

6. **Hardcoded Market Volatilities in Quant Insights Route**
   - **File**: `server/src/routes/insights.routes.js:252`
   - **Severity**: MEDIUM
   - **Occurrence**: `marketVolatilities: [0.18, 0.22, 0.28, 0.35]` hardcoded array instead of dynamic volatility calculations across all stock states in the engine.

7. **Currency Formatted in USD ($) instead of INR (₹)**
   - **Files**:
     - `client/src/pages/customer/MarketBrowseView.jsx:271,364`
     - `client/src/pages/customer/ProbabilityAnalysisView.jsx:141`
     - `client/src/pages/customer/CustomerDashboardView.jsx:174,278,353`
     - `client/src/pages/customer/CustomerAlertsView.jsx:156`
     - `client/src/pages/customer/CustomerPortfolioView.jsx:107,111,116,150,151,193,199,204`
     - `client/src/pages/company/CompanyDashboardView.jsx:127,134,141,228`
     - `client/src/pages/dashboard/CustomerDashboard.jsx:90,96,124,131`
     - `client/src/pages/dashboard/CompanyDashboard.jsx:46-49,69`
     - `client/src/pages/customer/StockDetailView.jsx:176`
   - **Severity**: HIGH (Direct constraint violation)
   - **Root Cause**: Ad-hoc template strings `$` instead of using `formatINR()` utility backed by `Intl.NumberFormat('en-IN')`.

---

### Category C: Mathematical Invariants Review

1. **Monte Carlo vs Closed-Form Invariants**:
   - `closedFormTerminalProb(S0, K, mu, sigma, T)` corresponds to $N(d_2)$ for $K \ge S_0$ and $N(-d_2)$ for $K < S_0$.
   - Tested tolerance: Monte Carlo terminal agrees with $N(d_2)$ within $\le 2\%$. (Verified in test suite)
   - Monte Carlo touch probability agrees with the closed-form reflection principle barrier formula within $\le 3\%$. (Verified in test suite)
   - Percentiles ($p_5 \le p_{25} \le p_{50} \le p_{75} \le p_{95}$) are strictly monotonic and anchor at $S_0$.
2. **Annualization & Granularity**:
   - $dt = 1 / (252 \times 390) = 1 / 98,280$.
   - Ticks are converted to days via `ticks / 390`, days to years via `days / 252`.
   - Returns estimation correctly uses log returns: $r_t = \ln(S_t / S_{t-1})$.

---

### Category D: Concurrency, Performance & Security

1. **Socket Rooms & Subscriptions**:
   - Client joined `market` room, but detailed stock subscription listeners `stock:tick` require per-stock rooms `stock:${id}`. `StockDetailView` needs to ensure `subscribe:stock` and `unsubscribe:stock` are cleaned up on unmount.
2. **Tick Loop Memory & Performance**:
   - The engine hot path `tick()` runs in memory without DB queries inside the loop.
   - Price ticks are buffered in `this.pendingTicks` and flushed asynchronously in batches every 10 ticks.
   - Retention policy enforces max 2,000 ticks per stock to prevent unconstrained MongoDB growth.
3. **Database Concurrency & Balance Integrity**:
   - Sequential trade execution using Mongoose checks `user.virtualBalance < totalCost`. To prevent race conditions on standalone mongod instances, conditional updates with `{ virtualBalance: { $gte: totalCost } }` guarantee balance never drops below zero.

---

## 3. Plan of Action (Phases 2 – 5)

1. **Phase 2 (Fixes)**:
   - Harmonize `market:tick` socket payload between server and client with `{ simTime, globalTick, stocks }`.
   - Harmonize portfolio response fields (`cash` & `cashBalance`, `totalValue` & `totalPortfolioValue`, `totalUnrealizedPnl`).
   - Fix `targetWatcher.js` to use observed parameter estimates.
   - Replace hardcoded `marketVolatilities` in `insights.routes.js` with live engine calculations.
2. **Phase 3 (Make Numbers Dynamic)**:
   - Eliminate all mock chart arrays and static fallbacks in customer and company dashboards.
   - Replace all `$` occurrences with `formatINR()` across all client pages.
3. **Phase 4 (Real-time Hardening)**:
   - Ensure complete cleanup of all socket listeners on unmount.
   - Verify store throttling and batching for 1-second ticks.
4. **Phase 5 (Verification & Evidence)**:
   - Run Vitest suite & build verification.
   - Capture end-to-end browser workflows with screenshots.
   - Generate mathematical validation proof table.
