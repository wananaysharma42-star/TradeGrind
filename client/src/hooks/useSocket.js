import { useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { initSocket, subscribeToStock, unsubscribeFromStock } from '../services/socket.js';

/**
 * useSocket - Initializes global socket connection and ensures user room subscription.
 */
export function useSocket() {
  const socketRef = useRef(null);

  if (!socketRef.current) {
    socketRef.current = initSocket();
  }

  useEffect(() => {
    socketRef.current = initSocket();
    return () => {
      // socket persists across route navigation
    };
  }, []);

  return {
    socket: socketRef.current,
    isConnected: socketRef.current?.connected || false
  };
}

/**
 * useStockSocket - Subscribes to live room ticks for a specific stock while mounted.
 */
export function useStockSocket(symbolOrId) {
  useEffect(() => {
    if (!symbolOrId) return;
    initSocket();
    subscribeToStock(symbolOrId);

    return () => {
      unsubscribeFromStock(symbolOrId);
    };
  }, [symbolOrId]);
}

/**
 * useLivePrice - Retrieves in-memory live price and price flash for a stock from Redux.
 */
export function useLivePrice(symbol) {
  const stock = useSelector((state) =>
    state.market.stocks.find((s) => s.symbol === symbol)
  );
  const flash = useSelector((state) => state.market.priceFlashes[symbol]);

  return {
    price: stock?.currentPrice ?? stock?.price ?? 0,
    changePct: stock?.dayChangePercent ?? stock?.changePct ?? 0,
    dayHigh: stock?.dayHigh ?? 0,
    dayLow: stock?.dayLow ?? 0,
    volume: stock?.volume ?? 0,
    flash: flash || null,
    stock
  };
}
