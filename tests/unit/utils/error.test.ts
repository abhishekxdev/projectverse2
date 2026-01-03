import {
  AppError,
  ValidationError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  TierLimitError,
  ConflictError,
  RateLimitError,
  ExternalServiceError,
  isOperationalError,
  createValidationError,
} from '../../../src/utils/error';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create a basic AppError with default values', () => {
      const error = new AppError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.isOperational).toBe(true);
      expect(error).toBeInstanceOf(Error);
    });

    it('should create an AppError with custom values', () => {
      const error = new AppError('Custom error', 400, 'CUSTOM_ERROR');

      expect(error.message).toBe('Custom error');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('CUSTOM_ERROR');
      expect(error.isOperational).toBe(true);
    });
  });

  describe('ValidationError', () => {
    it('should create a ValidationError with default message', () => {
      const error = new ValidationError();

      expect(error.message).toBe('Validation failed');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details).toEqual({});
    });

    it('should create a ValidationError with custom message and details', () => {
      const details = { field: ['error1', 'error2'] };
      const error = new ValidationError('Custom validation error', details);

      expect(error.message).toBe('Custom validation error');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details).toEqual(details);
    });
  });

  describe('AuthError', () => {
    it('should create an AuthError with default message', () => {
      const error = new AuthError();

      expect(error.message).toBe('Authentication failed');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('AUTH_ERROR');
    });

    it('should create an AuthError with custom message', () => {
      const error = new AuthError('Custom auth error');

      expect(error.message).toBe('Custom auth error');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('AUTH_ERROR');
    });
  });

  describe('ForbiddenError', () => {
    it('should create a ForbiddenError with default message', () => {
      const error = new ForbiddenError();

      expect(error.message).toBe('Access forbidden');
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('FORBIDDEN_ERROR');
    });
  });

  describe('NotFoundError', () => {
    it('should create a NotFoundError with default message', () => {
      const error = new NotFoundError();

      expect(error.message).toBe('Resource not found');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND_ERROR');
    });
  });

  describe('TierLimitError', () => {
    it('should create a TierLimitError with default values', () => {
      const error = new TierLimitError();

      expect(error.message).toBe('Tier limit exceeded');
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('TIER_LIMIT_EXCEEDED');
      expect(error.limit).toBe(0);
      expect(error.current).toBe(0);
      expect(error.tier).toBe('free');
    });

    it('should create a TierLimitError with custom values', () => {
      const error = new TierLimitError('Custom limit error', 10, 8, 'premium');

      expect(error.message).toBe('Custom limit error');
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('TIER_LIMIT_EXCEEDED');
      expect(error.limit).toBe(10);
      expect(error.current).toBe(8);
      expect(error.tier).toBe('premium');
    });
  });

  describe('ConflictError', () => {
    it('should create a ConflictError with default message', () => {
      const error = new ConflictError();

      expect(error.message).toBe('Resource already exists');
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT_ERROR');
    });
  });

  describe('RateLimitError', () => {
    it('should create a RateLimitError with default values', () => {
      const error = new RateLimitError();

      expect(error.message).toBe('Rate limit exceeded');
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.resetTime).toBeInstanceOf(Date);
    });

    it('should create a RateLimitError with custom values', () => {
      const resetTime = new Date('2023-12-25T00:00:00Z');
      const error = new RateLimitError('Custom rate limit error', resetTime);

      expect(error.message).toBe('Custom rate limit error');
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.resetTime).toBe(resetTime);
    });
  });

  describe('ExternalServiceError', () => {
    it('should create an ExternalServiceError with default service', () => {
      const error = new ExternalServiceError('Service error');

      expect(error.message).toBe('Service error');
      expect(error.statusCode).toBe(502);
      expect(error.code).toBe('EXTERNAL_SERVICE_ERROR');
      expect(error.service).toBe('external');
    });

    it('should create an ExternalServiceError with custom service', () => {
      const error = new ExternalServiceError('OpenAI error', 'openai');

      expect(error.message).toBe('OpenAI error');
      expect(error.statusCode).toBe(502);
      expect(error.code).toBe('EXTERNAL_SERVICE_ERROR');
      expect(error.service).toBe('openai');
    });
  });
});

describe('Error Utility Functions', () => {
  describe('isOperationalError', () => {
    it('should return true for AppError instances', () => {
      const error = new AppError('Test error');
      expect(isOperationalError(error)).toBe(true);
    });

    it('should return false for generic Error instances', () => {
      const error = new Error('Generic error');
      expect(isOperationalError(error)).toBe(false);
    });
  });

  describe('createValidationError', () => {
    it('should create ValidationError from Zod-like error', () => {
      const zodError = {
        errors: [
          {
            path: ['field1'],
            message: 'Field1 is required',
          },
          {
            path: ['field2'],
            message: 'Field2 must be a string',
          },
        ],
      };

      const validationError = createValidationError(zodError);

      expect(validationError).toBeInstanceOf(ValidationError);
      expect(validationError.message).toBe('Validation failed');
      expect(validationError.details).toEqual({
        field1: ['Field1 is required'],
        field2: ['Field2 must be a string'],
      });
    });

    it('should handle empty Zod errors', () => {
      const zodError = {
        errors: [],
      };

      const validationError = createValidationError(zodError);

      expect(validationError).toBeInstanceOf(ValidationError);
      expect(validationError.message).toBe('Validation failed');
      expect(validationError.details).toEqual({});
    });

    it('should handle missing errors property', () => {
      const zodError = {};

      const validationError = createValidationError(zodError);

      expect(validationError).toBeInstanceOf(ValidationError);
      expect(validationError.message).toBe('Validation failed');
      expect(validationError.details).toEqual({});
    });
  });
});
