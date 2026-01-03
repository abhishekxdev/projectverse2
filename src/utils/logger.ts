import { Request, RequestHandler } from 'express';
import {
  UserDocument,
  TierInfo,
  UserUsageCounters,
  UserRole,
  UserStatus,
} from '../types/user.types';

/**
 * Extended Request interface with additional properties
 */
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      user?: UserDocument;
      tier?: TierInfo;
      usage?: UserUsageCounters;
      role?: UserRole;
      schoolId?: string | null;
      status?: UserStatus;
      claimsUpdatedAt?: string;
    }
  }
}

/**
 * Log levels in order of severity
 */
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

/**
 * Log entry interface
 */
export interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  requestId?: string;
  userId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  metadata?: Record<string, any>;
}

/**
 * Logger configuration interface
 */
export interface LoggerConfig {
  level: LogLevel;
  prettyPrint: boolean;
  includeTimestamps: boolean;
}

/**
 * Simple structured logger implementation
 */
export class Logger {
  private config: LoggerConfig;
  private context: Record<string, any> = {};

  constructor(config: Partial<LoggerConfig> = {}) {
    const isTest = process.env.NODE_ENV === 'test';

    this.config = {
      level: isTest ? LogLevel.WARN : LogLevel.INFO, // Only WARN and ERROR in tests
      prettyPrint: process.env.NODE_ENV !== 'production',
      includeTimestamps: true,
      ...config,
    };
  }

  /**
   * Set context that will be included in all log entries
   */
  setContext(context: Record<string, any>): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Clear all context
   */
  clearContext(): void {
    this.context = {};
  }

  /**
   * Check if a log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    return level <= this.config.level;
  }

  /**
   * Format log entry for output
   */
  private formatLogEntry(entry: LogEntry): string {
    const isTest = process.env.NODE_ENV === 'test';
    const logData = {
      ...entry,
      ...this.context,
    };

    if (this.config.prettyPrint) {
      const colors = {
        ERROR: '\x1b[31m',
        WARN: '\x1b[33m',
        INFO: '\x1b[36m',
        DEBUG: '\x1b[37m',
        RESET: '\x1b[0m',
      };

      const color = colors[entry.level as keyof typeof colors] || colors.RESET;
      const reset = colors.RESET;

      const parts = [
        `${color}[${entry.level}]${reset}`,
        entry.timestamp,
        entry.requestId && `req:${entry.requestId}`,
        entry.userId && `user:${entry.userId}`,
        entry.method && entry.path && `${entry.method} ${entry.path}`,
        entry.statusCode && `status:${entry.statusCode}`,
        entry.duration && `${entry.duration}ms`,
        entry.message,
      ].filter(Boolean);

      let message = parts.join(' ');

      if (Object.keys(this.context).length > 0) {
        const contextStr = Object.entries(this.context)
          .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
          .join(', ');
        message += ` {${contextStr}}`;
      }

      // Only show stack traces in non-test environments
      if (entry.error && !isTest) {
        message += `\n${entry.error.stack || entry.error.message}`;
      }

      // Only show metadata in non-test environments
      if (entry.metadata && Object.keys(entry.metadata).length > 0 && !isTest) {
        message += `\n${JSON.stringify(entry.metadata, null, 2)}`;
      }

      return message;
    } else {
      // JSON format for production
      return JSON.stringify(logData);
    }
  }

  /**
   * Create a log entry
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>
  ): LogEntry {
    return {
      level: LogLevel[level],
      message,
      timestamp: new Date().toISOString(),
      metadata,
    };
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;

    const entry = this.createLogEntry(LogLevel.ERROR, message, metadata);

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: this.config.prettyPrint ? error.stack : undefined,
      };
    }

    console.error(this.formatLogEntry(entry));
  }

  /**
   * Log a warning message
   */
  warn(message: string, metadata?: Record<string, any>): void {
    if (!this.shouldLog(LogLevel.WARN)) return;

    const entry = this.createLogEntry(LogLevel.WARN, message, metadata);
    console.warn(this.formatLogEntry(entry));
  }

