import { Response } from 'express';
import {
  AppError,
  ValidationError,
  TierLimitError,
  RateLimitError,
} from './error';
import { HTTP_STATUS } from '../config/constants';
import { ApiResponse, PaginationMeta } from '../types/api.types';

/**
 * Helper function to create a successful response
 */
export const successResponse = <T>(
  res: Response,
  data: T,
  statusCode: number = HTTP_STATUS.OK,
  meta?: Partial<PaginationMeta>
): Response => {
  const response: ApiResponse<T> = {
    success: true,
    data,
  };

  if (meta) {
    response.meta = {
      page: meta.page,
      limit: meta.limit,
      total: meta.total,
      totalPages: meta.totalPages,
      hasNext: meta.hasNext,
      hasPrev: meta.hasPrev,
    };
  }

  return res.status(statusCode).json(response);
};

/**
 * Helper function to create an error response
 */
export const errorResponse = (
  res: Response,
  error: AppError | Error,
  statusCode?: number
): Response => {
  const response: ApiResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  };

  if (error instanceof AppError) {
    response.error!.code = error.code;
    response.error!.message = error.message;

    // Include additional details for specific error types
    if (error instanceof ValidationError && error.details) {
      response.error!.details = error.details;
    }

    if (error instanceof TierLimitError) {
      response.error!.details = {
        limit: error.limit,
        current: error.current,
        tier: error.tier,
      };
    }

    if (error instanceof RateLimitError) {
      response.error!.details = {
        resetTime: error.resetTime.toISOString(),
      };
    }

    return res.status(error.statusCode).json(response);
  }

  // For generic Error objects
  response.error!.code = 'INTERNAL_ERROR';
  response.error!.message =
    process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : error.message;

  const status = statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  return res.status(status).json(response);
};

/**
 * Helper function to create a paginated response
 */
export const paginatedResponse = <T>(
  res: Response,
  data: T[],
  page: number,
  limit: number,
  total: number,
  statusCode: number = HTTP_STATUS.OK
): Response => {
  const totalPages = Math.ceil(total / limit);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  const meta: PaginationMeta = {
    page,
    limit,
    total,
    totalPages,
    hasNext,
    hasPrev,
  };

  return successResponse(res, data, statusCode, meta);
};

/**
 * Helper function to create a created response (201)
 */
export const createdResponse = <T>(res: Response, data: T): Response => {
  return successResponse(res, data, HTTP_STATUS.CREATED);
};

/**
 * Helper function to create a no content response (204)
 */
export const noContentResponse = (res: Response): Response => {
  return res.status(HTTP_STATUS.NO_CONTENT).send();
};

/**
 * Helper function to create a bad request response (400)
 */
export const badRequestResponse = (
  res: Response,
  message: string = 'Bad request',
  details?: any
): Response => {
  const response: ApiResponse = {
    success: false,
    error: {
      code: 'BAD_REQUEST',
      message,
      ...(details && { details }),
    },
  };

  return res.status(HTTP_STATUS.BAD_REQUEST).json(response);
};

/**
 * Helper function to create an unauthorized response (401)
 */
export const unauthorizedResponse = (
  res: Response,
  message: string = 'Unauthorized'
): Response => {
  const response: ApiResponse = {
    success: false,
    error: {
      code: 'UNAUTHORIZED',
      message,
    },
  };

  return res.status(HTTP_STATUS.UNAUTHORIZED).json(response);
};

/**
 * Helper function to create a forbidden response (403)
 */
export const forbiddenResponse = (
  res: Response,
  message: string = 'Forbidden'
): Response => {
  const response: ApiResponse = {
    success: false,
    error: {
      code: 'FORBIDDEN',
      message,
    },
  };

  return res.status(HTTP_STATUS.FORBIDDEN).json(response);
};

/**
 * Helper function to create a not found response (404)
 */
export const notFoundResponse = (
  res: Response,
  message: string = 'Resource not found'
): Response => {
  const response: ApiResponse = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message,
    },
  };

  return res.status(HTTP_STATUS.NOT_FOUND).json(response);
};

/**
 * Helper function to create a conflict response (409)
 */
export const conflictResponse = (
  res: Response,
  message: string = 'Conflict'
): Response => {
  const response: ApiResponse = {
    success: false,
    error: {
      code: 'CONFLICT',
      message,
    },
  };

  return res.status(HTTP_STATUS.CONFLICT).json(response);
};

/**
 * Helper function to create a rate limit exceeded response (429)
 */
export const rateLimitResponse = (
  res: Response,
  message: string = 'Rate limit exceeded',
  resetTime?: Date
): Response => {
  const response: ApiResponse = {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message,
      ...(resetTime && { details: { resetTime: resetTime.toISOString() } }),
    },
  };

  const headers: Record<string, string> = {};
  if (resetTime) {
    headers['X-RateLimit-Reset'] = Math.ceil(
      resetTime.getTime() / 1000
    ).toString();
  }

  return res.status(HTTP_STATUS.TOO_MANY_REQUESTS).set(headers).json(response);
};

/**
 * Helper function to create an internal server error response (500)
 */
export const internalServerErrorResponse = (
  res: Response,
  message: string = 'Internal server error'
): Response => {
  const response: ApiResponse = {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message:
        process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : message,
    },
  };

  return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(response);
};
