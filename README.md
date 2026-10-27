# TradeGrind • Quantitative Trading & Simulation Platform

A real-time, deterministic financial trading and risk modeling platform built on the **MERN Stack** (MongoDB, Express, React, Node.js) with **Socket.io**, closed-form stochastic calculus, and an institutional dark-glassmorphism interface.

---

## 1. Problem Statement
Retail investors and corporate treasurers frequently make critical financial decisions based on heuristic guesses, delayed market data, or black-box predictive models that provide zero mathematical transparency. 
- **Retail investors** lack access to real-time risk evaluation tools (such as continuous first-touch barrier probabilities, Value-at-Risk, and Sharpe ratios) without paying for institutional terminals like Bloomberg or FactSet.
- **Corporate issuers and investor relations teams** have no sandbox to stress-test their equity under macroeconomic shocks, shifts in drift ($\mu$), or volatility spikes ($\sigma$), nor can they monitor their retail investor base dynamically.

**TradeGrind** solves this by delivering an accessible, zero-cost, 100% deterministic simulation engine where asset prices advance second-by-second using pure stochastic processes (Geometric Brownian Motion), closed-form probability solutions, and automated risk scoring—with zero external API dependencies or opaque heuristics.

---

## 2. Target Users
1. **Retail Traders & Quantitative Students (`CUSTOMER` role)**:
   - Users seeking to master algorithmic trading and derivatives logic in an institutional simulation environment.
   - Users who want to set price targets backed by mathematically rigorous success probabilities rather than subjective chart opinions.
   - Virtual portfolio tracking initialized with ₹10,00,000 in virtual funds.
2. **Corporate Treasurers & Investor Relations Officers (`COMPANY` role)**:
   - Executives managing a listed stock who require real-time shareholder breakdown and order flow telemetry.
   - Quantitative risk officers who run "what-if" stress-testing corridors (3,000 Monte Carlo paths) to evaluate feasibility under market shocks.

---

## 3. Solution
TradeGrind implements a dual-persona reactive web architecture:
- **Simulated Real-Time Market**: A server-side tick loop advancing every 1,000 ms, emitting Geometric Brownian Motion price updates with real-time volatility clustering.
- **Deterministic Mathematical Intelligence**: Closed-form terminal and first-passage hitting probabilities derived from the reflection principle for Brownian motion with drift, validated against 10,000-path Monte Carlo simulations.
- **Enterprise-Grade Session Security**: 15-day persistent cookie authentication (`tradegrind_token` with `HttpOnly` and `SameSite=Lax`), automatic session rehydration, and strict public/protected route guards.
- **Zero External API Failure Mode**: Self-contained market generation, persistent seed backfill of 252 daily candles per stock, and zero reliance on third-party rate limits.

---

## 4. Key Workflows (Core Application Logic)

### Workflow 1: Live Market Execution & Instant Portfolio Rebalancing
- **Action**: A customer browses real-time streaming stocks, opens an order modal, and executes a BUY or SELL order.
- **Logic**:
  - Validates cash balance against `shares * price + 0.05% fee`.
  - Atomically records transaction in `Order`, updates or creates `Holding` with weighted average cost basis (`avgBuyPrice`), and deducts cash.
  - Broadcasts `portfolio:update` via Socket.io.
  - Client Redux store immediately computes unrealized P&L, portfolio weightings, and updates the reactive equity chart.

### Workflow 2: Closed-Form Probability Evaluation & 2D Parameter Heatmaps
- **Action**: Customer enters target price ($K$) and deadline ($T$) for an asset.
- **Logic**:
  - The engine estimates annualized volatility ($\sigma$) blended 50/50 between 30-day historical log-returns and EWMA ($\lambda=0.94$).
  - Computes exact continuous first-touch probability via the reflection principle:
    $$P(\tau_K \le T) = N\left(\frac{-b+\nu T}{\sigma\sqrt{T}}\right) + e^{\frac{2\nu b}{\sigma^2}} N\left(\frac{-b-\nu T}{\sigma\sqrt{T}}\right)$$
  - Evaluates standard normal CDF $N(x)$ via high-precision Abramowitz & Stegun 7.1.26 polynomial approximation ($|\epsilon(x)| < 1.5 \times 10^{-7}$).
  - Live What-If sliders dynamically recalculate a $5 \times 5$ target/deadline probability matrix in $< 50$ ms.

### Workflow 3: Edge-Triggered Alert Engine & Backtest Validation
- **Action**: User defines custom price thresholds (`ABSOLUTE`, `PCT_CHANGE`, or `TARGET_PROBABILITY`).
- **Logic**:
  - **Live Backtester**: Before creating the alert, the engine scans the previous 30 daily candles and reports how many times the rule would have triggered.
  - **Edge-Trigger State Machine**: Evaluated inside the 1-second market tick. State only flips when an edge crossing occurs (prevents notification spam).
  - Emits `notification:new` to the client with audio-visual glass toasts.