  /**
   * Log an info message
   */
  info(message: string, metadata?: Record<string, any>): void {
    if (!this.shouldLog(LogLevel.INFO)) return;

    const entry = this.createLogEntry(LogLevel.INFO, message, metadata);
    console.log(this.formatLogEntry(entry));
  }

  /**
   * Log a debug message
   */
  debug(message: string, metadata?: Record<string, any>): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;

    const entry = this.createLogEntry(LogLevel.DEBUG, message, metadata);
    console.log(this.formatLogEntry(entry));
  }

  /**
   * Log HTTP request
   */
  logRequest(req: Request, metadata?: Record<string, any>): void {
    const entry = this.createLogEntry(LogLevel.INFO, 'HTTP Request', metadata);

    entry.method = req.method;
    entry.path = req.path;
    entry.requestId = req.requestId;
    entry.userId = req.user?.id;

    console.log(this.formatLogEntry(entry));
  }

  /**
   * Log HTTP response
   */
  logResponse(
    req: Request,
    statusCode: number,
    duration: number,
    metadata?: Record<string, any>
  ): void {
    const level = statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;

    if (!this.shouldLog(level)) return;

    const entry = this.createLogEntry(level, 'HTTP Response', metadata);

    entry.method = req.method;
    entry.path = req.path;
    entry.statusCode = statusCode;
    entry.duration = duration;
    entry.requestId = req.requestId;
    entry.userId = req.user?.id;

    const logFn = level === LogLevel.WARN ? console.warn : console.log;
    logFn(this.formatLogEntry(entry));
  }

  /**
   * Log performance metrics
   */
  logPerformance(
    operation: string,
    duration: number,
    metadata?: Record<string, any>
  ): void {
    const entry = this.createLogEntry(
      LogLevel.INFO,
      `Performance: ${operation}`,
      {
        duration,
        operation,
        ...metadata,
      }
    );

    if (duration > 1000) {
      entry.level = 'WARN';
      entry.message = `Slow operation: ${operation} took ${duration}ms`;
      console.warn(this.formatLogEntry(entry));
    } else {
      console.log(this.formatLogEntry(entry));
    }
  }

  /**
   * Create a child logger with additional context
   */
  child(context: Record<string, any>): Logger {
    const childLogger = new Logger(this.config);
    childLogger.setContext({ ...this.context, ...context });
    return childLogger;
  }
}

/**
 * Default logger instance
 */
export const logger = new Logger({
  level: process.env.LOG_LEVEL
    ? LogLevel[process.env.LOG_LEVEL as keyof typeof LogLevel]
    : LogLevel.INFO,
  prettyPrint: process.env.NODE_ENV !== 'production',
  includeTimestamps: true,
});

/**
 * Create a logger with request context
 */
export const createRequestLogger = (req: Request): Logger => {
  return logger.child({
    requestId: req.requestId,
    userId: req.user?.id,
    method: req.method,
    path: req.path,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
  });
};

/**
 * Middleware to add request ID to request object
 */
export const requestIdMiddleware = (): RequestHandler => {
  return (req: Request, res: any, next: any) => {
    req.requestId =
      (req.headers['x-request-id'] as string) || generateRequestId();
    res.setHeader('X-Request-ID', req.requestId);
    next();
  };
};

/**
 * Generate a unique request ID
 */
const generateRequestId = (): string => {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
};

/**
 * Performance timer utility
 */
export class PerformanceTimer {
  private startTime: number;
  private operation: string;

  constructor(operation: string) {
    this.operation = operation;
    this.startTime = Date.now();
  }

  /**
   * End the timer and log the duration
   */
  end(metadata?: Record<string, any>): number {
    const duration = Date.now() - this.startTime;
    logger.logPerformance(this.operation, duration, metadata);
    return duration;
  }

  /**
   * Get the current duration without ending the timer
   */
  current(): number {
    return Date.now() - this.startTime;
  }
}

/**
 * Create a performance timer
 */
export const createTimer = (operation: string): PerformanceTimer => {
  return new PerformanceTimer(operation);
};
