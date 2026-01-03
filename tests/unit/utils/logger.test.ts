import {
  Logger,
  LogLevel,
  createRequestLogger,
  requestIdMiddleware,
  PerformanceTimer,
  createTimer,
} from '../../../src/utils/logger';
import { Request, Response } from 'express';

describe('Logger', () => {
  let consoleSpy: {
    log: jest.SpyInstance;
    warn: jest.SpyInstance;
    error: jest.SpyInstance;
  };

  beforeEach(() => {
    consoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should use default configuration', () => {
      const logger = new Logger();

      expect(logger).toBeInstanceOf(Logger);
    });

    it('should accept custom configuration', () => {
      const config = {
        level: LogLevel.DEBUG,
        prettyPrint: false,
        includeTimestamps: false,
      };
      const logger = new Logger(config);

      expect(logger).toBeInstanceOf(Logger);
    });
  });

  describe('setContext and clearContext', () => {
    it('should set and clear context', () => {
      const logger = new Logger({ level: LogLevel.INFO });
      const context = { service: 'test', version: '1.0' };

      logger.setContext(context);
      logger.info('Test message');

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('service: "test"')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('version: "1.0"')
      );

      consoleSpy.log.mockClear();

      logger.clearContext();
      logger.info('Another message');

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      expect(consoleSpy.log).not.toHaveBeenCalledWith(
        expect.stringContaining('service: "test"')
      );
    });
  });

  describe('log levels', () => {
    let logger: Logger;

    beforeEach(() => {
      logger = new Logger({ level: LogLevel.DEBUG });
    });

    it('should log error messages', () => {
      const error = new Error('Test error');
      logger.error('Error message', error);

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]')
      );
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Error message')
      );
    });

    it('should log warning messages', () => {
      logger.warn('Warning message');

      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('[WARN]')
      );
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('Warning message')
      );
    });

    it('should log info messages', () => {
      logger.info('Info message');

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Info message')
      );
    });

    it('should log debug messages', () => {
      logger.debug('Debug message');

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG]')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Debug message')
      );
    });

    it('should respect log level configuration', () => {
      const infoLogger = new Logger({ level: LogLevel.INFO });

      infoLogger.debug('Debug message');
      infoLogger.info('Info message');

      expect(consoleSpy.log).toHaveBeenCalledTimes(1); // Only info message
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Info message')
      );
    });
  });

  describe('child logger', () => {
    it('should create child logger with additional context', () => {
      const parentLogger = new Logger({ level: LogLevel.INFO });
      parentLogger.setContext({ service: 'parent' });

      const childLogger = parentLogger.child({ module: 'child' });
      childLogger.info('Test message');

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('service: "parent"')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('module: "child"')
      );
    });
  });

  describe('logRequest', () => {
    it('should log HTTP request', () => {
      const logger = new Logger();
      const req = {
        method: 'GET',
        path: '/api/test',
        requestId: 'req-123',
        user: { id: 'user-456' },
      } as Request;

      logger.logRequest(req);

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('HTTP Request')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('GET /api/test')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('req:req-123')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('user:user-456')
      );
    });
  });

  describe('logResponse', () => {
    it('should log successful HTTP response', () => {
      const logger = new Logger({ level: LogLevel.INFO });
      const req = {
        method: 'GET',
        path: '/api/test',
        requestId: 'req-123',
        user: { id: 'user-456' },
      } as Request;

      logger.logResponse(req, 200, 150);

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('HTTP Response')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('status:200')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('150ms')
      );
    });

    it('should log error HTTP response', () => {
      const logger = new Logger();
      const req = {
        method: 'POST',
        path: '/api/error',
        requestId: 'req-789',
        user: { id: 'user-456' },
      } as Request;

      logger.logResponse(req, 500, 250);

      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('HTTP Response')
      );
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('status:500')
      );
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('250ms')
      );
    });
  });

  describe('logPerformance', () => {
    it('should log performance metrics', () => {
      const logger = new Logger({ level: LogLevel.INFO });
      logger.logPerformance('database_query', 50);

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Performance: database_query')
      );
    });

    it('should log slow operations as warnings', () => {
      const logger = new Logger();
      logger.logPerformance('slow_operation', 1500);

      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('Slow operation: slow_operation took 1500ms')
      );
    });
  });
});

describe('createRequestLogger', () => {
  let localConsoleSpy: {
    log: jest.SpyInstance;
    warn: jest.SpyInstance;
    error: jest.SpyInstance;
  };

  beforeEach(() => {
    localConsoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation(),
    };
  });

  it('should create logger with request context', () => {
    const req = {
      requestId: 'req-123',
      user: { id: 'user-456' },
      method: 'GET',
      path: '/api/test',
      get: jest.fn(),
      ip: '127.0.0.1',
      headers: {},
    } as unknown as Request;

    const requestLogger = createRequestLogger(req);
    requestLogger.info('Test message');

    expect(localConsoleSpy.log).toHaveBeenCalledWith(
      expect.stringContaining('requestId: "req-123"')
    );
    expect(localConsoleSpy.log).toHaveBeenCalledWith(
      expect.stringContaining('userId: "user-456"')
    );
    expect(localConsoleSpy.log).toHaveBeenCalledWith(
      expect.stringContaining('method: "GET"')
    );
  });
});

describe('requestIdMiddleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;
  let localConsoleSpy: {
    log: jest.SpyInstance;
    warn: jest.SpyInstance;
    error: jest.SpyInstance;
  };

  beforeEach(() => {
    mockReq = {
      headers: {},
    };
    mockRes = {
      setHeader: jest.fn(),
    };
    mockNext = jest.fn();
    localConsoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation(),
    };
  });

  it('should add request ID to request and response', () => {
    const middleware = requestIdMiddleware();
    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockReq.requestId).toBeDefined();
    expect(typeof mockReq.requestId).toBe('string');
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'X-Request-ID',
      mockReq.requestId
    );
    expect(mockNext).toHaveBeenCalled();
  });

  it('should use existing request ID from headers', () => {
    const existingId = 'existing-req-id';
    mockReq.headers = { 'x-request-id': existingId };

    const middleware = requestIdMiddleware();
    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockReq.requestId).toBe(existingId);
    expect(mockRes.setHeader).toHaveBeenCalledWith('X-Request-ID', existingId);
  });
});

describe('PerformanceTimer', () => {
  let localConsoleSpy: {
    log: jest.SpyInstance;
    warn: jest.SpyInstance;
    error: jest.SpyInstance;
  };

  beforeEach(() => {
    localConsoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation(),
    };
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should measure elapsed time', () => {
    const timer = new PerformanceTimer('test operation');

    jest.advanceTimersByTime(100);
    const duration = timer.end();

    expect(duration).toBe(100);
    expect(localConsoleSpy.log).toHaveBeenCalledWith(
      expect.stringContaining('Performance: test operation')
    );
  });

  it('should get current duration without ending', () => {
    const timer = new PerformanceTimer('test operation');

    jest.advanceTimersByTime(50);
    const current = timer.current();

    expect(current).toBe(50);
  });

  it('should log slow operations as warnings', () => {
    const timer = new PerformanceTimer('slow operation');

    jest.advanceTimersByTime(1500);
    timer.end();

    expect(localConsoleSpy.warn).toHaveBeenCalledWith(
      expect.stringContaining('Slow operation: slow operation took 1500ms')
    );
  });
});

describe('createTimer', () => {
  it('should create a new PerformanceTimer', () => {
    const timer = createTimer('test operation');

    expect(timer).toBeInstanceOf(PerformanceTimer);
  });
});
