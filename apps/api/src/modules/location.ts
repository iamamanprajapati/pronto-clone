import { Router } from 'express';
import { z } from 'zod';
import {
  ANON_GRID_DEG, channels, EV, SNAPSHOT_INTERVAL_MS, WORKER_LIVENESS_TTL_S, type ZoneSnapshot,
} from '@pronto/shared';
import { db } from '../db';
import { geoKey, liveKey, redis } from '../redis';
import { emitTo } from '../realtime/gateway';
import { requireAuth } from '../middleware/auth';
import { h } from '../middleware/errors';
import { etaMinutes } from '../lib/geo';

/**
 * LOCATION PIPELINE
 * worker pings → Redis GEO + liveness hash → 5s zone snapshots →
 *   customer variant (anonymized, grid-snapped) + admin variant (exact).
 * Exact live position goes only to the assigned booking's channel.
 */

export const locationRouter = Router();

locationRouter.post('/batch', requireAuth('WORKER'), h(async (req, res) => {
  const { points } = z.object({
    points: z.array(z.object({ lat: z.number(), lng: z.number(), at: z.string().optional() })).min(1),
  }).parse(req.body);
  const workerId = req.auth!.workerId!;
  const last = points[points.length - 1];

  const worker = await db.worker.findUnique({ where: { id: workerId }, include: { hub: true } });
  if (!worker || worker.duty === 'OFF_DUTY') return res.json({ ok: true, ignored: true });

  const zoneId = worker.hub?.zoneId;
  if (zoneId) {
    await redis.geoadd(geoKey(zoneId), last.lng, last.lat, `worker:${workerId}`);
  }
  const existing = await redis.hgetall(liveKey(workerId));
  await redis.hset(liveKey(workerId), {
    lat: last.lat, lng: last.lng,
    duty: worker.duty,
    idleSince: existing.idleSince ?? Date.now(),
    zoneId: zoneId ?? '',
    lastPing: Date.now(),
  });
  await redis.expire(liveKey(workerId), WORKER_LIVENESS_TTL_S);

  // Exact position → the active booking's channel only
  if (worker.duty === 'EN_ROUTE' || worker.duty === 'ON_JOB') {
    const booking = await db.booking.findFirst({
      where: { workerId, status: { in: ['EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'] } },
      include: { address: true },
    });
    if (booking) {
      const dist = Math.round(
        Math.hypot(booking.address.lat - last.lat, booking.address.lng - last.lng) * 111_000,
      );
      emitTo(channels.booking(booking.id), EV.WORKER_LOCATION, {
        bookingId: booking.id, lat: last.lat, lng: last.lng, etaMin: etaMinutes(dist),
      });
    }
  }
  res.json({ ok: true });
}));

const snap = (v: number) => Math.round(v / ANON_GRID_DEG) * ANON_GRID_DEG;

/** Build + publish snapshots for every active zone. Started from index.ts. */
export function startSnapshotLoop() {
  setInterval(async () => {
    try {
      const zones = await db.zone.findMany({ where: { active: true } });
      for (const zone of zones) {
        const members = await redis.zrange(geoKey(zone.id), 0, -1);
        if (members.length === 0) continue;

        const workers: ZoneSnapshot['workers'] = [];
        const adminWorkers: ZoneSnapshot['workers'] = [];
        const counts = { idle: 0, enRoute: 0, onJob: 0 };

        for (const member of members) {
          const workerId = member.replace('worker:', '');
          const live = await redis.hgetall(liveKey(workerId));
          if (!live.lat) {
            await redis.zrem(geoKey(zone.id), member); // liveness expired → drop from geo
            continue;
          }
          const duty = (live.duty ?? 'IDLE') as ZoneSnapshot['workers'][number]['duty'];
          if (duty === 'IDLE') counts.idle++;
          else if (duty === 'EN_ROUTE') counts.enRoute++;
          else if (duty === 'ON_JOB') counts.onJob++;

          const worker = await db.worker.findUnique({ where: { id: workerId }, include: { user: true } });
          const skills = worker?.skills ?? [];
          // customer variant: anonymized, idle workers only
          if (duty === 'IDLE') {
            workers.push({ lat: snap(Number(live.lat)), lng: snap(Number(live.lng)), duty, skills });
          }
          // admin variant: everyone, exact
          adminWorkers.push({
            workerId, name: worker?.user.name ?? 'Expert',
            lat: Number(live.lat), lng: Number(live.lng), duty, skills,
          });
        }

        const base = { zoneId: zone.id, counts, at: new Date().toISOString() };
        emitTo(channels.zoneWorkers(zone.id), EV.ZONE_SNAPSHOT, {
          ...base, workers, bestEtaMin: counts.idle > 0 ? 8 : null,
        } satisfies ZoneSnapshot);
        emitTo(channels.adminFirehose(zone.cityId), EV.ZONE_SNAPSHOT, {
          ...base, workers: adminWorkers, bestEtaMin: null,
        } satisfies ZoneSnapshot);
      }
    } catch (err) {
      console.error('snapshot loop error', err);
    }
  }, SNAPSHOT_INTERVAL_MS);
}
