import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

class SocketService {
  private socket: Socket | null = null;
  private listeners: { [event: string]: Function[] } = {};

  connect() {
    if (!this.socket) {
      this.socket = io(SOCKET_URL, {
        transports: ['websocket'],
      });

      this.socket.on('connect', () => {
        console.log('Socket connected:', this.socket?.id);
      });

      this.socket.on('disconnect', () => {
        console.log('Socket disconnected');
      });

      // Unified listener delegator
      const events = ['price-update', 'pnl-update', 'order-update'];
      events.forEach((event) => {
        this.socket?.on(event, (data) => {
          if (this.listeners[event]) {
            this.listeners[event].forEach((cb) => cb(data));
          }
        });
      });
    }
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  subscribe(room: string) {
    if (this.socket && this.socket.connected) {
      this.socket.emit(room);
    } else if (this.socket) {
      this.socket.once('connect', () => {
        this.socket?.emit(room);
      });
    }
  }

  on(event: string, callback: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return () => this.off(event, callback); // Returns unsubscribe function
  }

  off(event: string, callback: Function) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback);
    }
  }
}

export const socketService = new SocketService();
