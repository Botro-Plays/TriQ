import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    role: string;
    phone: string;
  };
}

// Verify JWT from Authorization header and attach decoded payload to req.user
export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization header required' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as any;
    req.user = { userId: decoded.userId, role: decoded.role, phone: decoded.phone };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Optional auth — attaches user if token present, but doesn't reject
export const optionalAuth = (req: AuthRequest, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as any;
      req.user = { userId: decoded.userId, role: decoded.role, phone: decoded.phone };
    } catch {
      // Ignore — no user attached
    }
  }
  next();
};

// Role-based guard — requires authMiddleware to run first
export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
};
