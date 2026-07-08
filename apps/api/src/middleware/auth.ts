import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface AuthClaims {
  sub: string; // user id (or admin id for admins)
  role: 'CUSTOMER' | 'WORKER' | 'ADMIN';
  adminRole?: string;
  cityId?: string | null;
  hubId?: string | null;
  workerId?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthClaims;
    }
  }
}

export function signToken(claims: AuthClaims): string {
  return jwt.sign(claims, config.jwtSecret, { expiresIn: '30d' });
}

export function verifyToken(token: string): AuthClaims | null {
  try {
    return jwt.verify(token, config.jwtSecret) as AuthClaims;
  } catch {
    return null;
  }
}

export function requireAuth(...roles: Array<AuthClaims['role']>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.replace(/^Bearer /, '');
    const claims = token ? verifyToken(token) : null;
    if (!claims) return res.status(401).json({ error: 'Unauthorized' });
    if (roles.length && !roles.includes(claims.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    req.auth = claims;
    next();
  };
}

/** Admin-only, optionally restricted to specific admin roles. SUPER_ADMIN always passes. */
export function requireAdmin(...adminRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.replace(/^Bearer /, '');
    const claims = token ? verifyToken(token) : null;
    if (!claims || claims.role !== 'ADMIN') return res.status(401).json({ error: 'Unauthorized' });
    if (adminRoles.length && claims.adminRole !== 'SUPER_ADMIN' && !adminRoles.includes(claims.adminRole ?? '')) {
      return res.status(403).json({ error: 'Forbidden for role ' + claims.adminRole });
    }
    req.auth = claims;
    next();
  };
}
