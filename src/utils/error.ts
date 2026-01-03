/**
 * Custom error classes for the Gurucool AI backend
 */
import { HTTP_STATUS } from '../config/constants';
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code: string = 'INTERNAL_ERROR'
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

/**
 * Error thrown when input validation fails
 */
export class ValidationError extends AppError {
  public readonly details: Record<string, string[]>;

  constructor(
    message: string = 'Validation failed',
    details: Record<string, string[]> = {}
  ) {
    super(message, HTTP_STATUS.BAD_REQUEST, 'VALIDATION_ERROR');
    this.details = details;
  }
}

/**
 * Error thrown when authentication or authorization fails
 */
export class AuthError extends AppError {
  constructor(
    message: string = 'Authentication failed',
    statusCode: number = HTTP_STATUS.UNAUTHORIZED,
    code: string = 'AUTH_ERROR'
  ) {
    super(message, statusCode, code);
  }
}

export class AuthRequiredError extends AuthError {
  constructor(message: string = 'Authentication required') {
    super(message, HTTP_STATUS.UNAUTHORIZED, 'AUTH_REQUIRED');
  }
}

export class AuthTokenInvalidError extends AuthError {
  constructor(message: string = 'Authentication token is invalid') {
    super(message, HTTP_STATUS.UNAUTHORIZED, 'AUTH_TOKEN_INVALID');
  }
}

export class AuthUserNotFoundError extends AuthError {
  constructor(message: string = 'User record not found') {
    super(message, HTTP_STATUS.NOT_FOUND, 'AUTH_USER_NOT_FOUND');
  }
}

export class AccountSuspendedError extends AuthError {
  constructor(message: string = 'Account is suspended') {
    super(message, HTTP_STATUS.FORBIDDEN, 'ACCOUNT_SUSPENDED');
  }
}

/**
 * Error thrown when user doesn't have permission to access a resource
 */
export class ForbiddenError extends AppError {
  constructor(
    message: string = 'Access forbidden',
    statusCode: number = HTTP_STATUS.FORBIDDEN,
    code: string = 'FORBIDDEN_ERROR'
  ) {
    super(message, statusCode, code);
  }
}

export class RoleForbiddenError extends ForbiddenError {
  public readonly allowedRoles: string[];

  constructor(allowedRoles: string[], message: string = 'Role not permitted') {
    super(message, HTTP_STATUS.FORBIDDEN, 'ROLE_FORBIDDEN');
    this.allowedRoles = allowedRoles;
  }
}

export class CrossSchoolAccessError extends ForbiddenError {
  constructor(message: string = 'Cross-school access is not allowed') {
    super(message, HTTP_STATUS.FORBIDDEN, 'CROSS_SCHOOL_ACCESS_DENIED');
  }
}

/**
 * Error thrown when a resource is not found
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, HTTP_STATUS.NOT_FOUND, 'NOT_FOUND_ERROR');
  }
}

/**
 * Error thrown when user exceeds their tier limits
 */
export class TierLimitError extends AppError {
  public readonly limit: number;
  public readonly current: number;
  public readonly tier: string;

  constructor(
    message: string = 'Tier limit exceeded',
    limit: number = 0,
    current: number = 0,
    tier: string = 'free'
  ) {
    super(message, HTTP_STATUS.TOO_MANY_REQUESTS, 'TIER_LIMIT_EXCEEDED');
    this.limit = limit;
    this.current = current;
    this.tier = tier;
  }
}

/**
 * Error thrown when a resource already exists
 */
export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists') {
    super(message, HTTP_STATUS.CONFLICT, 'CONFLICT_ERROR');
  }
}

/**
 * Error thrown when rate limit is exceeded
 */
export class RateLimitError extends AppError {
  public readonly resetTime: Date;

  constructor(message: string = 'Rate limit exceeded', resetTime?: Date) {
    super(message, HTTP_STATUS.TOO_MANY_REQUESTS, 'RATE_LIMIT_EXCEEDED');
    this.resetTime = resetTime || new Date(Date.now() + 60 * 1000); // Default to 1 minute from now
  }
}

/**
 * Error thrown for external service failures
 */
export class ExternalServiceError extends AppError {
  public readonly service: string;

  constructor(message: string, service: string = 'external') {
    super(message, HTTP_STATUS.BAD_GATEWAY, 'EXTERNAL_SERVICE_ERROR');
    this.service = service;
  }
}

/**
 * Utility function to determine if an error is operational
 */
export const isOperationalError = (error: Error): boolean => {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
};

/**
 * Utility function to create a validation error from Zod error
 */
export const createValidationError = (zodError: any): ValidationError => {
  const details: Record<string, string[]> = {};

  if (zodError.errors) {
    zodError.errors.forEach((err: any) => {
      const field = err.path.join('.');
      if (!details[field]) {
        details[field] = [];
      }
      details[field].push(err.message);
    });
  }

  return new ValidationError('Validation failed', details);
};
