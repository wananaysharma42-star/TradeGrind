# TradeSim • 5-Minute Live Demo Script

**Role Focus:** Dual-Persona Quantitative Platform (Retail Investor + Corporate Treasurer / IR)  
**Aesthetic:** Dark mauve-glass (`#0B0709`, frosted glassmorphism, 24px borders)  
**Core Math Engine:** Geometric Brownian Motion (GBM), Abramowitz-Stegun $N(d_2)$, First-Touch Barrier Reflection, EWMA Volatility ($\lambda=0.94$), and Monte Carlo Simulations.

---

## Pre-Flight Check (15 Seconds)
1. Terminal 1: Run seed and start server & client:
   ```bash
   npm run seed
   npm run dev
   ```
2. Open browser at `http://localhost:5173`.

---

## Demo Timeline (5 Minutes)

### Minute 0:00 – 1:15 • Retail Customer Journey (Live Math & Trading)
1. **Login as Retail Customer**:
   - Navigate to `/login`
   - Select **Customer**: `trader@tradesim.in` / `Password123!`
   - **What to say:** *"TradeSim is an institutional-grade trading simulator where asset prices move every 1000 ms via pure Geometric Brownian Motion with drift $\mu$ and volatility $\sigma$."*
2. **Dashboard Overview**:
   - Point out **Total Holding** flashing on live `portfolio:update` socket events.
   - Click **Explore Quant Insights** on the glowing promo card to show deterministic algorithmic signals (Momentum, Mean Reversion, RSI, Bollinger Bands).
   - Hover over the **Rotating Detailed Analytics** strip and show it pause.
3. **Execute a Real Trade**:
   - Go to **Market** (`/market`), click **Trade** on `INFY` or `RELIANCE`.
   - Enter `10` shares. Note the estimated fee (0.05%) and cash balance validation.
   - Click **Execute Buy Order**. Instantly observe the live toast and portfolio equity balance update.

---

### Minute 1:15 – 2:30 • Probability Target & What-If Heatmap
1. **Navigate to Analysis (`/analysis`)**:
   - Select **Stock:** `INFY`, **Target:** `$1,850.00`, **Deadline:** `30 Days`, **Mode:** `Touch (First-Hit Barrier)`.
   - Click **Evaluate Probability**.
2. **What to say about the Maths:**
   - *"Unlike heuristic AI models, TradeSim computes exact closed-form probabilities using the reflection principle for Brownian motion with drift: $P(\tau_K \le T) = N\left(\frac{-b+\nu T}{\sigma\sqrt{T}}\right) + e^{\frac{2\nu b}{\sigma^2}} N\left(\frac{-b-\nu T}{\sigma\sqrt{T}}\right)$."*
   - Show the **Probability Gauge** with its 95% Wilson Score Confidence Interval.
   - Expand the **"How this was calculated"** accordion to show the parameter estimation ($\sigma$ blended 50/50 between sample and EWMA $\lambda=0.94$).
   - Drag the **WHAT-IF Sliders** (target price and deadline) to see the 2D probability **Heatmap** recalculate in real time (< 200 ms).

---

### Minute 2:30 – 3:30 • Real-Time Alert Engine & Edge Triggers
1. **Configure an Alert (`/alerts`)**:
   - Build a rule: Type: `PCT_CHANGE`, Threshold: `2.0%`.
   - Highlight the **Live Backtest Counter**: *"Would have fired 7 times in the last 30 simulated days"*.
   - Click **Create Alert Rule**.
2. **Trigger a Live Market Shock (Dev Tooling)**:
   - In a terminal or curl:
     ```bash
     curl -X POST http://localhost:5001/api/dev/shock \
       -H "Content-Type: application/json" \
       -d '{"stockId": "INFY", "pct": 0.04}'
     ```
   - Watch the live stock ticker jump on the next tick, edge-triggering the alert and delivering a real-time toast notification via WebSocket `notification:new`.

---

### Minute 3:30 – 4:30 • Company Role & Testing Environment
1. **Switch to Listed Company**:
   - Click **Logout**, log in as **Company**: `ceo@infy.sim` / `Password123!`
   - Show the company dashboard scoped to `INFY`:
     - Sector Rank & Overall Rank with score breakdown tooltip (Momentum 35%, Sharpe 25%, Drawdown 20%, Volatility 20%).
     - Last 10 Days Insights table with inline polarity mini bars.
2. **Profit Analytics (`/company/analytics`)**:
   - Show the **Rebased-to-100 Performance Chart** with the peer overlay chips (`TCS`, `WIPRO`) and brush zoom slider.
3. **Testing Environment (`/company/testing`)**:
   - Set horizon to 30 days, volatility multiplier to `1.5x`, add a discrete shock: Day 5, `-15%`.
   - Set feasibility gates: Max Drawdown `25%`, Min Target Probability `30%`.
   - Click **Run Scenario**.
   - **What to say:** *"The engine runs 3,000 Monte Carlo paths with discrete jump injections, displaying the percentile distribution cone (p5 through p95), terminal expected return, and automated FEASIBLE/BREACH compliance badges."*

---

### Minute 4:30 – 5:00 • In-App Methodology & Wrap-up
1. **Click "Methodology" in the Sidebar (`/methodology`)**:
   - Walk through the verified mathematical formulas:
     - Geometric Brownian Motion SDE
     - Abramowitz-Stegun $N(d_2)$
     - Reflection Principle First Hitting Time
     - EWMA Volatility ($\lambda=0.94$)
     - Value at Risk (VaR) & CVaR (Expected Shortfall)
     - Sharpe & Sortino ratios
     - Composite Scoring weights
2. **Key Takeaway:** TradeSim bridges high-end financial mathematics with real-time reactive UX.
