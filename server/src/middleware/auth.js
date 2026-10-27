import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'tradesim_super_secret_jwt_key_2026';

export async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : (authHeader || null);

  if (!token && req.cookies) {
    token = req.cookies.tradegrind_token || req.cookies.tradesim_token || req.cookies.token || null;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token required'
      }
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-passwordHash');
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User no longer exists'
        }
      });
    }

    req.token = token;
    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token'
      }
    });
  }
}

export const requireAuth = authenticateToken;

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Requires ${role} role.`
        }
      });
    }
    next();
  };
}
