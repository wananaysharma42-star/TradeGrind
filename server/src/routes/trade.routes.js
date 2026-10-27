/**
 * trade.routes.js - Customer Trading Endpoints:
 * POST /api/trade/buy
 * POST /api/trade/sell
 *
 * Executes trades at the engine's live in-memory price with configurable 0.05% fee,
 * atomically updating balance, Holding, and Transaction records,
 * returning the updated portfolio snapshot and emitting an immediate `portfolio:update`.
 */

import express from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Stock } from '../models/Stock.js';
import { User } from '../models/User.js';
import { Holding } from '../models/Holding.js';
import { Transaction } from '../models/Transaction.js';
import { authenticateToken } from '../middleware/auth.js';
import { getMarketEngine } from '../services/marketEngine.js';

const router = express.Router();

const DEFAULT_TRADE_FEE_PCT = 0.0005; // 0.05%
function getTradeFeePct() {
  const envFee = process.env.TRADE_FEE_PCT ? parseFloat(process.env.TRADE_FEE_PCT) : NaN;
  return Number.isFinite(envFee) ? envFee : DEFAULT_TRADE_FEE_PCT;
}

const tradeSchema = z.object({
  stockId: z.string().min(1),
  quantity: z.number().int().positive('Quantity must be a positive integer')
});

async function findStock(idOrSymbol) {
  if (/^[a-fA-F0-9]{24}$/.test(idOrSymbol)) {
    const byId = await Stock.findById(idOrSymbol);
    if (byId) return byId;
  }
  return Stock.findOne({ symbol: String(idOrSymbol).toUpperCase() });
}

