/**
 * Server Entrypoint for TradeSim
 * Initializes HTTP server, Express application, and Socket.io real-time engine.
 */
import { server, app, io, marketEngine, bootstrap } from './server.js';

if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  bootstrap();
}

export { server, app, io, marketEngine };
