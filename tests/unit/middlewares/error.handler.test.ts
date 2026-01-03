import { Request, Response, NextFunction } from 'express';
import {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  setupErrorHandlers,
} from '../../../src/middlewares/error.handler';
import { ValidationError } from '../../../src/utils/error';
import { USER_STATUS } from '../../../src/config/constants';

describe('Error Handler Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    mockReq = {
      method: 'GET',
      path: '/api/test',
      requestId: 'req-123',
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('Mozilla/5.0'),
      connection: { remoteAddress: '127.0.0.1' } as any,
      user: {
        id: 'user-456',
        uid: 'user-456',
        role: 'individual',
        tier: 'free',
        email: 'test@example.com',
        status: USER_STATUS.ACTIVE,
      },
    };
    mockRes = {
      headersSent: false,
      send: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
    consoleSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('errorHandler', () => {
    it('should handle AppError instances', () => {
      const error = new ValidationError('Test validation error');
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Test validation error',
          details: {},
        },
      });
    });

    it('should handle generic Error instances', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const error = new Error('Generic error');
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
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
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      });

      process.env.NODE_ENV = originalEnv;
    });

    it('should not send response if headers already sent', () => {
      mockRes.headersSent = true;
      const error = new Error('Test error');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('should log errors with context', () => {
      const error = new ValidationError('Test error');
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Test error')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('requestId: "req-123"')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('userId: "user-456"')
      );
    });
  });

  describe('notFoundHandler', () => {
    it('should create 404 error and pass to error handler', () => {
      notFoundHandler(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Route GET /api/test not found',
          statusCode: 404,
          code: 'NOT_FOUND',
        })
      );
    });
  });

  describe('asyncHandler', () => {
    it('should catch errors from async functions', async () => {
      const error = new Error('Async error');
      const asyncFn = jest.fn().mockRejectedValue(error);
      const wrappedFn = asyncHandler(asyncFn);

      await wrappedFn(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('should pass through successful async functions', async () => {
      const result = { success: true };
      const asyncFn = jest.fn().mockResolvedValue(result);
      const wrappedFn = asyncHandler(asyncFn);

      await wrappedFn(mockReq as Request, mockRes as Response, mockNext);

      expect(asyncFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
    });
  });

  describe('setupErrorHandlers', () => {
    it('should setup process error handlers', () => {
      const processSpy = jest.spyOn(process, 'on');

      setupErrorHandlers();

      expect(processSpy).toHaveBeenCalledWith(
        'unhandledRejection',
        expect.any(Function)
      );
      expect(processSpy).toHaveBeenCalledWith(
        'uncaughtException',
        expect.any(Function)
      );
    });
  });
});
