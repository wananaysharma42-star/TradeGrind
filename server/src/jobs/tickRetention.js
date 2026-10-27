import { Stock } from '../models/Stock.js';
import { PriceTick } from '../models/PriceTick.js';

export const PRICE_TICK_RETENTION = 2000;

/**
 * Keeps the last `maxKeep` PriceTick documents per stock (default 2000).
 */
export async function prunePriceTicks(maxKeep = PRICE_TICK_RETENTION) {
  const stocks = await Stock.find({}, '_id').lean();
  await Promise.all(stocks.map((stock) => PriceTick.pruneOldTicks(stock._id, maxKeep)));
}

/**
 * Starts a periodic retention job. Returns a stop function.
 */
export function startTickRetentionJob(intervalMs = 60_000) {
  const run = () => {
    prunePriceTicks().catch((err) => {
      console.error('[TickRetention] Failed to prune price ticks:', err.message);
    });
  };

  run();
  const intervalId = setInterval(run, intervalMs);
  return () => clearInterval(intervalId);
}