### Workflow 4: Corporate Issuer Testing Environment & 3,000-Path Monte Carlo Stress Testing
- **Action**: Company executive adjusts drift delta ($\Delta\mu$), volatility multiplier ($k_\sigma$), and injects discrete percentage shocks on specific simulation days.
- **Logic**:
  - Generates 3,000 discrete Geometric Brownian Motion paths using Box-Muller transforms.
  - Computes 5th, 25th, 50th, 75th, and 95th percentile confidence corridors across the scenario horizon.
  - Automatically assesses institutional feasibility gates: Maximum Drawdown $\le 25\%$ and Breach Probability $\le 30\%$, outputting clear compliance badges.

### Workflow 5: 15-Day Cookie Authentication & Route Guarding
- **Action**: User logs in or registers as Customer or Company.
- **Logic**:
  - Issues signed JWT token persisted in `tradegrind_token` cookie with 15-day expiry (`maxAge: 1,296,000,000 ms`).
  - **Route Protection**: Public routes (`/`, `/login`, `/register`) detect active session and automatically redirect authenticated users to their respective workspace (`/dashboard` or `/company`).
  - Unauthenticated access to private views immediately redirects to `/login`.
  - Logout cleanly invalidates cookies on both server and client.

---

## 5. Technology Stack

| Layer | Technology | Engineering Rationale |
| :--- | :--- | :--- |
| **Frontend Framework** | React 18, Vite | Lightning-fast build times, modular component hierarchy, fast hot module replacement. |
| **State Management** | Redux Toolkit | Centralized state with buffered reducers handling 1 Hz socket streams without render thrashing. |
| **Styling & Theme** | Tailwind CSS, Lucide React | Curated Amber Gold private-banking glassmorphism theme (`#0C0A07` deep obsidian canvas, `#17130C` glass cards, `#F5B93B` gold accents, semantic `#4ADE80` gain and `#F87171` loss indicators). |
| **Data Visualization** | Recharts | Canvas/SVG accelerated rendering of multi-line fan charts, candlestick data, and probability gauges. |
| **Backend Runtime** | Node.js (ES Modules), Express | Asynchronous event loop optimized for real-time web socket dispatch and REST endpoints. |
| **Real-Time Layer** | Socket.io | Bi-directional WebSocket communication with room segregation (`user:<id>`, `stock:<symbol>`). |
| **Database & ODM** | MongoDB, Mongoose | Flexible document model for real-time portfolio holdings, candle history, and notification logs. |
| **Testing** | Vitest | Comprehensive automated test suite with 114 unit, integration, and E2E tests. |

---

## 6. Architecture & System Design

```
+-----------------------------------------------------------------------------------+
|                                 BROWSER CLIENT                                    |
|                                                                                   |
|  +---------------------+   +-----------------------+   +-----------------------+  |
|  |    React Router     |   |   Redux Store         |   |    Socket Service     |  |
|  |  (Public/Protected) |   | (Buffered Reducer)    |   |  (Handshake, on/off)  |  |
|  +----------+----------+   +-----------+-----------+   +-----------+-----------+  |
|             |                          ^                           ^              |
|             v                          |                           |              |
|  +---------------------+               |                           |              |
|  |  API Client (Fetch) |---------------+                           |              |
|  | (15-Day Cookie Auth)|                                           |              |
|  +----------+----------+                                           |              |
+-------------|------------------------------------------------------|--------------+
              | HTTP (REST)                                          | WebSocket
              | /api/* (Port 8009)                                   | Socket.io (Port 8009)
              v                                                      v
+-----------------------------------------------------------------------------------+
|                            NODE.JS SERVER (PORT 8009)                             |
|                                                                                   |
|  +---------------------+   +-----------------------+   +-----------------------+  |
|  |   Express Router    |   |   Socket.io Server    |   |   Market Engine       |  |
|  | (JWT Auth, Cookies) |   | (Rooms: user, stock)  |   | (1s Tick Loop, GBM)   |  |
|  +----------+----------+   +-----------+-----------+   +-----------+-----------+  |
|             |                          ^                           |              |
|             +--------------------------+---------------------------+              |
|                                        |                                          |
|                                        v                                          |
|  +-----------------------------------------------------------------------------+  |
|  |                   Deterministic Mathematical Pure Modules                   |  |
|  |   - gbmStep(): Geometric Brownian Motion with drift & volatility            |  |
|  |   - normalCdf() & normalPdf(): Abramowitz & Stegun polynomial (7.1.26)       |  |
|  |   - closedFormTouchProb(): Analytical reflection principle probability      |  |
|  |   - calculateSharpeRatio() & calculateVaR95(): Risk analytics               |  |
|  |   - monteCarloSimulate(): 3,000-path corridor simulation                    |  |
|  +-------------------------------------+---------------------------------------+  |
|                                        |                                          |
|                                        v                                          |
|  +-----------------------------------------------------------------------------+  |
|  |                            MongoDB Database                                 |  |
|  | (Users, Stocks, Holdings, Orders, Targets, Notifications, DailyCandles)    |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

---

## 7. Local Setup Instructions

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **MongoDB**: Local MongoDB instance (`mongodb://127.0.0.1:27017/tradegrind`) or MongoDB Atlas connection string.

