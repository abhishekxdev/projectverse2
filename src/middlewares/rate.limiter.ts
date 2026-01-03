import { Request, Response, NextFunction } from 'express';
import { rateLimitResponse } from '../utils/response';
import { logger } from '../utils/logger';

/**
 * Rate limit configuration interface
 */
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  max: number; // Maximum number of requests per window
  message?: string; // Custom error message
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
  keyGenerator?: (req: Request) => string; // Custom key generator
  headers?: boolean; // Send rate limit headers
}

/**
 * Default rate limit configurations
 */
export const DEFAULT_RATE_LIMITS = {
  // General API limits
  general: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per 15 minutes
    message: 'Too many requests from this IP, please try again later',
    headers: true,
  },
  // Authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 login attempts per 15 minutes
    message: 'Too many authentication attempts, please try again later',
    headers: true,
  },
  // Free tier limits
  freeTier: {
    windowMs: 30 * 60 * 1000, // 30 minutes
    max: 20, // 20 requests per 30 minutes
    message:
      'Free tier limit exceeded. Consider upgrading to school tier for unlimited access',
    headers: true,
  },
  // School tier limits
  schoolTier: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // 1000 requests per 15 minutes
    message: 'Rate limit exceeded, please try again later',
    headers: true,
  },
  // AI tutor endpoints
  tutor: {
    windowMs: 30 * 60 * 1000, // 30 minutes
    max: 10, // 10 messages per 30 minutes for free tier
    message:
      'Tutor message limit exceeded. Free tier allows 10 messages per month',
    headers: true,
  },
  // Assessment endpoints
  assessment: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 assessments per hour for free tier
    message: 'Assessment limit exceeded. Free tier allows 1 assessment total',
    headers: true,
  },
};

/**
 * In-memory store for rate limit data
 * todo -> production  use Redis or another external store
 */
interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

/**
 * Clean up expired entries from store
 */
const cleanupStore = (): void => {
  const now = Date.now();
  Object.keys(store).forEach((key) => {
    if (store[key].resetTime <= now) {
      delete store[key];
    }
  });
};

// Clean up store every 5 minutes
setInterval(cleanupStore, 5 * 60 * 1000);

/**
 * Default key generator
 */
const defaultKeyGenerator = (req: Request): string => {
  // Use user ID if available, otherwise IP
  if (req.user?.id) {
    return `user:${req.user.id}`;
  }
  return `ip:${req.ip || req.connection.remoteAddress}`;
};

/**
 * Rate limiting middleware
 */
export const rateLimiter = (config: RateLimitConfig) => {
  const {
    windowMs,
    max,
    message = 'Rate limit exceeded',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    keyGenerator = defaultKeyGenerator,
    headers = true,
  } = config;

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator(req);
    const now = Date.now();
    const resetTime = now + windowMs;

    // Initialize or get existing record
    if (!store[key] || store[key].resetTime <= now) {
      store[key] = {
        count: 0,
        resetTime,
      };
    }

    // Increment counter
    store[key].count++;

    // Add rate limit headers
    if (headers) {
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader(
        'X-RateLimit-Remaining',
        Math.max(0, max - store[key].count)
      );
      res.setHeader(
        'X-RateLimit-Reset',
        Math.ceil(store[key].resetTime / 1000)
      );
    }

    // Check if limit exceeded
    if (store[key].count > max) {
      const resetDate = new Date(store[key].resetTime);

      // Log rate limit exceeded
      logger.warn('Rate limit exceeded', {
        key,
        count: store[key].count,
        limit: max,
        windowMs,
        resetTime: store[key].resetTime,
        method: req.method,
        path: req.path,
        userId: req.user?.id,
        ip: req.ip || req.connection.remoteAddress,
      });

      rateLimitResponse(res, message, resetDate);
      return;
    }

    // Skip counting based on response
    if (skipSuccessfulRequests || skipFailedRequests) {
      const originalSend = res.send;
      res.send = function (body: any) {
        // Skip successful requests
        if (
          skipSuccessfulRequests &&
          res.statusCode >= 200 &&
          res.statusCode < 300
        ) {
          store[key].count--;
        }
        // Skip failed requests
        if (skipFailedRequests && res.statusCode >= 400) {
          store[key].count--;
        }
        return originalSend.call(this, body);
      };
    }

    next();
  };
};

/**
 * Tier-based rate limiting middleware
 */
export const tierBasedRateLimiter = () => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip rate limiting for admin users
    if (req.user?.role === 'platform_admin') {
      return next();
    }

    let config: RateLimitConfig;

    // Apply different limits based on user tier and endpoint
    if (req.path.startsWith('/api/auth/')) {
      config = DEFAULT_RATE_LIMITS.auth;
    } else if (req.path.startsWith('/api/tutor/')) {
      config =
        req.user?.tier === 'school'
          ? { ...DEFAULT_RATE_LIMITS.schoolTier, max: 100 } // Higher limit for school tier
          : DEFAULT_RATE_LIMITS.tutor;
    } else if (req.path.startsWith('/api/assessments/')) {
      config =
        req.user?.tier === 'school'
          ? { ...DEFAULT_RATE_LIMITS.schoolTier, max: 50 } // Higher limit for school tier
          : DEFAULT_RATE_LIMITS.assessment;
    } else if (req.user?.tier === 'school') {
      config = DEFAULT_RATE_LIMITS.schoolTier;
    } else {
      config = DEFAULT_RATE_LIMITS.general;
    }

    return rateLimiter(config)(req, res, next);
  };
};

/**
 * Create a custom rate limiter
 */
export const createRateLimiter = (config: Partial<RateLimitConfig>) => {
  return rateLimiter({
    ...DEFAULT_RATE_LIMITS.general,
    ...config,
  });
};

/**
 * Rate limiting middleware for authentication endpoints
 */
export const authRateLimiter = rateLimiter(DEFAULT_RATE_LIMITS.auth);

/**
 * Rate limiting middleware for general API endpoints
 */
export const generalRateLimiter = rateLimiter(DEFAULT_RATE_LIMITS.general);

/**
 * Rate limiting middleware for free tier users
 */
export const freeTierRateLimiter = rateLimiter(DEFAULT_RATE_LIMITS.freeTier);

/**
 * Rate limiting middleware for school tier users
 */
export const schoolTierRateLimiter = rateLimiter(
  DEFAULT_RATE_LIMITS.schoolTier
);

/**
 * Rate limiting middleware for AI tutor endpoints
 */
export const tutorRateLimiter = rateLimiter(DEFAULT_RATE_LIMITS.tutor);

/**
 * Rate limiting middleware for assessment endpoints
 */
export const assessmentRateLimiter = rateLimiter(
  DEFAULT_RATE_LIMITS.assessment
);
