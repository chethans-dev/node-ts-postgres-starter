import type { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import type { AuthenticatedRequest, JwtPayload } from '../interfaces';

/**
 * JWT authentication middleware.
 * Verifies the Bearer token from the Authorization header.
 */
export const authenticate = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw AppError.unauthorized('Missing or invalid authorization header');
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch {
    throw AppError.unauthorized('Invalid or expired token');
  }
};

/**
 * Role-based access control middleware.
 * Must be used AFTER the authenticate middleware.
 *
 * Usage: router.get('/admin', authenticate, authorize('ADMIN'), controller)
 */
export const authorize = (...roles: string[]) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw AppError.unauthorized('Authentication required');
    }

    if (!roles.includes(req.user.role)) {
      throw AppError.forbidden('You do not have permission to access this resource');
    }

    next();
  };
};