### Step 1: Clone the Repository
```bash
git clone https://github.com/mrinal1224/Social-Media-A-2029.git
cd Social-Media-A-2029
```

### Step 2: Install Dependencies
```bash
npm run install:all
```
*Installs dependencies across the root, `server/`, and `client/` workspaces.*

### Step 3: Configure Environment Variables
Copy the example files:
```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```
*(Defaults are pre-configured to `PORT=8009` and `http://localhost:8009`)*.

### Step 4: Seed the Database
Populates 12 stocks, 252 backfilled daily candles per stock, corporate accounts, and demo trader portfolios:
```bash
npm run seed
```

### Step 5: Start the Development Server
```bash
npm run dev
```
- **Frontend Client**: `http://localhost:5173`
- **Backend API & WebSockets**: `http://localhost:8009`

### Step 6: Verify Test Suite
Run all 114 automated unit, integration, and mathematical proof tests:
```bash
npm test
```

---

## 8. Environment Variables

### Server (`server/.env`)
```env
PORT=8009
MONGO_URI=mongodb://127.0.0.1:27017/tradegrind
JWT_SECRET=tradegrind_super_secret_jwt_key_2026
CLIENT_ORIGIN=http://localhost:5173
NODE_ENV=development
```

### Client (`client/.env`)
```env
VITE_API_URL=http://localhost:8009
VITE_SOCKET_URL=http://localhost:8009
```

---

## 9. Pre-Seeded Demo Credentials

All seeded accounts use password: **`Password123!`** (also accessible via one-click persona buttons on `/login`).

### 👤 Retail Customer Accounts
| Persona | Email | Virtual Cash | Seeded Holdings |
| :--- | :--- | :--- | :--- |
| **Demo Trader** | `trader@tradegrind.in` | ₹10,00,000 | INFY, RELIANCE |
| **Alex Quant** | `alex@tradegrind.in` | ₹1,50,000 | TCS, HDFCBANK |
| **Priya Sharma** | `priya@tradegrind.in` | ₹1,20,000 | INFY, RELIANCE |
| **David Miller** | `david@tradegrind.in` | ₹80,000 | TCS, HDFCBANK |
| **Elena Rostova** | `elena@tradegrind.in` | ₹2,00,000 | INFY, RELIANCE |

### 🏢 Listed Corporate Accounts
| Company Name | Ticker | Sector | Login Email | Initial Price |
| :--- | :--- | :--- | :--- | :--- |
| **Infosys Limited** | `INFY` | IT | `ceo@infy.sim` | ₹1,720.80 |
| **Tata Consultancy Services** | `TCS` | IT | `ir@tcs.sim` | ₹3,875.00 |
| **HDFC Bank Ltd.** | `HDFCBANK` | Banking | `ir@hdfc.sim` | ₹1,640.25 |
| **Reliance Industries** | `RELIANCE` | Energy | `corp@reliance.sim` | ₹2,980.50 |

---

## 10. Official Submission Details (Section 20)

```text
Project Name:
TradeGrind • Real-Time Quantitative Trading & Simulation Platform

Student Name:
Ananay Sharma

Problem Statement:
Democratizing institutional financial simulation and quantitative risk modeling by providing a zero-cost, transparent, 100% deterministic platform with real-time Geometric Brownian Motion market dynamics, closed-form barrier probability engines, and corporate what-if stress-testing—without relying on black-box heuristics or external APIs.

GitHub Repository:
https://github.com/mrinal1224/Social-Media-A-2029

Deployed Application / Build:
http://localhost:5173 (Local distribution with embedded one-command setup via `npm run dev`)

Demo Video:
[Insert Demo Video Link - see DEMO.md for presentation script]

Tech Stack:
MongoDB, Express.js, React 18, Node.js (MERN), Socket.io, Redux Toolkit, Tailwind CSS, Recharts, Vitest

Major Features:
1. Real-time Geometric Brownian Motion market engine emitting streaming ticks every 1,000 ms.
2. Closed-form hitting & terminal probability calculators using reflection principle and Abramowitz-Stegun polynomial approximation.
3. Live 2D What-If Target/Deadline probability heatmaps recalculating in under 50 ms.
4. Corporate issuer sandbox with 3,000-path Monte Carlo stress-testing, custom shock injections, and feasibility checks.
5. 15-day persistent HttpOnly cookie authentication with strict public and protected route guarding.
```

---

## 11. Verification & Test Metrics
- **Automated Tests**: 114 / 114 passing (`vitest`) across 10 test files.
- **Client Build**: Clean exit 0 via `vite build` with zero compilation errors.
- **Mathematical Accuracy**: Validated closed-form probability solutions match Monte Carlo empirical hitting frequencies within $2\%$ error margins across all parameters.
- **Zero Secrets**: Checked and verified zero secrets committed to version control.
