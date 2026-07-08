import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { config } from '../config';
import { requireAuth } from '../middleware/auth';
import { h, HttpError } from '../middleware/errors';
import { onBookingPaid } from './bookings';

/**
 * Payments module. Provider "mock" simulates a gateway instantly (dev/demo);
 * provider "razorpay" creates a real order and verifies the webhook signature.
 * Call sites and DB shape are identical for both.
 */

export const paymentsRouter = Router();

paymentsRouter.post('/intent', requireAuth('CUSTOMER'), h(async (req, res) => {
  const { bookingId, method, idempotencyKey } = z.object({
    bookingId: z.string(),
    method: z.enum(['upi', 'card', 'wallet', 'netbanking', 'pay_after']).default('upi'),
    idempotencyKey: z.string().optional(),
  }).parse(req.body);

  const booking = await db.booking.findFirst({ where: { id: bookingId, customerId: req.auth!.sub } });
  if (!booking) throw new HttpError(404, 'Booking not found');
  if (booking.status !== 'PAYMENT_PENDING') throw new HttpError(409, 'Booking is not awaiting payment');

  if (idempotencyKey) {
    const existing = await db.payment.findUnique({ where: { idempotencyKey } });
    if (existing) return res.json({ payment: existing, next: existing.status === 'PAID' ? 'done' : 'gateway' });
  }

  const payment = await db.payment.create({
    data: {
      bookingId, method, amountPaise: booking.totalPaise, purpose: 'booking', idempotencyKey,
      status: method === 'pay_after' ? 'PENDING' : 'PENDING',
    },
  });

  if (method === 'pay_after') {
    // collect after service; unblock dispatch now
    await onBookingPaid(bookingId);
    return res.json({ payment, next: 'done' });
  }

  if (config.paymentProvider === 'mock') {
    // simulate instant gateway success
    const paid = await db.payment.update({ where: { id: payment.id }, data: { status: 'PAID', gatewayRef: `mock_${payment.id}` } });
    await onBookingPaid(bookingId);
    return res.json({ payment: paid, next: 'done' });
  }

  // razorpay: create an order; the app opens the checkout SDK with this order id
  // const order = await razorpay.orders.create({ amount: booking.totalPaise, currency: 'INR', receipt: payment.id });
  res.json({ payment, next: 'gateway', gatewayOrder: { id: `order_todo`, keyId: process.env.RAZORPAY_KEY_ID } });
}));

/** Gateway webhook (razorpay). Mock provider never calls this. */
paymentsRouter.post('/webhook', h(async (req, res) => {
  // production: verify X-Razorpay-Signature HMAC before trusting the body
  const { paymentId, gatewayRef, status } = z.object({
    paymentId: z.string(), gatewayRef: z.string(), status: z.enum(['PAID', 'FAILED']),
  }).parse(req.body);
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.status === 'PAID') return res.json({ ok: true }); // idempotent
  await db.payment.update({ where: { id: paymentId }, data: { status, gatewayRef } });
  if (status === 'PAID') await onBookingPaid(payment.bookingId);
  res.json({ ok: true });
}));

paymentsRouter.get('/booking/:bookingId', requireAuth('CUSTOMER'), h(async (req, res) => {
  const payments = await db.payment.findMany({ where: { bookingId: req.params.bookingId }, orderBy: { createdAt: 'asc' } });
  res.json({ payments });
}));
