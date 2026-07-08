import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { redis } from '../redis';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { h, HttpError } from '../middleware/errors';

/**
 * Earnings & payouts: per-job earnings with incentive rules, worker-facing
 * summaries, and maker-checker payout runs for finance.
 */

/** Create the earning row when a booking completes; returns worker to IDLE. */
export async function settleCompletion(bookingId: string) {
  const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
  if (!booking.workerId) return;

  const basePaise = Math.round(booking.basePaise * 0.65) + Math.round(booking.extensionPaise * 0.65);

  // incentive: jobs-per-day streak rules
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const jobsToday = await db.earning.count({
    where: { workerId: booking.workerId, createdAt: { gte: startOfDay } },
  }) + 1;
  const rules = await db.incentiveRule.findMany({ where: { active: true } });
  const incentivePaise = rules
    .filter(r => jobsToday === r.jobsTarget)
    .reduce((sum, r) => sum + r.bonusPaise, 0);

  await db.earning.create({
    data: {
      workerId: booking.workerId, bookingId,
      basePaise, incentivePaise, tipPaise: booking.tipPaise,
      totalPaise: basePaise + incentivePaise + booking.tipPaise,
    },
  });
  await db.worker.update({
    where: { id: booking.workerId },
    data: { duty: 'IDLE', jobsDone: { increment: 1 } },
  });
  await redis.hset(`worker:${booking.workerId}:live`, 'duty', 'IDLE', 'idleSince', Date.now());
}

export const earningsRouter = Router();

// ── Worker-facing ──
earningsRouter.get('/summary', requireAuth('WORKER'), h(async (req, res) => {
  const workerId = req.auth!.workerId!;
  const now = new Date();
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(startOfDay); startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const sum = async (gte: Date) => {
    const agg = await db.earning.aggregate({
      where: { workerId, createdAt: { gte } }, _sum: { totalPaise: true, tipPaise: true }, _count: true,
    });
    return { total: agg._sum.totalPaise ?? 0, tips: agg._sum.tipPaise ?? 0, count: agg._count };
  };
  const [today, week, month] = await Promise.all([sum(startOfDay), sum(startOfWeek), sum(startOfMonth)]);
  const rule = await db.incentiveRule.findFirst({ where: { active: true } });

  res.json({
    todayPaise: today.total, weekPaise: week.total, monthPaise: month.total,
    jobsToday: today.count, tipsPaise: today.tips,
    incentiveProgress: rule
      ? { target: rule.jobsTarget, done: today.count, bonusPaise: rule.bonusPaise }
      : { target: 0, done: 0, bonusPaise: 0 },
  });
}));

earningsRouter.get('/history', requireAuth('WORKER'), h(async (req, res) => {
  const earnings = await db.earning.findMany({
    where: { workerId: req.auth!.workerId! },
    orderBy: { createdAt: 'desc' }, take: 100,
    include: { booking: { select: { tasks: true, durationMin: true, completedAt: true } } },
  });
  res.json({ earnings });
}));

// ── Finance-facing (maker-checker) ──
earningsRouter.post('/payout-runs', requireAdmin('FINANCE'), h(async (req, res) => {
  const { cycleLabel } = z.object({ cycleLabel: z.string() }).parse(req.body);
  const unpaid = await db.earning.findMany({ where: { payoutRunId: null } });
  const total = unpaid.reduce((s, e) => s + e.totalPaise, 0);
  const run = await db.payoutRun.create({
    data: { cycleLabel, totalPaise: total, createdBy: req.auth!.sub },
  });
  await db.earning.updateMany({ where: { payoutRunId: null }, data: { payoutRunId: run.id } });
  res.json({ run, earningsCount: unpaid.length });
}));

earningsRouter.post('/payout-runs/:id/approve', requireAdmin('FINANCE'), h(async (req, res) => {
  const run = await db.payoutRun.findUnique({ where: { id: req.params.id } });
  if (!run) throw new HttpError(404, 'Run not found');
  if (run.createdBy === req.auth!.sub) throw new HttpError(403, 'Maker cannot approve their own run');
  if (run.status !== 'DRAFT') throw new HttpError(409, 'Run is not in draft');
  const updated = await db.payoutRun.update({
    where: { id: run.id }, data: { status: 'APPROVED', approvedBy: req.auth!.sub },
  });
  res.json({ run: updated });
}));

earningsRouter.post('/payout-runs/:id/disburse', requireAdmin('FINANCE'), h(async (req, res) => {
  const run = await db.payoutRun.findUnique({ where: { id: req.params.id } });
  if (!run || run.status !== 'APPROVED') throw new HttpError(409, 'Run must be approved first');
  // production: RazorpayX bulk payout API call per worker here
  const updated = await db.payoutRun.update({ where: { id: run.id }, data: { status: 'DISBURSED' } });
  res.json({ run: updated });
}));

earningsRouter.get('/payout-runs', requireAdmin('FINANCE', 'SUPER_ADMIN'), h(async (_req, res) => {
  const runs = await db.payoutRun.findMany({ orderBy: { createdAt: 'desc' }, include: { _count: { select: { earnings: true } } } });
  res.json({ runs });
}));
