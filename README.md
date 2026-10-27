# TradeSim • Real-Time Trading Simulation Web App

A high-performance real-time simulated trading platform built on the **MERN stack** (MongoDB, Express, React, Node.js) with Socket.io, pure deterministic financial mathematics, and a dark glassmorphism fintech design system.

---

## Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                                 BROWSER CLIENT                                    |
|                                                                                   |
|  +---------------------+   +-----------------------+   +-----------------------+  |
|  |    React Router     |   |   Redux Store         |   |    Socket Service     |  |
|  |  (App / Navigation) |   | (Buffered Reducer)    |   |  (Handshake, on/off)  |  |
|  +----------+----------+   +-----------+-----------+   +-----------+-----------+  |
|             |                          ^                           ^              |
|             v                          |                           |              |
|  +---------------------+               |                           |              |
|  |     Axios Client    |---------------+                           |              |
|  | (BaseURL, JWT auth) |                                           |              |
|  +----------+----------+                                           |              |
+-------------|------------------------------------------------------|--------------+
              | HTTP (REST)                                          | WebSocket
              | /api/*                                               | Socket.io
              v                                                      v
+-----------------------------------------------------------------------------------+
|                                  NODE.JS SERVER                                   |
|                                                                                   |
|  +---------------------+   +-----------------------+   +-----------------------+  |
|  |     Express App     |   |   Socket.io Server    |   |   Market Engine       |  |
|  | (Routes, Zod, Auth) |   | (Rooms: user, market) |   | (1s Tick Loop, GBM)   |  |
|  +----------+----------+   +-----------+-----------+   +-----------+-----------+  |
|             |                          ^                           |              |
|             +--------------------------+---------------------------+              |
|                                        |                                          |
|                                        v                                          |
|  +-----------------------------------------------------------------------------+  |
|  |                      Deterministic Math Pure Modules                        |  |
|  |   - gbmStep(): Geometric Brownian Motion with drift & volatility            |  |
|  |   - normalCdf() & normalPdf(): High-precision Abramowitz & Stegun           |  |
|  |   - calculateHittingProbability(): Analytical continuous target probability |  |
|  |   - calculateSharpeRatio() & calculateVaR95(): Portfolio risk analytics     |  |
|  |   - runWhatIfSimulation(): 10th-90th percentile equity corridors            |  |
|  +-------------------------------------+---------------------------------------+  |
|                                        |                                          |
|                                        v                                          |
|  +-----------------------------------------------------------------------------+  |
|  |                        MongoDB / MongoMemoryServer                          |  |
|  | (User, Stock, Order, Holding, Target, Notification - Zero External API)     |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

---

## Time Model (`/server/src/config/time.js`)

Single source of truth for all simulation calculations:
- `1 tick = 1 simulated trading minute`, emitted every 1 real second.
- `TICKS_PER_DAY = 390` (6.5 hour trading session: 9:15 AM to 3:45 PM).
- `DAYS_PER_YEAR = 252` trading days per year.
- `DT = 1 / (252 * 390)` years per tick ($1 / 98,280$ year units).
- `daysToTicks(days)` and `ticksToDays(ticks)` for exact deadline conversions.

---

## Monorepo Layout

```
TradeGrind/
├── server/
│   ├── src/
│   │   ├── config/        # time.js (time constants), db.js (Mongo/in-memory), seed.js
│   │   ├── models/        # User, Stock, Order, Holding, Target, Notification
│   │   ├── routes/        # auth, stock, order, portfolio, target, company
│   │   ├── controllers/   # Route handler controllers
│   │   ├── services/      # Business logic services
│   │   ├── middleware/    # JWT auth, role guard, central error handler
│   │   ├── math/          # gbm.js, normal.js, probability.js, statistics.js, simulation.js
│   │   │   └── __tests__/ # Vitest math unit tests (18 tests)
│   │   ├── sockets/       # Socket handlers & room controllers
│   │   ├── jobs/          # Periodic tasks & background jobs
│   │   ├── utils/         # Utility functions
│   │   ├── tests/         # Integration test suite
│   │   ├── engine/        # marketEngine.js (1-sec tick loop)
│   │   └── index.js       # Main server entrypoint (HTTP + Socket.io)
│   ├── .env.example       # MONGO_URI, JWT_SECRET, CLIENT_ORIGIN, PORT
│   └── package.json
├── client/
│   ├── src/
│   │   ├── components/    # Glassmorphism cards, Header, Sidebar, Modals, Portals
│   │   ├── services/      # apiClient.js (Axios), socketService.js (Socket.io)
│   │   ├── store/         # Redux Toolkit store (auth, market, portfolio, targets, alerts, company, ui)
│   │   ├── utils/         # INR currency & formatting utilities
│   │   ├── App.jsx        # React Router layout & view switching
│   │   ├── index.css      # Design token CSS & @fontsource/poppins imports
│   │   └── main.jsx       # BrowserRouter, Provider bootstrap
│   ├── .env.example       # VITE_API_URL, VITE_SOCKET_URL
│   ├── tailwind.config.js # Extended with design tokens (colors, radii, blur, Poppins)
│   └── package.json
├── package.json           # Root scripts: dev, test, seed
└── README.md
```

---

## How to Run

### 1. Install Dependencies
```bash
npm run install:all
```

### 2. Start Both Server and Client Concurrently
```bash
npm run dev
```
- Server: `http://localhost:5001`
- Client: `http://localhost:5173`
- Database: Automatically uses embedded MongoMemoryServer if local MongoDB is not running.

### 3. Run Math and Simulation Tests
```bash
npm test
```
Executes all 18 unit tests in `server/src/math/__tests__/math.test.js`.

### 4. Health Check
```bash
curl http://localhost:5001/api/health
```
Response:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "uptime": 12.4,
    "globalTick": 12
  }
}
```

---

## Demo Credentials

All seeded accounts share the default password: **`Password123!`**

### 🏢 Listed Companies (Permanently Available Demo Personas)
All accounts share the default password: **`Password123!`**

| Company Name | Ticker | Sector | Executive Persona | Login Email | Initial Price |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Infosys Limited** | `INFY` | IT | Infosys Executive | `ceo@infy.sim` | $1,720.80 |
| **Tata Consultancy Services** | `TCS` | IT | TCS Investor Relations | `ir@tcs.sim` | $3,875.00 |
| **HDFC Bank Ltd.** | `HDFCBANK` | Banking | HDFC Bank Treasury | `ir@hdfc.sim` | $1,640.25 |
| **ICICI Bank Ltd.** | `ICICIBANK` | Banking | ICICI Corporate Treasury | `corp@icici.sim` | $1,195.40 |
| **Reliance Industries** | `RELIANCE` | Energy | Reliance Industries IR | `corp@reliance.sim` | $2,980.50 |
| **NTPC Limited** | `NTPC` | Energy | NTPC Energy Desk | `ir@ntpc.sim` | $380.15 |
| **Sun Pharmaceutical** | `SUNPHARMA` | Pharma | Sun Pharma Exec | `corp@sunpharma.sim` | $1,650.00 |
| **Dr. Reddy's Labs** | `DRREDDY` | Pharma | Dr. Reddy Labs IR | `ir@drreddy.sim` | $6,540.00 |

### 👤 Retail Customers (Active Portfolios & Targets)
| Persona | Email | Password | Cash Balance | Seeded Holdings |
| :--- | :--- | :--- | :--- | :--- |
| **Demo Trader** | `trader@tradesim.in` | `Password123!` | $100,000.00 | INFY, RELIANCE |
| **Alex Quant** | `alex@tradesim.in` | `Password123!` | $150,000.00 | TCS, HDFCBANK |
| **Priya Sharma** | `priya@tradesim.in` | `Password123!` | $120,000.00 | INFY, RELIANCE |
| **David Miller** | `david@tradesim.in` | `Password123!` | $80,000.00 | TCS, HDFCBANK |
| **Elena Rostova** | `elena@tradesim.in` | `Password123!` | $200,000.00 | INFY, RELIANCE |

---

## Quickstart (Zero Configuration)

```bash
# 1. Install all dependencies across monorepo
npm run install:all

# 2. Seed database (12 stocks, 252 backfilled candles, 8 accounts, targets, alerts)
npm run seed

# 3. Start full stack concurrently
npm run dev

# 4. Run full test suite (113/113 passing unit & integration tests)
npm test

# 5. Run mathematical validation CLI report (Closed-Form vs Monte Carlo)
npm run validate:math --prefix server
```

- **Client**: `http://localhost:5173`
- **Server API**: `http://localhost:5001`
- **Methodology Page**: Accessible directly at `/methodology` or via the sidebar in-app.
- **5-Minute Live Demo Walkthrough**: See [`DEMO.md`](./DEMO.md) for full step-by-step instructions.

