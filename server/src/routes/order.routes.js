import express from 'express';
import { z } from 'zod';
import { Order } from '../models/Order.js';
import { Stock } from '../models/Stock.js';
import { User } from '../models/User.js';
import { Holding } from '../models/Holding.js';
import { Notification } from '../models/Notification.js';
import { authenticateToken } from '../middleware/auth.js';
import { getMarketEngine } from '../services/marketEngine.js';

const router = express.Router();

const placeOrderSchema = z.object({
  symbol: z.string().min(1).toUpperCase(),
  type: z.enum(['MARKET_BUY', 'MARKET_SELL', 'LIMIT_BUY', 'LIMIT_SELL']),
  quantity: z.number().int().positive('Quantity must be at least 1 share'),
  price: z.number().positive().optional()
});

// POST /api/orders - Place order
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const validated = placeOrderSchema.parse(req.body);
    const userId = req.user._id;

    const stock = await Stock.findOne({ symbol: validated.symbol });
    if (!stock) {
      return res.status(404).json({
        success: false,
        error: { code: 'STOCK_NOT_FOUND', message: `Stock ${validated.symbol} not found` }
      });
    }

    const user = await User.findById(userId);
    const live = getMarketEngine()?.getState(String(stock._id));
    if (live) stock.currentPrice = live.price;

    const orderPrice = (validated.type.startsWith('LIMIT') && validated.price)
      ? validated.price
      : stock.currentPrice;

    const totalAmount = Math.round(orderPrice * validated.quantity * 100) / 100;

    // MARKET BUY
    if (validated.type === 'MARKET_BUY') {
      if (user.virtualBalance < totalAmount) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_FUNDS',
            message: `Insufficient virtual cash. Required: ₹${totalAmount.toLocaleString('en-IN')}, Available: ₹${user.virtualBalance.toLocaleString('en-IN')}`
          }
        });
      }

      // Deduct balance
      user.virtualBalance = Math.round((user.virtualBalance - totalAmount) * 100) / 100;
      await user.save();

      // Update or create holding
      let holding = await Holding.findOne({ userId, stockId: stock._id });
      if (holding) {
        const newQty = holding.quantity + validated.quantity;
        const newInvested = holding.totalInvested + totalAmount;
        holding.quantity = newQty;
        holding.totalInvested = Math.round(newInvested * 100) / 100;
        holding.averageBuyPrice = Math.round((newInvested / newQty) * 100) / 100;
        await holding.save();
      } else {
        holding = await Holding.create({
          userId,
          stockId: stock._id,
          symbol: stock.symbol,
          quantity: validated.quantity,
          averageBuyPrice: orderPrice,
          totalInvested: totalAmount
        });
      }

      // Create executed order
      const order = await Order.create({
        userId,
        stockId: stock._id,
        symbol: stock.symbol,
        type: 'MARKET_BUY',
        quantity: validated.quantity,
        price: orderPrice,
        executedPrice: orderPrice,
        totalAmount,
        status: 'EXECUTED',
        executedAtTick: 0
      });

      // Notification
      await Notification.create({
        userId,
        title: `Market Buy Executed: ${stock.symbol}`,
        message: `Bought ${validated.quantity} shares of ${stock.symbol} at ₹${orderPrice.toFixed(2)} for ₹${totalAmount.toLocaleString('en-IN')}`,
        type: 'ORDER_FILLED'
      });

      getMarketEngine()?.syncUserPortfolio(String(userId)).catch(() => {});

      return res.status(201).json({
        success: true,
        data: {
          order,
          holding,
          balance: user.virtualBalance
        }
      });
    }

    // MARKET SELL
    if (validated.type === 'MARKET_SELL') {
      const holding = await Holding.findOne({ userId, stockId: stock._id });
      if (!holding || holding.quantity < validated.quantity) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_SHARES',
            message: `Insufficient shares. Owned: ${holding ? holding.quantity : 0}, Requested: ${validated.quantity}`
          }
        });
      }

      const proceed = Math.round(stock.currentPrice * validated.quantity * 100) / 100;
      user.virtualBalance = Math.round((user.virtualBalance + proceed) * 100) / 100;
      await user.save();

      const newQty = holding.quantity - validated.quantity;
      if (newQty === 0) {
        await Holding.findByIdAndDelete(holding._id);
      } else {
        holding.quantity = newQty;
        holding.totalInvested = Math.round(newQty * holding.averageBuyPrice * 100) / 100;
        await holding.save();
      }

      const order = await Order.create({
        userId,
        stockId: stock._id,
        symbol: stock.symbol,
        type: 'MARKET_SELL',
        quantity: validated.quantity,
        price: stock.currentPrice,
        executedPrice: stock.currentPrice,
        totalAmount: proceed,
        status: 'EXECUTED',
        executedAtTick: 0
      });

      await Notification.create({
        userId,
        title: `Market Sell Executed: ${stock.symbol}`,
        message: `Sold ${validated.quantity} shares of ${stock.symbol} at ₹${stock.currentPrice.toFixed(2)} for ₹${proceed.toLocaleString('en-IN')}`,
        type: 'ORDER_FILLED'
      });

      getMarketEngine()?.syncUserPortfolio(String(userId)).catch(() => {});

      return res.status(201).json({
        success: true,
        data: {
          order,
          remainingHolding: newQty,
          balance: user.virtualBalance
        }
      });
    }

    // LIMIT BUY
    if (validated.type === 'LIMIT_BUY') {
      if (!validated.price || validated.price <= 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'PRICE_REQUIRED', message: 'Limit price is required for limit orders' }
        });
      }

      if (user.virtualBalance < totalAmount) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_FUNDS',
            message: `Insufficient funds to lock limit buy. Required: ₹${totalAmount.toLocaleString('en-IN')}`
          }
        });
      }

      // Lock balance
      user.virtualBalance = Math.round((user.virtualBalance - totalAmount) * 100) / 100;
      await user.save();

      const order = await Order.create({
        userId,
        stockId: stock._id,
        symbol: stock.symbol,
        type: 'LIMIT_BUY',
        quantity: validated.quantity,
        price: validated.price,
        totalAmount,
        status: 'PENDING'
      });

      return res.status(201).json({
        success: true,
        data: {
          order,
          balance: user.virtualBalance
        }
      });
    }

    // LIMIT SELL
    if (validated.type === 'LIMIT_SELL') {
      if (!validated.price || validated.price <= 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'PRICE_REQUIRED', message: 'Limit price is required for limit orders' }
        });
      }

      const holding = await Holding.findOne({ userId, stockId: stock._id });
      if (!holding || holding.quantity < validated.quantity) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_SHARES',
            message: `Insufficient shares to place limit sell. Owned: ${holding ? holding.quantity : 0}`
          }
        });
      }

      // Lock shares by decrementing available holding
      holding.quantity -= validated.quantity;
      holding.totalInvested = Math.round(holding.quantity * holding.averageBuyPrice * 100) / 100;
      await holding.save();

      const order = await Order.create({
        userId,
        stockId: stock._id,
        symbol: stock.symbol,
        type: 'LIMIT_SELL',
        quantity: validated.quantity,
        price: validated.price,
        totalAmount,
        status: 'PENDING'
      });

      return res.status(201).json({
        success: true,
        data: {
          order,
          remainingHolding: holding.quantity
        }
      });
    }

  } catch (err) {
    next(err);
  }
});

