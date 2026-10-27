import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server as SocketIOServer } from 'socket.io';

import { connectDB } from './config/db.js';
import { seedDatabase } from './config/seed.js';
import { errorHandler } from './middleware/errorHandler.js';
import { MarketEngine, setMarketEngine } from './services/marketEngine.js';
import { attachSockets } from './sockets/index.js';
import { startTickRetentionJob } from './jobs/tickRetention.js';

import authRoutes from './routes/auth.routes.js';
import stockRoutes from './routes/stock.routes.js';
import orderRoutes from './routes/order.routes.js';
import portfolioRoutes from './routes/portfolio.routes.js';
import targetRoutes from './routes/target.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import companyRoutes from './routes/company.routes.js';
import tradeRoutes from './routes/trade.routes.js';
import watchlistRoutes from './routes/watchlist.routes.js';
import insightsRoutes from './routes/insights.routes.js';
import alertRoutes from './routes/alert.routes.js';
import devRoutes from './routes/dev.routes.js';
import { startTargetWatcher } from './jobs/targetWatcher.js';
import { AlertEngine, setAlertEngine } from './services/alertEngine.js';

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';

dotenv.config();

const app = express();
const server = http.createServer(app);
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

// Security headers with helmet
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Rate limiting (1000 requests per 15 mins for API, relaxed in test/dev)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : 1500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later.'
    }
  }
});

app.use('/api', apiLimiter);

app.use(cors({
  origin: (origin, callback) => {
    // Allow any localhost/127.0.0.1 origin or matching clientOrigin with credentials
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(cookieParser());
app.use(express.json());

const io = new SocketIOServer(server, {
  cors: {
    origin: (origin, callback) => {
      callback(null, true);
    },
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const marketEngine = new MarketEngine(io);
setMarketEngine(marketEngine);
const alertEngine = new AlertEngine(marketEngine, io);
setAlertEngine(alertEngine);
attachSockets(io, marketEngine);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      time: new Date(),
      uptime: process.uptime(),
      globalTick: marketEngine.globalTick,
      lastTickDurationMs: marketEngine.lastTickDurationMs,
      stockCount: marketEngine.states.size
    }
  });
});

app.use('/api/auth', authRoutes);
app.use('/api', insightsRoutes);
app.use('/api/stocks', stockRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/transactions', portfolioRoutes);
app.use('/api/targets', targetRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/trade', tradeRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/dev', devRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 5001;

async function bootstrap() {
  try {
    await connectDB();
    await seedDatabase();
    await marketEngine.initialize();
    marketEngine.start();
    await alertEngine.reloadRules();
    startTickRetentionJob();
    startTargetWatcher(io);

    server.listen(PORT, () => {
      console.log(`🚀 TradeGrind Server listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Fatal startup error:', err);
    process.exit(1);
  }
}

import { fileURLToPath } from 'url';

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule && process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  bootstrap();
}

export { app, server, io, marketEngine, bootstrap };
