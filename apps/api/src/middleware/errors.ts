import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

/** Wrap async handlers so thrown errors reach the error middleware. */
export const h = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => fn(req, res).catch(next);

export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, code: err.code });
  if (err instanceof ZodError) return res.status(400).json({ error: err.errors.map(e => e.message).join('; ') });
  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
}
