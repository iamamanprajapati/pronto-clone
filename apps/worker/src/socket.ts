import { io, type Socket } from 'socket.io-client';
import { API, getToken } from './api';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    // workers auto-join their own jobs channel on the server
    socket = io(API, { auth: { token: getToken() }, transports: ['websocket'] });
  }
  return socket;
}

export function resetSocket() {
  socket?.disconnect();
  socket = null;
}

export function subscribe(channel: string) {
  getSocket().emit('subscribe', channel);
}
