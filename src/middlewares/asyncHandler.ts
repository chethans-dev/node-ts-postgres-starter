import type { Request, Response, NextFunction } from 'express';

/**
 * Wraps an async route handler to automatically catch errors
 * and pass them to Express error handling middleware.
 *
 * Usage: router.get('/path', asyncHandler(myController.method));
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
