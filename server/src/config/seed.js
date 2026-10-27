import bcrypt from 'bcrypt';
import { User } from '../models/User.js';
import { Stock } from '../models/Stock.js';
import { Holding } from '../models/Holding.js';
import { DailyCandle } from '../models/DailyCandle.js';
import { Transaction } from '../models/Transaction.js';
import { PortfolioSnapshot } from '../models/PortfolioSnapshot.js';
import { Target } from '../models/Target.js';
import { AlertRule } from '../models/AlertRule.js';
import { Watchlist } from '../models/Watchlist.js';
import { TIME_CONFIG } from './time.js';

/**
 * 12 stocks across 4 sectors with realistic mu and sigma:
 * - IT: TCS, INFY, WIPRO
 * - Banking: HDFCBANK, ICICIBANK, KOTAKBANK
 * - Energy: RELIANCE, ONGC, NTPC
 * - Pharma: SUNPHARMA, DRREDDY, CIPLA
 */
export const INITIAL_STOCKS = [
  // IT
  {
    symbol: 'TCS',
    companyName: 'Tata Consultancy Services',
    sector: 'IT',
    initialPrice: 3875.00,
    mu: 0.12,
    sigma: 0.18,
    sharesOutstanding: 3610000000
  },
  {
    symbol: 'INFY',
    companyName: 'Infosys Limited',
    sector: 'IT',
    initialPrice: 1720.80,
    mu: 0.11,
    sigma: 0.23,
    sharesOutstanding: 4150000000
  },
  {
    symbol: 'WIPRO',
    companyName: 'Wipro Limited',
    sector: 'IT',
    initialPrice: 535.20,
    mu: 0.10,
    sigma: 0.24,
    sharesOutstanding: 5220000000
  },
  // Banking
  {
    symbol: 'HDFCBANK',
    companyName: 'HDFC Bank Ltd.',
    sector: 'Banking',
    initialPrice: 1640.25,
    mu: 0.13,
    sigma: 0.19,
    sharesOutstanding: 7600000000
  },
  {
    symbol: 'ICICIBANK',
    companyName: 'ICICI Bank Ltd.',
    sector: 'Banking',
    initialPrice: 1195.40,
    mu: 0.16,
    sigma: 0.21,
    sharesOutstanding: 7040000000
  },
  {
    symbol: 'KOTAKBANK',
    companyName: 'Kotak Mahindra Bank',
    sector: 'Banking',
    initialPrice: 1780.00,
    mu: 0.12,
    sigma: 0.20,
    sharesOutstanding: 1980000000
  },
  // Energy
  {
    symbol: 'RELIANCE',
    companyName: 'Reliance Industries Ltd.',
    sector: 'Energy',
    initialPrice: 2980.50,
    mu: 0.14,
    sigma: 0.22,
    sharesOutstanding: 6760000000
  },
  {
    symbol: 'ONGC',
    companyName: 'Oil & Natural Gas Corp',
    sector: 'Energy',
    initialPrice: 265.40,
    mu: 0.09,
    sigma: 0.28,
    sharesOutstanding: 12580000000
  },
  {
    symbol: 'NTPC',
    companyName: 'NTPC Limited',
    sector: 'Energy',
    initialPrice: 380.15,
    mu: 0.15,
    sigma: 0.20,
    sharesOutstanding: 9690000000
  },
  // Pharma
  {
    symbol: 'SUNPHARMA',
    companyName: 'Sun Pharmaceutical Ind.',
    sector: 'Pharma',
    initialPrice: 1650.00,
    mu: 0.16,
    sigma: 0.22,
    sharesOutstanding: 2390000000
  },
  {
    symbol: 'DRREDDY',
    companyName: "Dr. Reddy's Laboratories",
    sector: 'Pharma',
    initialPrice: 6540.00,
    mu: 0.13,
    sigma: 0.24,
    sharesOutstanding: 167000000
  },
  {
    symbol: 'CIPLA',
    companyName: 'Cipla Limited',
    sector: 'Pharma',
    initialPrice: 1480.00,
    mu: 0.14,
    sigma: 0.21,
    sharesOutstanding: 807000000
  }
];

