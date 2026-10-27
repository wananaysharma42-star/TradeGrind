import { io } from 'socket.io-client';

const socketURL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5001';

class SocketService {
  constructor() {
    this.socket = null;
    this.handlers = new Map();
  }

  connect(token = null) {
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    const authToken = token || localStorage.getItem('tradesim_token');

    this.socket = io(socketURL, {
      auth: {
        token: authToken || null,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log(`[Socket] Handshake established with server, socket ID: ${this.socket.id}`);
    });

    this.socket.on('disconnect', (reason) => {
      console.warn(`[Socket] Disconnected from server: ${reason}`);
    });

    this.socket.on('connect_error', (error) => {
      console.warn(`[Socket] Connection error: ${error.message}`);
    });

    // Reattach any registered handlers if reconnecting
    for (const [event, callbacks] of this.handlers.entries()) {
      for (const cb of callbacks) {
        this.socket.on(event, cb);
      }
    }

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      console.log('[Socket] Socket disconnected manually');
    }
  }

  on(event, callback) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event).add(callback);

    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    if (this.handlers.has(event)) {
      this.handlers.get(event).delete(callback);
    }

    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  emit(event, data) {
    if (this.socket) {
      this.socket.emit(event, data);
    } else {
      console.warn(`[Socket] Cannot emit '${event}', socket not connected`);
    }
  }

  getSocket() {
    return this.socket;
  }
}

export const socketService = new SocketService();
export default socketService;
