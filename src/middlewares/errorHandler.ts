import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import logger from '../config/logger';
import { env } from '../config/env';
import { ZodError } from 'zod';

/**
 * Global error handling middleware.
 * Normalizes all errors into a consistent JSON response format.
 */
export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  // ─── Zod Validation Errors ────────────────────────────────
  if (err instanceof ZodError) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const zodErr = err as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errors = zodErr.issues.map((e: any) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    res.status(400).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      errors,
    });
    return;
  }

  // ─── Prisma Known Errors ──────────────────────────────────
  if (
    err instanceof Error &&
    'code' in err &&
    typeof err.code === 'string' &&
    err.code.startsWith('P')
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaErr = err as any;
    let statusCode = 500;
    let message = 'Database error';
    let code = 'DATABASE_ERROR';

    switch (prismaErr.code) {
      case 'P2002':
        statusCode = 409;
        message = `Duplicate value for field: ${(prismaErr.meta?.target as string[])?.join(', ')}`;
        code = 'DUPLICATE_ENTRY';
        break;
      case 'P2025':
        statusCode = 404;
        message = 'Record not found';
        code = 'NOT_FOUND';
        break;
      default:
        break;
    }

    res.status(statusCode).json({
      success: false,
      code,
      message,
    });
    return;
  }

  // ─── Operational AppErrors ────────────────────────────────
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      code: err.code,
      message: err.message,
      ...(env.NODE_ENV === 'development' && { stack: err.stack }),
    });
    return;
  }

  // ─── Unexpected / Programming Errors ──────────────────────
  logger.error({ err }, '💥 Unhandled error');

  res.status(500).json({
    success: false,
    code: 'INTERNAL_ERROR',
    message: env.NODE_ENV === 'production' ? 'Something went wrong' : err.message,
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

/**
 * Catch 404 and forward to error handler.
 */
export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
};
