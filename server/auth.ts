import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db, User } from './db';

const JWT_SECRET = process.env.APP_SECRET || 'zyrocloud_development_secret_key_change_in_production_min32chars';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export function generateToken(user: User): string {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: '72h' }
  );
}

export function verifyToken(token: string): User | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string; role: string };
    const user = db.users.find((u) => u.id === payload.sub);
    if (!user || !user.is_active) return null;
    return user;
  } catch (err) {
    return null;
  }
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ detail: 'Authentication token required.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string; role: string };
    const user = db.users.find((u) => u.id === payload.sub);
    if (!user || !user.is_active) {
      return res.status(401).json({ detail: 'User is inactive or not found.' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ detail: 'Invalid or expired token.' });
  }
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ detail: 'Access Denied: Administrator privileges required.' });
    }
    next();
  });
}

export function requireServerAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    const serverId = req.params.server_id || req.params.id;
    const server = db.servers.find((s) => s.id === serverId);
    if (!server) {
      return res.status(404).json({ detail: 'Server not found.' });
    }

    if (req.user?.role === 'ADMIN' || server.owner_id === req.user?.id) {
      return next();
    }

    return res.status(403).json({ detail: 'Access Denied: You are not authorized to manage this server.' });
  });
}
