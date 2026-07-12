import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { channels } from '@pronto/shared';
import { verifyToken, type AuthClaims } from '../middleware/auth';
import { db } from '../db';

let io: Server;

export function initGateway(http: HttpServer): Server {
  io = new Server(http, { cors: { origin: '*' } });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    const claims = token ? verifyToken(token) : null;
    if (!claims) return next(new Error('unauthorized'));
    (socket.data as { claims: AuthClaims }).claims = claims;
    next();
  });

  io.on('connection', (socket: Socket) => {
    const claims = (socket.data as { claims: AuthClaims }).claims;

    socket.on('subscribe', async (channel: string, ack?: (ok: boolean) => void) => {
      const allowed = await canJoin(claims, channel);
      if (allowed) {
        socket.join(channel);
        try {
          const parts = channel.split(':');
          const { pushSnapshotForZone } = await import('../modules/location');
          if (parts[0] === 'admin' && parts[2] === 'firehose') {
            const cityId = parts[1];
            const zones = await db.zone.findMany({ where: { cityId, active: true } });
            for (const zone of zones) {
              await pushSnapshotForZone(zone.id);
            }
          } else if (parts[0] === 'zone' && parts[2] === 'workers') {
            // customer map: send current state immediately, don't wait for the loop
            await pushSnapshotForZone(parts[1]);
          }
        } catch (err) {
          console.error('Initial snapshot push error:', err);
        }
      }
      ack?.(allowed);
    });

    socket.on('unsubscribe', (channel: string) => socket.leave(channel));

    // Workers auto-join their own jobs channel so offers always reach them.
    if (claims.role === 'WORKER' && claims.workerId) {
      socket.join(channels.workerJobs(claims.workerId));
    }
  });

  return io;
}

/** Channel authorization: each role can only see its own slice. */
async function canJoin(claims: AuthClaims, channel: string): Promise<boolean> {
  if (claims.role === 'ADMIN') return true;
  if (channel.startsWith('zone:') && channel.endsWith(':workers')) {
    return claims.role === 'CUSTOMER'; // anonymized snapshots only
  }
  if (channel.startsWith('booking:')) {
    const bookingId = channel.split(':')[1];
    const booking = await db.booking.findUnique({ where: { id: bookingId }, select: { customerId: true, workerId: true } });
    if (!booking) return false;
    if (claims.role === 'CUSTOMER') return booking.customerId === claims.sub;
    if (claims.role === 'WORKER') return booking.workerId === claims.workerId;
  }
  if (channel.startsWith('worker:')) {
    return claims.role === 'WORKER' && channel === channels.workerJobs(claims.workerId ?? '');
  }
  return false;
}

export function emitTo(channel: string, event: string, payload: unknown) {
  io?.to(channel).emit(event, payload);
}
