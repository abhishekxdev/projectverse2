import { Request, Response, NextFunction } from 'express';
import {
  rateLimiter,
  tierBasedRateLimiter,
  authRateLimiter,
  generalRateLimiter,
  DEFAULT_RATE_LIMITS,
} from '../../../src/middlewares/rate.limiter';
import { USER_STATUS } from '../../../src/config/constants';

describe('Rate Limiter Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;
  let consoleSpy: jest.SpyInstance;
  let testCounter: number = 0;

  beforeEach(() => {
    testCounter++;
    mockReq = {
      method: 'GET',
      path: '/api/test',
      ip: `127.0.0.${testCounter}`, // Unique IP per test to avoid rate limit state interference
      user: {
        id: `user-${testCounter}`,
        uid: `user-${testCounter}`,
        tier: 'free',
        role: 'individual',
        email: 'test@example.com',
        status: USER_STATUS.ACTIVE,
      },
    };
    mockRes = {
      setHeader: jest.fn(),
      send: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      set: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
    consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllTimers();
  });

  describe('rateLimiter', () => {
    it('should allow requests within limit', () => {
      const config = {
        windowMs: 60000, // 1 minute
        max: 10,
        message: 'Rate limit exceeded',
      };

      const middleware = rateLimiter(config);

      // Make 5 requests (within limit)
      for (let i = 0; i < 5; i++) {
        middleware(mockReq as Request, mockRes as Response, mockNext);
      }

      expect(mockNext).toHaveBeenCalledTimes(5);
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 10);
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Remaining',
        5
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Reset',
        expect.any(Number)
      );
    });

    it('should block requests exceeding limit', () => {
      const config = {
        windowMs: 60000, // 1 minute
        max: 3,
        message: 'Rate limit exceeded',
      };

      const middleware = rateLimiter(config);

      // Make 4 requests (exceeds limit)
      for (let i = 0; i < 4; i++) {
        middleware(mockReq as Request, mockRes as Response, mockNext);
      }

      expect(mockNext).toHaveBeenCalledTimes(3); // First 3 should pass
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Rate limit exceeded',
          }),
        })
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Rate limit exceeded')
      );
    });

    it('should use custom key generator', () => {
      const config = {
        windowMs: 60000,
        max: 5,
        keyGenerator: (req: any) =>
          `custom:${testCounter}:${req.user?.id || req.ip}`,
      };

      const middleware = rateLimiter(config);

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Remaining',
        4
      );
    });

    it('should reset after window expires', async () => {
      jest.useFakeTimers();

      const config = {
        windowMs: 100, // 100ms
        max: 2,
      };

      const middleware = rateLimiter(config);

      // Make 2 requests (hits limit)
      middleware(mockReq as Request, mockRes as Response, mockNext);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(2);

      // Third request should be blocked
      middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(2); // Still 2
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'RATE_LIMIT_EXCEEDED',
          }),
        })
      );

      // Wait for window to expire
      jest.advanceTimersByTime(150);

      // Reset mocks to check next call
      mockNext.mockClear();
      mockRes.setHeader = jest.fn();

      // Next request should be allowed
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Remaining',
        1
      );

      jest.useRealTimers();
    });
  });

  describe('tierBasedRateLimiter', () => {
    it('should skip rate limiting for platform admin', () => {
      const adminReq = {
        ...mockReq,
        user: {
          ...(mockReq.user as any),
          role: 'platform_admin',
          id: 'admin-123',
        },
      };

      const middleware = tierBasedRateLimiter();

      middleware(adminReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.setHeader).not.toHaveBeenCalled();
    });

    it('should apply auth limits to auth endpoints', () => {
      const authReq = {
        ...mockReq,
        path: '/api/auth/login',
        user: {
          ...(mockReq.user as any),
          tier: 'school',
          id: `user-auth-${testCounter}`,
        },
      };

      const middleware = tierBasedRateLimiter();

      middleware(authReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Limit',
        DEFAULT_RATE_LIMITS.auth.max
      );
    });

    it('should apply tutor limits to tutor endpoints', () => {
      const tutorReq = {
        ...mockReq,
        path: '/api/tutor/messages',
        user: {
          ...(mockReq.user as any),
          tier: 'free',
          id: `user-tutor-${testCounter}`,
        },
      };

      const middleware = tierBasedRateLimiter();

      middleware(tutorReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Limit',
        DEFAULT_RATE_LIMITS.tutor.max
      );
    });

    it('should apply school tier limits to school users', () => {
      const schoolReq = {
        ...mockReq,
        path: '/api/schools/data',
        user: {
          ...(mockReq.user as any),
          tier: 'school',
          id: `user-school-${testCounter}`,
        },
      };

      const middleware = tierBasedRateLimiter();

      middleware(schoolReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Limit',
        DEFAULT_RATE_LIMITS.schoolTier.max
      );
    });
  });

  describe('authRateLimiter', () => {
    it('should apply auth rate limits', () => {
      const authReq = {
        method: 'POST',
        path: '/api/auth/login',
        ip: `127.0.0.${testCounter + 100}`,
        user: {
          ...(mockReq.user as any),
          tier: 'free',
          id: `user-auth-rate-${testCounter}`,
        },
      } as unknown as Request;

      authRateLimiter(authReq, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Limit',
        DEFAULT_RATE_LIMITS.auth.max
      );
    });
  });

  describe('generalRateLimiter', () => {
    it('should apply general rate limits', () => {
      const generalReq = {
        method: 'GET',
        path: '/api/test',
        ip: `127.0.0.${testCounter + 200}`,
        user: {
          ...(mockReq.user as any),
          tier: 'free',
          id: `user-general-${testCounter}`,
        },
      } as unknown as Request;

      generalRateLimiter(generalReq, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Limit',
        DEFAULT_RATE_LIMITS.general.max
      );
    });
  });
});
