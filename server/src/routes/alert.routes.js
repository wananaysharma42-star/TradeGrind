/**
 * alert.routes.js - Alert Rules REST Endpoints:
 * - CRUD /api/alerts: Create, Read, Update, Delete alert rules
 * - POST /api/alerts/preview: Backtest draft rule over last 30 simulated days
 */

import express from 'express';
import { z } from 'zod';
import { AlertRule } from '../models/AlertRule.js';
import { Stock } from '../models/Stock.js';
import { Target } from '../models/Target.js';
import { authenticateToken } from '../middleware/auth.js';
import { getAlertEngine, AlertEngine } from '../services/alertEngine.js';

const router = express.Router();

const alertSchema = z.object({
  stockId: z.string().optional().nullable(),
  type: z.enum([
    'PRICE_ABOVE',
    'PRICE_BELOW',
    'PCT_CHANGE',
    'PROB_BELOW',
    'PROB_ABOVE',
    'VOLATILITY_ABOVE',
    'RANK_BELOW',
    'HOLDER_COUNT_BELOW'
  ]),
  threshold: z.number(),
  targetId: z.string().optional().nullable(),
  cooldownTicks: z.number().int().min(1).default(390),
  active: z.boolean().default(true)
});

// GET /api/alerts - List user's active/all rules
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const rules = await AlertRule.find({ ownerId: req.user._id })
      .populate('stockId', 'symbol name currentPrice')
      .populate('targetId')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: rules
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/alerts - Create alert rule
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const validated = alertSchema.parse(req.body);

    let stockId = validated.stockId || null;
    let targetId = validated.targetId || null;

    if (targetId) {
      const target = await Target.findById(targetId);
      if (!target) {
        return res.status(404).json({
          success: false,
          error: { code: 'TARGET_NOT_FOUND', message: `Target '${targetId}' not found` }
        });
      }
      if (!stockId) stockId = target.stockId;
    }

    if (stockId) {
      const stock = await Stock.findById(stockId);
      if (!stock) {
        return res.status(404).json({
          success: false,
          error: { code: 'STOCK_NOT_FOUND', message: `Stock '${stockId}' not found` }
        });
      }
    }

    const rule = await AlertRule.create({
      ownerId: req.user._id,
      ownerRole: req.user.role || 'CUSTOMER',
      stockId,
      targetId,
      type: validated.type,
      threshold: validated.threshold,
      cooldownTicks: validated.cooldownTicks,
      active: validated.active
    });

    const alertEngine = getAlertEngine();
    if (alertEngine) {
      await alertEngine.reloadRules();
    }

    const populated = await AlertRule.findById(rule._id)
      .populate('stockId', 'symbol name currentPrice')
      .populate('targetId')
      .lean();

    res.status(201).json({
      success: true,
      data: populated
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/alerts/:id
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const rule = await AlertRule.findOne({ _id: req.params.id, ownerId: req.user._id })
      .populate('stockId', 'symbol name currentPrice')
      .populate('targetId')
      .lean();

    if (!rule) {
      return res.status(404).json({
        success: false,
        error: { code: 'RULE_NOT_FOUND', message: 'Alert rule not found' }
      });
    }

    res.json({
      success: true,
      data: rule
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/alerts/:id - Update alert rule
router.put('/:id', authenticateToken, async (req, res, next) => {
  try {
    const rule = await AlertRule.findOne({ _id: req.params.id, ownerId: req.user._id });
    if (!rule) {
      return res.status(404).json({
        success: false,
        error: { code: 'RULE_NOT_FOUND', message: 'Alert rule not found' }
      });
    }

    const { type, threshold, cooldownTicks, active, targetId, stockId } = req.body;
    if (type !== undefined) rule.type = type;
    if (threshold !== undefined) rule.threshold = threshold;
    if (cooldownTicks !== undefined) rule.cooldownTicks = cooldownTicks;
    if (active !== undefined) rule.active = active;
    if (targetId !== undefined) rule.targetId = targetId || null;
    if (stockId !== undefined) rule.stockId = stockId || null;

    await rule.save();

    const alertEngine = getAlertEngine();
    if (alertEngine) {
      await alertEngine.reloadRules();
    }

    const populated = await AlertRule.findById(rule._id)
      .populate('stockId', 'symbol name currentPrice')
      .populate('targetId')
      .lean();

    res.json({
      success: true,
      data: populated
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/alerts/:id - Delete alert rule
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    const rule = await AlertRule.findOneAndDelete({ _id: req.params.id, ownerId: req.user._id });
    if (!rule) {
      return res.status(404).json({
        success: false,
        error: { code: 'RULE_NOT_FOUND', message: 'Alert rule not found' }
      });
    }

    const alertEngine = getAlertEngine();
    if (alertEngine) {
      await alertEngine.reloadRules();
    }

    res.json({
      success: true,
      data: { message: 'Alert rule removed successfully', ruleId: req.params.id }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/alerts/preview - Backtest a draft rule over last 30 simulated days
router.post('/preview', authenticateToken, async (req, res, next) => {
  try {
    const { stockId, type, threshold, cooldownTicks } = req.body;
    if (!stockId || !type || threshold == null) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PAYLOAD', message: 'stockId, type, and threshold are required' }
      });
    }

    const preview = await AlertEngine.previewRule({
      stockId,
      type,
      threshold: Number(threshold),
      cooldownTicks: cooldownTicks ? Number(cooldownTicks) : 390
    });

    res.json({
      success: true,
      data: preview
    });
  } catch (err) {
    next(err);
  }
});

export default router;