// GET /api/orders - Order history
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const orders = await Order.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({
      success: true,
      data: orders
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/orders/:id - Cancel pending limit order
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, userId: req.user._id });
    if (!order) {
      return res.status(404).json({
        success: false,
        error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' }
      });
    }

    if (order.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        error: { code: 'ORDER_NOT_CANCELLABLE', message: `Cannot cancel order with status ${order.status}` }
      });
    }

    const user = await User.findById(req.user._id);

    // Unlock funds or shares
    if (order.type === 'LIMIT_BUY') {
      user.virtualBalance = Math.round((user.virtualBalance + order.totalAmount) * 100) / 100;
      await user.save();
    } else if (order.type === 'LIMIT_SELL') {
      let holding = await Holding.findOne({ userId: user._id, stockId: order.stockId });
      if (holding) {
        holding.quantity += order.quantity;
        holding.totalInvested = Math.round(holding.quantity * holding.averageBuyPrice * 100) / 100;
        await holding.save();
      } else {
        await Holding.create({
          userId: user._id,
          stockId: order.stockId,
          symbol: order.symbol,
          quantity: order.quantity,
          averageBuyPrice: order.price,
          totalInvested: order.totalAmount
        });
      }
    }

    order.status = 'CANCELLED';
    await order.save();

    await Notification.create({
      userId: user._id,
      title: `Order Cancelled: ${order.symbol}`,
      message: `Limit order #${order._id.toString().slice(-6)} was cancelled`,
      type: 'ORDER_CANCELLED'
    });

    res.json({
      success: true,
      data: {
        order,
        balance: user.virtualBalance
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
