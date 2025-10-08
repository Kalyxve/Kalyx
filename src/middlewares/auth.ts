import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthUser {
  id?: number;
  sub?: number;
  role?: 'admin' | 'seller' | string;
  email?: string;
  name?: string;
}

// ✅ Usamos type en lugar de interface para evitar el conflicto
export type AuthRequest = Request & {
  user?: Partial<AuthUser>;
};

// ✅ Middleware para verificar el token
export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET || 'secret'
    ) as any;

    req.user = {
      id: payload.id ?? payload.sub,
      sub: payload.sub,
      role: payload.role,
      email: payload.email,
      name: payload.name,
    };

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// ✅ Middleware para restringir acceso a admin
export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const user = req.user;
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};
