# TradeGrind • 3–5 Minute Video Demonstration Script

> **Evaluator Guideline Focus (Section 14):**
> 1. The problem being solved
> 2. Who the product is for
> 3. The major workflows
> 4. The most interesting functionality
> 5. The final working application (show the product working, do not spend time reading raw code)

---

## 🎬 Video Recording Cheat Sheet
- **Target Duration:** 3:30 to 4:30 minutes.
- **Resolution:** 1080p (Full Screen browser window).
- **Setup:** Ensure both server and client are running (`npm run dev`) at `http://localhost:5173`.
- **Pre-seeded state:** Clear cookies or open an Incognito browser window to showcase the clean landing page and login flow.

---

## ⏱️ Minute-by-Minute Script

### 🕒 Part 1: Problem & Product Overview (0:00 – 0:45)
- **On Screen:** Start on the landing page (`http://localhost:5173/`).
- **What to Say:**
  > *"Hello! This is **TradeGrind**, an institutional-grade quantitative trading and risk simulation platform built on the MERN stack with Socket.io and pure stochastic mathematics.*
  >
  > *Most retail trading platforms either use static delayed data or black-box predictive heuristics that give users zero mathematical understanding of their true risk. Meanwhile, corporate issuers have no interactive sandbox to stress-test their equity under macroeconomic shocks.*
  >
  > *TradeGrind solves this by delivering a completely self-contained, 100% deterministic simulation engine where prices move second-by-second via Geometric Brownian Motion, and risk metrics are evaluated using exact closed-form calculus—with zero external APIs or AI guesswork."*

---

### 🕒 Part 2: Persona 1 - Retail Customer Workflow (0:45 – 2:00)
- **Action 1:** Click **Sign In** or **Get Started** to go to `/login`.
- **Action 2:** Click the one-click demo persona **Retail Trader** (`trader@tradegrind.in` / `Password123!`). Click **Sign In**.
- **What to Say:**
  > *"TradeGrind features a dual-persona architecture. First, let's explore the Retail Customer workflow. We authenticate using a secure 15-day persistent HttpOnly cookie with automated route protection.*
  >
  > *Here on the Customer Dashboard, notice the live market ticker advancing every 1,000 milliseconds. Every price movement is calculated in real time using Geometric Brownian Motion with annualized drift $\mu$ and volatility $\sigma$.*
  >
  > *Our portfolio equity, cash balance, and P&L update reactively via bi-directional WebSockets without page refreshes."*
- **Action 3:** Navigate to **Market** (`/market`). Click **Trade** on `INFY` or `RELIANCE`.
- **Action 4:** Enter `10` shares in the Quick Trade modal. Click **Execute Buy Order**.
- **What to Say:**
  > *"When we execute a trade, the engine atomically checks our ₹10,00,000 virtual balance, calculates a realistic 0.05% brokerage fee, records the order, and rebalances our holdings with real-time weighted average cost basis."*

---

### 🕒 Part 3: Most Interesting Feature - Closed-Form Probability & Heatmaps (2:00 – 3:00)
- **Action 1:** Navigate to **Analysis** (`/analysis`) in the sidebar.
- **Action 2:** Select **Stock:** `INFY`, **Target Price:** `₹1,850`, **Deadline:** `30 Days`, and **Mode:** `Touch (First-Hit Barrier)`. Click **Evaluate Probability**.
- **What to Say:**
  > *"Here is the most technically interesting feature of TradeGrind: the Analytical Target Probability Engine.*
  >
  > *Instead of guessing with AI or running slow simulations, TradeGrind uses the exact closed-form reflection principle for Brownian motion with drift. It estimates volatility by blending 30-day historical returns with EWMA ($\lambda=0.94$), and evaluates the standard normal CDF using the Abramowitz-Stegun polynomial approximation.*
  >
  > *Look at the 2D What-If Heatmap below: as I drag the target price and deadline sliders, the entire matrix recalculates in under 50 milliseconds directly against the backend math engine."*
- **Action 3:** Show the **What-If Sliders** and watch the probability gauge and heatmap smoothly update.

---

### 🕒 Part 4: Edge-Triggered Alerts & Rule Backtesting (3:00 – 3:30)
- **Action 1:** Navigate to **Alerts** (`/alerts`).
- **Action 2:** Click **Create Alert Rule**. Pick `Percentage Change`, threshold `2.5%`.
- **What to Say:**
  > *"In the Alerts module, users can set custom triggers based on price jumps or probability thresholds. Notice our historical backtest indicator: before even creating the rule, the engine evaluates the last 30 daily sessions and tells us how many times this condition would have triggered.*
  >
  > *Alerts use an edge-triggered state machine so you are only notified when a threshold crossing occurs, preventing alert fatigue."*

---

### 🕒 Part 5: Persona 2 - Corporate Issuer & Stress-Testing Sandbox (3:30 – 4:15)
- **Action 1:** Click **Logout** at the bottom of the sidebar.
- **Action 2:** On `/login`, click one-click company persona **Infosys** (`ceo@infy.sim` / `Password123!`). Click **Sign In**.
- **What to Say:**
  > *"Now let's switch to our second persona: Listed Corporate Issuer. A company executive only sees telemetry scoped to their own stock—in this case, INFY.*
  >
  > *They can see composite competitive rankings, top shareholder distributions, and historical volume trends."*
- **Action 3:** Navigate to **Testing** (`/company/testing`).
- **Action 4:** Adjust the horizon to `30 Days`, Volatility Multiplier to `1.5x`, add a Discrete Shock of `-10%` on Day 5, and click **Run Scenario**.
- **What to Say:**
  > *"In the Testing Environment, corporate officers can stress-test their equity. The server spins up 3,000 Monte Carlo paths with discrete jump injections, displaying the 5th through 95th percentile confidence cone, terminal expected value, and automated feasibility checks against maximum drawdown gates."*

---

### 🕒 Part 6: In-App Methodology & Conclusion (4:15 – 4:30)
- **Action 1:** Click **Methodology** in the sidebar (`/company/methodology` or `/methodology`).
- **What to Say:**
  > *"Finally, every formula powering TradeGrind—from Geometric Brownian Motion to the Sharpe and Sortino ratios—is openly documented and proven in our Methodology view and backed by 114 passing Vitest tests.*
  >
  > *TradeGrind delivers a complete, reliable, and mathematically sound trading platform ready for real users. Thank you!"*

---

## ✅ Recording Checklist Before You Click Submit:
- [ ] Voice is clear and audible.
- [ ] Video duration is between 3 and 5 minutes.
- [ ] Video URL is uploaded to YouTube (Unlisted or Public) or Google Drive (with access set to "Anyone with the link can view").
- [ ] Test the video link in an Incognito window before pasting into the submission form!
