import { Router } from 'express';
import { z } from 'zod';
import {
  ANON_GRID_DEG, channels, EV, SNAPSHOT_INTERVAL_MS, WORKER_LIVENESS_TTL_S, type ZoneSnapshot,
} from '@pronto/shared';
import { db } from '../db';
import { anchorKey, geoKey, liveKey, routeKey, redis } from '../redis';

/** How long the simulated worker takes to reach the customer (dev only). */
const ROUTE_TRAVEL_MS = 90_000;
import { emitTo } from '../realtime/gateway';
import { requireAuth } from '../middleware/auth';
import { h } from '../middleware/errors';
import { etaMinutes, pointInPolygon } from '../lib/geo';
import { config } from '../config';

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
  let last = points[points.length - 1];

  const worker = await db.worker.findUnique({
    where: { id: workerId },
    include: { hub: { include: { zone: true } } },
  });
  if (!worker || worker.duty === 'OFF_DUTY') return res.json({ ok: true, ignored: true });

  // Dev accommodation (production keeps real coordinates untouched):
  //  • EN_ROUTE → animate along the stored route toward the customer's door.
  //  • otherwise → cluster near the active customer so the expert shows up next
  //    to them (falling back to snapping into the hub zone).
  if (config.isDev && worker.hub?.zoneId) {
    if (worker.duty === 'EN_ROUTE') {
      const b = await db.booking.findFirst({ where: { workerId, status: 'EN_ROUTE' }, select: { id: true } });
      const raw = b && await redis.get(routeKey(b.id));
      if (raw) {
        const r = JSON.parse(raw) as { startLat: number; startLng: number; destLat: number; destLng: number; startAt: number };
        const frac = Math.min(1, (Date.now() - r.startAt) / ROUTE_TRAVEL_MS);
        last = { lat: r.startLat + (r.destLat - r.startLat) * frac, lng: r.startLng + (r.destLng - r.startLng) * frac };
      }
    } else {
      const raw = await redis.get(anchorKey(worker.hub.zoneId));
      if (raw) {
        const a = JSON.parse(raw) as { lat: number; lng: number };
        last = { lat: a.lat + (Math.random() - 0.5) * 0.003, lng: a.lng + (Math.random() - 0.5) * 0.003 };
      } else if (worker.hub.zone && !pointInPolygon(last.lat, last.lng, worker.hub.zone.polygon as number[][])) {
        last = { lat: worker.hub.lat + (Math.random() - 0.5) * 0.004, lng: worker.hub.lng + (Math.random() - 0.5) * 0.004 };
      }
    }
  }

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

// A ring of offsets (~150–350m) placing demo experts around the customer.
const DEMO_OFFSETS = [
  [0.0022, 0.0011], [-0.0018, 0.0025], [0.0009, -0.0026], [-0.0027, -0.0009],
];

/** Dev-only: keep a few idle "demo" experts alive around the active customer so
 *  the map is never empty. They are visual only — dispatch skips them (no DB row). */
async function ensureDemoExperts(zoneId: string) {
  if (!config.isDev) return;
  const raw = await redis.get(anchorKey(zoneId));
  if (!raw) return;
  const a = JSON.parse(raw) as { lat: number; lng: number };
  for (let i = 0; i < DEMO_OFFSETS.length; i++) {
    const lat = a.lat + DEMO_OFFSETS[i][0];
    const lng = a.lng + DEMO_OFFSETS[i][1];
    const id = `demo${i}`;
    await redis.geoadd(geoKey(zoneId), lng, lat, `worker:${id}`);
    await redis.hset(liveKey(id), { lat, lng, duty: 'IDLE', idleSince: Date.now(), zoneId });
    await redis.expire(liveKey(id), WORKER_LIVENESS_TTL_S);
  }
}

/** Push live snapshot for a specific zone to connected clients. */
export async function pushSnapshotForZone(zoneId: string) {
  const zone = await db.zone.findUnique({ where: { id: zoneId } });
  if (!zone || !zone.active) return;
  await ensureDemoExperts(zone.id);
  const members = await redis.zrange(geoKey(zone.id), 0, -1);

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

/** Build + publish snapshots for every active zone. Started from index.ts. */
export function startSnapshotLoop() {
  setInterval(async () => {
    try {
      const zones = await db.zone.findMany({ where: { active: true } });
      for (const zone of zones) {
        await pushSnapshotForZone(zone.id);
      }
    } catch (err) {
      console.error('snapshot loop error', err);
    }
  }, SNAPSHOT_INTERVAL_MS);
}
