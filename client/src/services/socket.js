import { io } from 'socket.io-client';
import { store } from '../store/index.js';
import {
  processMarketTick,
  processStockDetailTick,
  clearPriceFlash
} from '../store/slices/marketSlice.js';
import { updateLivePortfolio } from '../store/slices/portfolioSlice.js';
import { updateTargetLive } from '../store/slices/targetSlice.js';
import { addNotification } from '../store/slices/notificationSlice.js';

let socket = null;
const flashTimeouts = new Map();

export function initSocket() {
  if (socket && socket.connected) return socket;

  const token = store.getState().auth.token;
  const socketURL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:8009';

  socket = io(socketURL, {
    auth: {
      token: token || null
    },
    transports: ['websocket', 'polling']
  });

  socket.on('connect', () => {
    console.log(`[Socket] Handshake established with server, socket ID: ${socket.id}`);
  });

  // Handle incoming buffered market tick (1 per second)
  socket.on('market:tick', (data) => {
    store.dispatch(processMarketTick(data));

    // Clear flashes automatically after 400ms
    const stockList = Array.isArray(data) ? data : data?.stocks;
    if (stockList && Array.isArray(stockList)) {
      stockList.forEach((s) => {
        if (!s || !s.symbol) return;
        if (flashTimeouts.has(s.symbol)) {
          clearTimeout(flashTimeouts.get(s.symbol));
        }
        const timeout = setTimeout(() => {
          store.dispatch(clearPriceFlash(s.symbol));
          flashTimeouts.delete(s.symbol);
        }, 400);
        flashTimeouts.set(s.symbol, timeout);
      });
    }
  });

  // Handle detailed stock room ticks
  socket.on('stock:tick', (detail) => {
    store.dispatch(processStockDetailTick(detail));
  });

  // Handle live customer portfolio update
  socket.on('portfolio:update', (portfolio) => {
    store.dispatch(updateLivePortfolio(portfolio));
  });

  // Handle live target probability update
  socket.on('target:update', (target) => {
    store.dispatch(updateTargetLive(target));
  });

  // Handle live notifications
  socket.on('notification:new', (notif) => {
    store.dispatch(addNotification(notif));
  });

  socket.on('disconnect', () => {
    console.warn('[SocketClient] Disconnected from server');
  });

  return socket;
}

export function subscribeToStock(symbol) {
  if (socket && symbol) {
    socket.emit('subscribe:stock', symbol);
  }
}

export function unsubscribeFromStock(symbol) {
  if (socket && symbol) {
    socket.emit('unsubscribe:stock', symbol);
  }
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