// POST /api/trade/buy
router.post('/buy', authenticateToken, async (req, res, next) => {
  try {
    const validated = tradeSchema.parse(req.body);
    const userId = req.user._id;

    const stock = await findStock(validated.stockId);
    if (!stock) {
      return res.status(404).json({
        success: false,
        error: { code: 'STOCK_NOT_FOUND', message: `Stock '${validated.stockId}' not found` }
      });
    }

    const engine = getMarketEngine();
    const liveState = engine?.getState(String(stock._id)) || engine?.getState(stock.symbol);
    const executionPrice = liveState ? liveState.price : stock.currentPrice;
    const simDay = liveState ? liveState.simDay : (stock.tickCount ? Math.floor((stock.tickCount - 1) / 390) + 1 : 1);

    const grossAmount = executionPrice * validated.quantity;
    const feePct = getTradeFeePct();
    const fee = grossAmount * feePct;
    const totalCost = grossAmount + fee;

    // Check user balance
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
    }

    if (user.virtualBalance < totalCost) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_FUNDS',
          message: `Insufficient virtual balance. Required: ₹${totalCost.toFixed(2)}, Available: ₹${user.virtualBalance.toFixed(2)}`
        }
      });
    }

    // Atomic execution with MongoDB session/transaction if replica set is available,
    // otherwise sequential with balance check guard
    let updatedHolding;
    let transactionDoc;

    let session = null;
    try {
      // Transactions in MongoDB require replica sets (e.g. Atlas or local rs). Check if client topology supports it.
      const topology = mongoose.connection?.client?.topology;
      const isReplicaSet = topology?.description?.type === 'ReplicaSetWithPrimary' || topology?.s?.description?.type === 'ReplicaSetWithPrimary';
      if (isReplicaSet) {
        session = await mongoose.startSession();
        session.startTransaction();
      }
    } catch (e) {
      session = null;
    }

    try {
      const opts = session ? { session } : {};

      // 1. Deduct balance
      user.virtualBalance = Math.round((user.virtualBalance - totalCost) * 100) / 100;
      await user.save(opts);

      // 2. Update Holding
      let holding = await Holding.findOne({ userId, stockId: stock._id }, null, opts);
      if (holding) {
        const prevQty = holding.quantity || 0;
        const prevAvg = holding.avgBuyPrice || 0;
        const newQty = prevQty + validated.quantity;
        // Average cost: (prevQty * prevAvg + grossAmount) / newQty
        const newAvg = (prevQty * prevAvg + grossAmount) / newQty;

        holding.quantity = newQty;
        holding.avgBuyPrice = Math.round(newAvg * 100) / 100;
        await holding.save(opts);
        updatedHolding = holding;
      } else {
        const docs = await Holding.create([{
          userId,
          stockId: stock._id,
          quantity: validated.quantity,
          avgBuyPrice: Math.round(executionPrice * 100) / 100
        }], opts);
        updatedHolding = docs[0];
      }

      // 3. Record Transaction
      const txDocs = await Transaction.create([{
        userId,
        stockId: stock._id,
        type: 'BUY',
        quantity: validated.quantity,
        price: Math.round(executionPrice * 100) / 100,
        fee: Math.round(fee * 100) / 100,
        total: Math.round(totalCost * 100) / 100,
        simDay
      }], opts);
      transactionDoc = txDocs[0];

      if (session) {
        await session.commitTransaction();
      }
    } catch (txErr) {
      if (session) await session.abortTransaction();
      throw txErr;
    } finally {
      if (session) session.endSession();
    }

    // Sync in-memory engine and emit immediate portfolio:update
    const snapshot = engine ? await engine.syncUserPortfolio(String(userId), true) : null;

    res.status(200).json({
      success: true,
      data: {
        transaction: transactionDoc,
        holding: updatedHolding,
        portfolio: snapshot || {
          cash: user.virtualBalance,
          totalValue: user.virtualBalance
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/trade/sell
router.post('/sell', authenticateToken, async (req, res, next) => {
  try {
    const validated = tradeSchema.parse(req.body);
    const userId = req.user._id;

    const stock = await findStock(validated.stockId);
    if (!stock) {
      return res.status(404).json({
        success: false,
        error: { code: 'STOCK_NOT_FOUND', message: `Stock '${validated.stockId}' not found` }
      });
    }

    const holding = await Holding.findOne({ userId, stockId: stock._id });
    if (!holding || holding.quantity < validated.quantity) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_SHARES',
          message: `Insufficient shares. Owned: ${holding?.quantity || 0}, requested: ${validated.quantity}`
        }
      });
    }

    const engine = getMarketEngine();
    const liveState = engine?.getState(String(stock._id)) || engine?.getState(stock.symbol);
    const executionPrice = liveState ? liveState.price : stock.currentPrice;
    const simDay = liveState ? liveState.simDay : (stock.tickCount ? Math.floor((stock.tickCount - 1) / 390) + 1 : 1);

    const grossAmount = executionPrice * validated.quantity;
    const feePct = getTradeFeePct();
    const fee = grossAmount * feePct;
    const netProceeds = grossAmount - fee;

    const user = await User.findById(userId);

    let updatedHolding;
    let transactionDoc;

    let session = null;
    try {
      const topology = mongoose.connection?.client?.topology;
      const isReplicaSet = topology?.description?.type === 'ReplicaSetWithPrimary' || topology?.s?.description?.type === 'ReplicaSetWithPrimary';
      if (isReplicaSet) {
        session = await mongoose.startSession();
        session.startTransaction();
      }
    } catch (e) {
      session = null;
    }

    try {
      const opts = session ? { session } : {};

      // 1. Add balance
      user.virtualBalance = Math.round((user.virtualBalance + netProceeds) * 100) / 100;
      await user.save(opts);

      // 2. Reduce holding
      holding.quantity = holding.quantity - validated.quantity;
      if (holding.quantity === 0) {
        holding.avgBuyPrice = 0;
      }
      await holding.save(opts);
      updatedHolding = holding;

      // 3. Record Transaction
      const txDocs = await Transaction.create([{
        userId,
        stockId: stock._id,
        type: 'SELL',
        quantity: validated.quantity,
        price: Math.round(executionPrice * 100) / 100,
        fee: Math.round(fee * 100) / 100,
        total: Math.round(netProceeds * 100) / 100,
        simDay
      }], opts);
      transactionDoc = txDocs[0];

      if (session) {
        await session.commitTransaction();
      }
    } catch (txErr) {
      if (session) await session.abortTransaction();
      throw txErr;
    } finally {
      if (session) session.endSession();
    }

    const snapshot = engine ? await engine.syncUserPortfolio(String(userId), true) : null;

    res.status(200).json({
      success: true,
      data: {
        transaction: transactionDoc,
        holding: updatedHolding,
        portfolio: snapshot || {
          cash: user.virtualBalance,
          totalValue: user.virtualBalance
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
