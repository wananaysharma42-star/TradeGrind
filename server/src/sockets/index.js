import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../middleware/auth.js';

/**
 * JWT-authenticated Socket.io wiring.
 * Rooms: user:{id}, market, stock:{id|symbol}
 */
export function attachSockets(io, marketEngine) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token
      || socket.handshake.headers?.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.user = {
        id: decoded.id,
        role: decoded.role,
        email: decoded.email,
        name: decoded.name
      };
      return next();
    } catch (err) {
      return next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    socket.join('market');
    socket.join(`user:${userId}`);
    marketEngine.addUserConnection(userId, socket.user.role).catch((err) => {
      console.warn('[Socket] Failed to cache user session:', err.message);
    });

    socket.on('subscribe:stock', (payload) => {
      const key = typeof payload === 'string' ? payload : payload?.stockId || payload?.symbol;
      if (!key) return;
      const raw = String(key);
      socket.join(`stock:${raw}`);
      socket.join(`stock:${raw.toUpperCase()}`);
    });

    socket.on('unsubscribe:stock', (payload) => {
      const key = typeof payload === 'string' ? payload : payload?.stockId || payload?.symbol;
      if (!key) return;
      const raw = String(key);
      socket.leave(`stock:${raw}`);
      socket.leave(`stock:${raw.toUpperCase()}`);
    });

    socket.on('disconnect', () => {
      marketEngine.removeUserConnection(userId);
    });
  });
}
