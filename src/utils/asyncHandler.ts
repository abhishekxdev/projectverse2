import { Request, Response, NextFunction } from 'express';

/**
 * Wraps an async route handler to catch errors and forward them to the next middleware.
 * Ensures all async failures hit the global error handler.
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