export async function seedDatabase() {
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('Password123!', salt);

  // 1. Seed or Upsert Stocks
  const stockMap = new Map();
  for (const item of INITIAL_STOCKS) {
    let stock = await Stock.findOne({ symbol: item.symbol });
    if (!stock) {
      stock = await Stock.create({
        ...item,
        name: item.companyName,
        totalShares: item.sharesOutstanding,
        currentPrice: item.initialPrice,
        previousClose: Math.round(item.initialPrice * 0.995 * 100) / 100,
        dayHigh: item.initialPrice,
        dayLow: item.initialPrice,
        volume: 1250000,
        priceHistory: [{
          tick: 0,
          price: item.initialPrice,
          volume: 2500,
          timestamp: new Date()
        }],
        tickCount: 0,
        viewCount: 10
      });
    }
    stockMap.set(item.symbol, stock);
  }

  // 2. Backfill 1 Year (252 Trading Days) of Daily Candles for all 12 stocks
  const daysCount = 252;
  const candleCount = await DailyCandle.countDocuments();
  if (candleCount < INITIAL_STOCKS.length * 100) {
    console.log(`[Seed] Backfilling 1 year (252 trading days) of DailyCandles for ${INITIAL_STOCKS.length} stocks...`);
    const candleOps = [];

    for (const [sym, stock] of stockMap.entries()) {
      let S = stock.initialPrice * 0.85; // start lower 1 year ago
      const dt = 1 / 252;
      const drift = (stock.mu - 0.5 * stock.sigma * stock.sigma) * dt;
      const diffusion = stock.sigma * Math.sqrt(dt);

      for (let day = 1; day <= daysCount; day++) {
        const Z = (Math.random() + Math.random() + Math.random() + Math.random() - 2) * 1.732; // Gaussian approx
        const open = S;
        const close = Math.round(open * Math.exp(drift + diffusion * Z) * 100) / 100;
        const high = Math.round(Math.max(open, close) * (1 + Math.random() * 0.012) * 100) / 100;
        const low = Math.round(Math.min(open, close) * (1 - Math.random() * 0.012) * 100) / 100;
        const volume = Math.floor(250000 + Math.random() * 1500000);
        const logRet = Math.log(close / open);

        candleOps.push({
          updateOne: {
            filter: { stockId: stock._id, simDay: day },
            update: {
              $set: {
                open,
                high,
                low,
                close,
                volume,
                logReturn: logRet
              }
            },
            upsert: true
          }
        });

        S = close;
      }
    }

    if (candleOps.length > 0) {
      await DailyCandle.bulkWrite(candleOps);
      console.log(`[Seed] Upserted ${candleOps.length} DailyCandles successfully.`);
    }
  }

  // 3. Seed COMPANY Users linked to stocks across all sectors
  const companyDefs = [
    { name: 'Infosys Executive', email: 'ceo@infy.sim', companyName: 'Infosys Limited', sector: 'IT', symbol: 'INFY' },
    { name: 'TCS Investor Relations', email: 'ir@tcs.sim', companyName: 'Tata Consultancy Services', sector: 'IT', symbol: 'TCS' },
    { name: 'HDFC Bank Treasury', email: 'ir@hdfc.sim', companyName: 'HDFC Bank Ltd.', sector: 'Banking', symbol: 'HDFCBANK' },
    { name: 'ICICI Corporate Treasury', email: 'corp@icici.sim', companyName: 'ICICI Bank Ltd.', sector: 'Banking', symbol: 'ICICIBANK' },
    { name: 'Reliance Industries IR', email: 'corp@reliance.sim', companyName: 'Reliance Industries Ltd.', sector: 'Energy', symbol: 'RELIANCE' },
    { name: 'NTPC Energy Desk', email: 'ir@ntpc.sim', companyName: 'NTPC Limited', sector: 'Energy', symbol: 'NTPC' },
    { name: 'Sun Pharma Exec', email: 'corp@sunpharma.sim', companyName: 'Sun Pharmaceutical Ind.', sector: 'Pharma', symbol: 'SUNPHARMA' },
    { name: 'Dr. Reddy Labs IR', email: 'ir@drreddy.sim', companyName: "Dr. Reddy's Laboratories", sector: 'Pharma', symbol: 'DRREDDY' }
  ];

  for (const c of companyDefs) {
    const stock = stockMap.get(c.symbol);
    let compUser = await User.findOne({ email: c.email.toLowerCase() });
    if (!compUser) {
      compUser = await User.create({
        name: c.name,
        email: c.email.toLowerCase(),
        passwordHash,
        role: 'COMPANY',
        companyName: c.companyName,
        sector: c.sector,
        stockId: stock?._id
      });
    }
    if (stock && (!stock.ownerCompany || String(stock.ownerCompany) !== String(compUser._id))) {
      stock.ownerCompany = compUser._id;
      await stock.save();
    }
  }

  // 4. Seed 5 CUSTOMER Users
  const customerDefs = [
    { name: 'Demo Trader', email: 'trader@tradesim.in', balance: 100000 },
    { name: 'Alex Quant', email: 'alex@tradesim.in', balance: 150000 },
    { name: 'Priya Sharma', email: 'priya@tradesim.in', balance: 120000 },
    { name: 'David Miller', email: 'david@tradesim.in', balance: 80000 },
    { name: 'Elena Rostova', email: 'elena@tradesim.in', balance: 200000 }
  ];

  const customers = [];
  for (const c of customerDefs) {
    let cust = await User.findOne({ email: c.email.toLowerCase() });
    if (!cust) {
      cust = await User.create({
        name: c.name,
        email: c.email.toLowerCase(),
        passwordHash,
        role: 'CUSTOMER',
        virtualBalance: c.balance
      });
    }
    customers.push(cust);
  }

  // 5. Seed Holdings, Transactions, Snapshots, Targets, Alerts, and Watchlists for Customers
  const infy = stockMap.get('INFY');
  const tcs = stockMap.get('TCS');
  const reliance = stockMap.get('RELIANCE');
  const hdfc = stockMap.get('HDFCBANK');
  const sunpharma = stockMap.get('SUNPHARMA');

  for (let idx = 0; idx < customers.length; idx++) {
    const cust = customers[idx];

    // Seed Watchlists
    await Watchlist.updateOne(
      { userId: cust._id, stockId: infy._id },
      { $setOnInsert: { userId: cust._id, stockId: infy._id } },
      { upsert: true }
    );
    await Watchlist.updateOne(
      { userId: cust._id, stockId: reliance._id },
      { $setOnInsert: { userId: cust._id, stockId: reliance._id } },
      { upsert: true }
    );

    // Seed Holdings and Transactions if none exist
    const holdingCount = await Holding.countDocuments({ userId: cust._id });
    if (holdingCount === 0) {
      const stockToHold1 = idx % 2 === 0 ? infy : tcs;
      const stockToHold2 = idx % 2 === 0 ? reliance : hdfc;

      const qty1 = 20 + idx * 5;
      const buyPrice1 = Math.round(stockToHold1.currentPrice * 0.96 * 100) / 100;
      await Holding.create({
        userId: cust._id,
        stockId: stockToHold1._id,
        symbol: stockToHold1.symbol,
        quantity: qty1,
        averageBuyPrice: buyPrice1,
        totalInvested: qty1 * buyPrice1
      });

      await Transaction.create({
        userId: cust._id,
        stockId: stockToHold1._id,
        type: 'BUY',
        quantity: qty1,
        price: buyPrice1,
        fee: Math.round(qty1 * buyPrice1 * 0.0005 * 100) / 100,
        total: Math.round(qty1 * buyPrice1 * 1.0005 * 100) / 100,
        simDay: 240
      });

      const qty2 = 15 + idx * 3;
      const buyPrice2 = Math.round(stockToHold2.currentPrice * 0.94 * 100) / 100;
      await Holding.create({
        userId: cust._id,
        stockId: stockToHold2._id,
        symbol: stockToHold2.symbol,
        quantity: qty2,
        averageBuyPrice: buyPrice2,
        totalInvested: qty2 * buyPrice2
      });

      await Transaction.create({
        userId: cust._id,
        stockId: stockToHold2._id,
        type: 'BUY',
        quantity: qty2,
        price: buyPrice2,
        fee: Math.round(qty2 * buyPrice2 * 0.0005 * 100) / 100,
        total: Math.round(qty2 * buyPrice2 * 1.0005 * 100) / 100,
        simDay: 245
      });
    }

    // Seed 30 Days of Portfolio Snapshots
    const snapCount = await PortfolioSnapshot.countDocuments({ userId: cust._id });
    if (snapCount < 30) {
      const snapOps = [];
      let baseTotal = cust.virtualBalance + 80000;
      for (let day = 1; day <= 30; day++) {
        baseTotal += (Math.random() - 0.47) * 900;
        snapOps.push({
          updateOne: {
            filter: { userId: cust._id, simDay: day },
            update: {
              $set: {
                totalValue: Math.round(baseTotal * 100) / 100,
                cash: Math.round(cust.virtualBalance * 100) / 100,
                holdingsValue: Math.round((baseTotal - cust.virtualBalance) * 100) / 100
              }
            },
            upsert: true
          }
        });
      }
      await PortfolioSnapshot.bulkWrite(snapOps);
    }

    // Seed Active Probability Target
    const targetCount = await Target.countDocuments({ userId: cust._id });
    if (targetCount === 0) {
      await Target.create({
        userId: cust._id,
        stockId: infy._id,
        targetPrice: Math.round(infy.currentPrice * 1.10 * 100) / 100,
        deadlineDays: 30,
        startTick: 1,
        startPrice: infy.currentPrice,
        mode: 'touch',
        status: 'ACTIVE',
        lastProbability: 0.62
      });
    }

    // Seed Active Alert Rule
    const alertCount = await AlertRule.countDocuments({ ownerId: cust._id });
    if (alertCount === 0) {
      await AlertRule.create({
        ownerId: cust._id,
        ownerRole: 'CUSTOMER',
        stockId: reliance._id,
        type: 'PCT_CHANGE',
        threshold: 3.5,
        cooldownTicks: 390,
        active: true
      });
    }
  }

  console.log('[Seed] Database initialization complete:');
  console.log(' - 12 Stocks seeded across IT, Banking, Energy, Pharma');
  console.log(' - 252 Daily Candles backfilled');
  console.log(' - 3 COMPANY users configured (ceo@infy.sim, ir@hdfc.sim, corp@reliance.sim)');
  console.log(' - 5 CUSTOMER users configured with portfolios, targets, and alerts');
}

// Allow direct CLI execution: node src/config/seed.js
import { fileURLToPath } from 'url';
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const { connectDB } = await import('./db.js');
  await connectDB();
  await seedDatabase();
  console.log('[Seed] Finished. Exiting...');
  process.exit(0);
}
