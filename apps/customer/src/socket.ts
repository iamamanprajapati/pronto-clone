import { io, type Socket } from 'socket.io-client';
import { API, getToken } from './api';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
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
export function unsubscribe(channel: string) {
  socket?.emit('unsubscribe', channel);
}
