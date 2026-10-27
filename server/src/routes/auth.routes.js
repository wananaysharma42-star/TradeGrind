import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { Stock } from '../models/Stock.js';
import { JWT_SECRET, requireAuth } from '../middleware/auth.js';
import { registerSchema, loginSchema, randomInRange } from '../utils/validators.js';
import { getMarketEngine } from '../services/marketEngine.js';

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    // If role is omitted, default to CUSTOMER
    const payload = {
      ...req.body,
      role: req.body.role || 'CUSTOMER',
      name: req.body.name || req.body.username // support both name and username
    };

    const validated = registerSchema.parse(payload);

    // Check duplicate email
    const existingUser = await User.findOne({ email: validated.email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'EMAIL_EXISTS',
          message: 'An account with this email already exists'
        }
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(validated.password, salt);

    if (validated.role === 'COMPANY') {
      const existingStock = await Stock.findOne({ symbol: validated.symbol });
      if (existingStock) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'SYMBOL_EXISTS',
            message: `Stock symbol '${validated.symbol}' is already registered`
          }
        });
      }

      // Generate mu random in [0.05, 0.25] and sigma random in [0.15, 0.50] if not provided
      const finalMu = validated.mu !== undefined ? validated.mu : randomInRange(0.05, 0.25);
      const finalSigma = validated.sigma !== undefined ? validated.sigma : randomInRange(0.15, 0.50);
      const price = validated.initialPrice || 1000.00;
      const shares = validated.totalShares || 50000000;

      // 1. Create User
      const newUser = await User.create({
        name: validated.name,
        email: validated.email.toLowerCase(),
        passwordHash,
        role: 'COMPANY',
        virtualBalance: 0,
        companyName: validated.companyName,
        sector: validated.sector,
        avatarColor: '#8E6AA5'
      });

      // 2. Create Stock linked to this Company
      const newStock = await Stock.create({
        symbol: validated.symbol,
        name: validated.companyName,
        sector: validated.sector,
        mu: finalMu,
        sigma: finalSigma,
        currentPrice: price,
        previousClose: price,
        totalShares: shares,
        ownerCompany: newUser._id,
        tickCount: 0,
        viewCount: 0
      });

      // 3. Link stockId to User
      newUser.stockId = newStock._id;
      await newUser.save();

      const engine = getMarketEngine();
      if (engine) {
        await engine.ingestNewStock(newStock).catch((err) => {
          console.warn('[Auth] Failed to ingest new stock into engine:', err.message);
        });
      }

      const token = jwt.sign(
        { id: newUser._id, email: newUser.email, role: newUser.role, name: newUser.name },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      const userJson = newUser.toJSON();
      userJson.stock = newStock;

      return res.status(201).json({
        success: true,
        data: {
          token,
          user: userJson
        }
      });
    }

    // CUSTOMER Registration
    const newUser = await User.create({
      name: validated.name,
      email: validated.email.toLowerCase(),
      passwordHash,
      role: 'CUSTOMER',
      virtualBalance: 1000000,
      avatarColor: '#C9A6D8'
    });

    const token = jwt.sign(
      { id: newUser._id, email: newUser.email, role: newUser.role, name: newUser.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      success: true,
      data: {
        token,
        user: newUser.toJSON()
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const validated = loginSchema.parse(req.body);

    const user = await User.findOne({ email: validated.email.toLowerCase() })
      .select('+passwordHash')
      .populate('stockId');
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      });
    }

    const isMatch = await bcrypt.compare(validated.password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      data: {
        token,
        user: user.toJSON()
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate('stockId');
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' }
      });
    }

    res.json({
      success: true,
      data: {
        user: user.toJSON()
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.json({
    success: true,
    data: {
      message: 'Logged out successfully'
    }
  });
});

export default router;
