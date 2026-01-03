import { Response } from 'express';
import {
  successResponse,
  errorResponse,
  paginatedResponse,
  createdResponse,
  noContentResponse,
  badRequestResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  conflictResponse,
  rateLimitResponse,
  internalServerErrorResponse,
} from '../../../src/utils/response';
import {
  AppError,
  ValidationError,
  TierLimitError,
} from '../../../src/utils/error';

describe('Response Helpers', () => {
  let mockRes: Partial<Response>;
  let jsonSpy: jest.Mock;
  let statusSpy: jest.Mock;
  let sendSpy: jest.Mock;
  let setSpy: jest.Mock;

  beforeEach(() => {
    jsonSpy = jest.fn();
    statusSpy = jest.fn().mockReturnThis();
    sendSpy = jest.fn();
    setSpy = jest.fn().mockReturnThis();

    mockRes = {
      status: statusSpy,
      json: jsonSpy,
      send: sendSpy,
      set: setSpy,
    };
  });

  describe('successResponse', () => {
    it('should return a success response with data', () => {
      const data = { id: 1, name: 'Test' };
      successResponse(mockRes as Response, data);

      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data,
      });
    });

    it('should return a success response with custom status code', () => {
      const data = { id: 1 };
      successResponse(mockRes as Response, data, 201);

      expect(statusSpy).toHaveBeenCalledWith(201);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data,
      });
    });

    it('should include pagination metadata when provided', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const meta = {
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      };

      successResponse(mockRes as Response, data, 200, meta);

      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data,
        meta,
      });
    });
  });

  describe('errorResponse', () => {
    it('should handle AppError instances', () => {
      const error = new ValidationError('Validation failed', {
        field: ['error'],
      });
      errorResponse(mockRes as Response, error);

      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: { field: ['error'] },
        },
      });
    });

    it('should handle TierLimitError with details', () => {
      const error = new TierLimitError('Limit exceeded', 10, 8, 'free');
      errorResponse(mockRes as Response, error);

      expect(statusSpy).toHaveBeenCalledWith(429);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'TIER_LIMIT_EXCEEDED',
          message: 'Limit exceeded',
          details: {
            limit: 10,
            current: 8,
            tier: 'free',
          },
        },
      });
    });

    it('should handle generic Error instances', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const error = new Error('Generic error');
      errorResponse(mockRes as Response, error);

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Generic error',
        },
      });

      process.env.NODE_ENV = originalEnv;
    });

    it('should sanitize error messages in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Sensitive error details');
      errorResponse(mockRes as Response, error);

      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      });

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('paginatedResponse', () => {
    it('should return paginated response', () => {
      const data = [{ id: 1 }, { id: 2 }];
      paginatedResponse(mockRes as Response, data, 1, 10, 25);

      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data,
        meta: {
          page: 1,
          limit: 10,
          total: 25,
          totalPages: 3,
          hasNext: true,
          hasPrev: false,
        },
      });
    });
  });

  describe('createdResponse', () => {
    it('should return 201 status with data', () => {
      const data = { id: 1, created: true };
      createdResponse(mockRes as Response, data);

      expect(statusSpy).toHaveBeenCalledWith(201);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data,
      });
    });
  });

  describe('noContentResponse', () => {
    it('should return 204 status without body', () => {
      noContentResponse(mockRes as Response);

      expect(statusSpy).toHaveBeenCalledWith(204);
      expect(sendSpy).toHaveBeenCalled();
    });
  });

  describe('badRequestResponse', () => {
    it('should return 400 status with error', () => {
      badRequestResponse(mockRes as Response, 'Invalid input', {
        field: 'error',
      });

      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid input',
          details: { field: 'error' },
        },
      });
    });
  });

  describe('unauthorizedResponse', () => {
    it('should return 401 status with error', () => {
      unauthorizedResponse(mockRes as Response, 'Unauthorized access');

      expect(statusSpy).toHaveBeenCalledWith(401);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Unauthorized access',
        },
      });
    });
  });

  describe('forbiddenResponse', () => {
    it('should return 403 status with error', () => {
      forbiddenResponse(mockRes as Response, 'Access denied');

      expect(statusSpy).toHaveBeenCalledWith(403);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied',
        },
      });
    });
  });

  describe('notFoundResponse', () => {
    it('should return 404 status with error', () => {
      notFoundResponse(mockRes as Response, 'User not found');

      expect(statusSpy).toHaveBeenCalledWith(404);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      });
    });
  });

  describe('conflictResponse', () => {
    it('should return 409 status with error', () => {
      conflictResponse(mockRes as Response, 'Resource already exists');

      expect(statusSpy).toHaveBeenCalledWith(409);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'Resource already exists',
        },
      });
    });
  });

  describe('rateLimitResponse', () => {
    it('should return 429 status with error and headers', () => {
      const resetTime = new Date('2023-12-25T00:00:00Z');
      rateLimitResponse(mockRes as Response, 'Rate limit exceeded', resetTime);

      expect(statusSpy).toHaveBeenCalledWith(429);
      expect(setSpy).toHaveBeenCalledWith({
        'X-RateLimit-Reset': '1703462400',
      });
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded',
          details: {
            resetTime: '2023-12-25T00:00:00.000Z',
          },
        },
      });
    });

    it('should work without reset time', () => {
      rateLimitResponse(mockRes as Response, 'Rate limit exceeded');

      expect(statusSpy).toHaveBeenCalledWith(429);
      expect(setSpy).toHaveBeenCalledWith({});
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded',
        },
      });
    });
  });

  describe('internalServerErrorResponse', () => {
    it('should return 500 status with error', () => {
      internalServerErrorResponse(mockRes as Response, 'Database error');

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Database error',
        },
      });
    });

    it('should sanitize error message in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      internalServerErrorResponse(
        mockRes as Response,
        'Sensitive database error'
      );

      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error',
        },
      });

      process.env.NODE_ENV = originalEnv;
    });
  });
});
