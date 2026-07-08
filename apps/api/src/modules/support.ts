import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { h, HttpError } from '../middleware/errors';

/** Support tickets: customer & worker raise; support agents work the queue. */

export const supportRouter = Router();

// ── User side ──
supportRouter.post('/tickets', requireAuth('CUSTOMER', 'WORKER'), h(async (req, res) => {
  const { subject, body, bookingId } = z.object({
    subject: z.string().min(3), body: z.string().min(3), bookingId: z.string().optional(),
  }).parse(req.body);
  const ticket = await db.ticket.create({
    data: {
      userId: req.auth!.sub, bookingId, subject,
      messages: { create: { author: `user:${req.auth!.sub}`, body } },
    },
    include: { messages: true },
  });
  res.json({ ticket });
}));

supportRouter.get('/tickets', requireAuth('CUSTOMER', 'WORKER'), h(async (req, res) => {
  const tickets = await db.ticket.findMany({
    where: { userId: req.auth!.sub },
    include: { messages: { orderBy: { at: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ tickets });
}));

supportRouter.post('/tickets/:id/messages', requireAuth('CUSTOMER', 'WORKER'), h(async (req, res) => {
  const { body } = z.object({ body: z.string().min(1) }).parse(req.body);
  const ticket = await db.ticket.findFirst({ where: { id: req.params.id, userId: req.auth!.sub } });
  if (!ticket) throw new HttpError(404, 'Ticket not found');
  const message = await db.ticketMessage.create({
    data: { ticketId: ticket.id, author: `user:${req.auth!.sub}`, body },
  });
  res.json({ message });
}));

// ── Admin side ──
supportRouter.get('/admin/tickets', requireAdmin('SUPPORT', 'CITY_OPS'), h(async (req, res) => {
  const status = (req.query.status as string) ?? 'OPEN';
  const tickets = await db.ticket.findMany({
    where: status === 'ALL' ? {} : { status: status as never },
    include: { user: { select: { name: true, phone: true, role: true } }, messages: { orderBy: { at: 'asc' } } },
    orderBy: { createdAt: 'desc' }, take: 100,
  });
  res.json({ tickets });
}));

supportRouter.post('/admin/tickets/:id/reply', requireAdmin('SUPPORT', 'CITY_OPS'), h(async (req, res) => {
  const { body, status } = z.object({
    body: z.string().min(1),
    status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  }).parse(req.body);
  await db.ticketMessage.create({
    data: { ticketId: req.params.id, author: `admin:${req.auth!.sub}`, body },
  });
  const ticket = await db.ticket.update({
    where: { id: req.params.id },
    data: { assignedTo: req.auth!.sub, ...(status ? { status } : {}) },
    include: { messages: { orderBy: { at: 'asc' } } },
  });
  res.json({ ticket });
}));
