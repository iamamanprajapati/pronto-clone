import { io, type Socket } from 'socket.io-client';
import { API, getToken } from './api';

let socket: Socket | null = null;
/** Rooms we want to be in — re-joined automatically after every (re)connect. */
const channels = new Set<string>();

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API, { auth: { token: getToken() }, transports: ['websocket'] });
    socket.on('connect', () => {
      channels.forEach(c => socket!.emit('subscribe', c));
    });
  }
  return socket;
}

export function resetSocket() {
  channels.clear();
  socket?.disconnect();
  socket = null;
}

export function subscribe(channel: string) {
  channels.add(channel);
  getSocket().emit('subscribe', channel);
}

export function unsubscribe(channel: string) {
  channels.delete(channel);
  socket?.emit('unsubscribe', channel);
}
