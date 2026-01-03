import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { AppError } from '../utils/error';
import { errorResponse } from '../utils/response';
import { HTTP_STATUS } from '../config/constants';

/**
 * Global error handler middleware
 * Catches all errors and formats consistent error responses
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Create a request-specific logger
  const requestLogger = logger.child({
    requestId: req.requestId,
    userId: req.user?.id,
    method: req.method,
    path: req.path,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
  });

  // Log the error with context
  if (error instanceof AppError) {
    // Log operational errors with info level
    requestLogger.error(error.message, error, {
      statusCode: error.statusCode,
      code: error.code,
      isOperational: error.isOperational,
    });
  } else {
    // Log unexpected errors with error level
    requestLogger.error('Unexpected error occurred', error, {
      isOperational: false,
    });
  }

  // Don't send response if headers already sent
  if (res.headersSent) {
    return next(error);
  }

  // Handle different error types
  if (error instanceof AppError) {
    // For operational errors, use the error response helper
    errorResponse(res, error);
  } else if (error.name === 'ValidationError') {
    // Handle validation errors (e.g., from Zod)
    const validationError = new AppError(
      error.message,
      HTTP_STATUS.BAD_REQUEST,
      'VALIDATION_ERROR'
    );
    errorResponse(res, validationError);
  } else if (error.name === 'CastError') {
    // Handle MongoDB/Firestore cast errors
    const castError = new AppError(
      'Invalid ID format',
      HTTP_STATUS.BAD_REQUEST,
      'INVALID_ID'
    );
    errorResponse(res, castError);
  } else if ((error as any).code === 11000) {
    // Handle MongoDB duplicate key errors
    const duplicateError = new AppError(
      'Resource already exists',
      HTTP_STATUS.CONFLICT,
      'DUPLICATE_RESOURCE'
    );
    errorResponse(res, duplicateError);
  } else if (error.name === 'JsonWebTokenError') {
    // Handle JWT errors
    const jwtError = new AppError(
      'Invalid authentication token',
      HTTP_STATUS.UNAUTHORIZED,
      'INVALID_TOKEN'
    );
    errorResponse(res, jwtError);
  } else if (error.name === 'TokenExpiredError') {
    // Handle expired JWT tokens
    const expiredError = new AppError(
      'Authentication token expired',
      HTTP_STATUS.UNAUTHORIZED,
      'TOKEN_EXPIRED'
    );
    errorResponse(res, expiredError);
  } else {
    // Handle all other unexpected errors
    const unexpectedError = new AppError(
      process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : error.message,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      'INTERNAL_ERROR'
    );
    errorResponse(res, unexpectedError);
  }
};

/**
 * Async error wrapper for route handlers
 * Catches errors from async functions and passes them to the error handler
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 Not Found handler
 * Handles requests to undefined routes
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const error = new AppError(
    `Route ${req.method} ${req.path} not found`,
    HTTP_STATUS.NOT_FOUND,
    'NOT_FOUND'
  );

  next(error);
};

/**
 * Process unhandled promise rejections
 */
export const setupUnhandledRejectionHandler = (): void => {
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Promise Rejection', new Error(reason), {
      promise: promise.toString(),
    });

    // In production, you might want to exit the process
    if (process.env.NODE_ENV === 'production') {
      // Don't exit immediately, give time for logging
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    }
  });
};

/**
 * Process uncaught exceptions
 */
export const setupUncaughtExceptionHandler = (): void => {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', error, {
      isFatal: true,
    });

    // Exit the process immediately
    process.exit(1);
  });
};

/**
 * Setup all error handlers
 */
export const setupErrorHandlers = (): void => {
  setupUnhandledRejectionHandler();
  setupUncaughtExceptionHandler();
};
