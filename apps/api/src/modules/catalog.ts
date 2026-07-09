import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { config } from '../config';
import { anchorKey, redis } from '../redis';
import { requireAuth } from '../middleware/auth';
import { h, HttpError } from '../middleware/errors';
import { pointInPolygon } from '../lib/geo';

export const catalogRouter = Router();

/** Serviceability check: which zone (if any) covers this point. Public. */
export async function zoneForPoint(lat: number, lng: number) {
  const zones = await db.zone.findMany({ where: { active: true }, include: { city: true } });
  return zones.find(z => pointInPolygon(lat, lng, z.polygon as number[][])) ?? null;
}

async function setAnchor(zoneId: string, lat: number, lng: number) {
  if (config.isDev) await redis.set(anchorKey(zoneId), JSON.stringify({ lat, lng }), 'EX', 3600);
}

catalogRouter.get('/serviceability', h(async (req, res) => {
  const { lat, lng } = z.object({ lat: z.coerce.number(), lng: z.coerce.number() }).parse(req.query);
  let zone = await zoneForPoint(lat, lng);
  // In dev, treat anywhere as serviceable (fall back to the demo zone) so the
  // app works regardless of the tester's real location.
  if (!zone && config.isDev) {
    zone = await db.zone.findFirst({ where: { active: true }, include: { city: true } });
  }
  if (zone) await setAnchor(zone.id, lat, lng);
  res.json(zone
    ? { serviceable: true, zone: { id: zone.id, name: zone.name, cityId: zone.cityId, cityName: zone.city.name } }
    : { serviceable: false, zone: null });
}));

/** Customer reports its live location so nearby experts anchor to it (dev demo). */
catalogRouter.post('/anchor', requireAuth('CUSTOMER'), h(async (req, res) => {
  const { zoneId, lat, lng } = z.object({ zoneId: z.string(), lat: z.number(), lng: z.number() }).parse(req.body);
  await setAnchor(zoneId, lat, lng);
  res.json({ ok: true });
}));

catalogRouter.get('/services', h(async (_req, res) => {
  const services = await db.service.findMany({ where: { active: true }, orderBy: { order: 'asc' } });
  res.json({ services });
}));

catalogRouter.get('/pricing', h(async (req, res) => {
  const { cityId } = z.object({ cityId: z.string() }).parse(req.query);
  const pricing = await db.pricing.findMany({ where: { cityId }, orderBy: { durationMin: 'asc' } });
  res.json({ pricing });
}));

catalogRouter.get('/banners', h(async (_req, res) => {
  const banners = await db.banner.findMany({ where: { active: true }, orderBy: { order: 'asc' } });
  res.json({ banners });
}));

/** Price quote with coupon + surge applied. Used by the review step before booking. */
export async function computeQuote(opts: {
  cityId: string; durationMin: number; couponCode?: string | null; customerId?: string;
}) {
  const price = await db.pricing.findUnique({
    where: { cityId_durationMin: { cityId: opts.cityId, durationMin: opts.durationMin } },
  });
  if (!price) throw new HttpError(400, `No pricing for ${opts.durationMin} min in this city`);

  const basePaise = Math.round(price.pricePaise * price.surgeMultiplier);
  let discountPaise = 0;
  let couponCode: string | null = null;

  if (opts.couponCode) {
    const coupon = await db.coupon.findUnique({ where: { code: opts.couponCode.toUpperCase() } });
    if (!coupon || !coupon.active) throw new HttpError(400, 'Invalid coupon');
    if (coupon.expiresAt && coupon.expiresAt < new Date()) throw new HttpError(400, 'Coupon expired');
    if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) throw new HttpError(400, 'Coupon exhausted');
    if (basePaise < coupon.minOrderPaise) throw new HttpError(400, 'Order below coupon minimum');
    if (coupon.firstBookingOnly && opts.customerId) {
      const prior = await db.booking.count({ where: { customerId: opts.customerId, status: { notIn: ['CANCELLED_CUSTOMER', 'CANCELLED_SYSTEM', 'NO_EXPERT_FOUND'] } } });
      if (prior > 0) throw new HttpError(400, 'Coupon valid on first booking only');
    }
    discountPaise = Math.min(
      coupon.discountPaise + Math.round((basePaise * coupon.discountPct) / 100),
      coupon.maxDiscountPaise,
    );
    couponCode = coupon.code;
  }

  return {
    durationMin: opts.durationMin,
    basePaise,
    surgeMultiplier: price.surgeMultiplier,
    discountPaise,
    totalPaise: Math.max(0, basePaise - discountPaise),
    couponCode,
  };
}

catalogRouter.get('/quote', h(async (req, res) => {
  const q = z.object({
    cityId: z.string(),
    durationMin: z.coerce.number(),
    coupon: z.string().optional(),
  }).parse(req.query);
  res.json(await computeQuote({ cityId: q.cityId, durationMin: q.durationMin, couponCode: q.coupon }));
}));
