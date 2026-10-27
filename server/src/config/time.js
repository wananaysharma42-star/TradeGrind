/**
 * Single source of truth for simulation time dynamics.
 * 
 * Rules:
 * - 1 tick = 1 simulated trading minute, emitted every 1 real second.
 * - 390 ticks = 1 simulated trading day (standard 6.5 hr day: 9:15 AM to 3:45 PM).
 * - 252 simulated trading days = 1 simulated trading year.
 * - dt = 1 / (252 * 390) years per tick = 1 / 98,280 years.
 * - Deadlines are specified in simulated trading days.
 * - mu (expected return) and sigma (volatility) are stored ANNUALISED.
 */

export const TIME_CONFIG = {
  TICKS_PER_DAY: 390,
  DAYS_PER_YEAR: 252,
  TICKS_PER_YEAR: 252 * 390, // 98,280 ticks/year
  DT: 1 / (252 * 390),       // dt in annualized year units
  TICK_INTERVAL_MS: 1000,    // 1 real second per simulated minute
  START_HOUR: 9,             // Market open 09:15 AM
  START_MINUTE: 15,
  CLOSE_HOUR: 15,            // Market close 03:45 PM
  CLOSE_MINUTE: 45
};

export const TICKS_PER_DAY = TIME_CONFIG.TICKS_PER_DAY;
export const DAYS_PER_YEAR = TIME_CONFIG.DAYS_PER_YEAR;
export const DT = TIME_CONFIG.DT;

/**
 * Converts a number of ticks into trading days.
 * @param {number} ticks
 * @returns {number}
 */
export function ticksToDays(ticks) {
  return ticks / TIME_CONFIG.TICKS_PER_DAY;
}

/**
 * Converts trading days to ticks.
 * @param {number} days
 * @returns {number}
 */
export function daysToTicks(days) {
  return Math.round(days * TIME_CONFIG.TICKS_PER_DAY);
}

/**
 * Returns formatted simulated market clock string from global tick index.
 * e.g. "Day 1, 09:15 AM"
 * @param {number} globalTick
 * @returns {{ day: number, dayTick: number, timeStr: string, formatted: string }}
 */
export function formatSimTime(globalTick) {
  const day = Math.floor(globalTick / TIME_CONFIG.TICKS_PER_DAY) + 1;
  const dayTick = globalTick % TIME_CONFIG.TICKS_PER_DAY;
  
  // Each tick is 1 minute starting from 9:15 AM
  const totalMinutes = TIME_CONFIG.START_HOUR * 60 + TIME_CONFIG.START_MINUTE + dayTick;
  const hours24 = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  const ampm = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const pad = (n) => String(n).padStart(2, '0');
  const timeStr = `${pad(hours12)}:${pad(minutes)} ${ampm}`;
  
  return {
    day,
    dayTick,
    timeStr,
    formatted: `Day ${day} • ${timeStr}`
  };
}
