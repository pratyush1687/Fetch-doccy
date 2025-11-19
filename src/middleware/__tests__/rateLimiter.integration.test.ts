import { Request, Response, NextFunction } from 'express';
import { rateLimiter } from '../rateLimiter';
import { redisService } from '../../services/redis.service';
import { AppError } from '../errorHandler';

jest.mock('../../services/redis.service');
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));
jest.mock('../../config', () => ({
  config: {
    rateLimit: {
      windowMs: 1000, // 1 second for testing
      maxRequests: 5, // 5 requests max for testing
    },
    logging: {
      level: 'info',
    },
    cache: {
      ttlSeconds: 60,
      searchTtlSeconds: 120,
    },
    server: {
      port: 3000,
      nodeEnv: 'test',
    },
    opensearch: {
      node: 'http://localhost:9200',
      index: 'test-documents',
    },
    redis: {
      host: 'localhost',
      port: 6379,
      password: undefined,
      clusterMode: false,
      enableTLS: false,
    },
  },
}));

describe('Rate Limiter Integration', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockRedisStore: Map<string, number>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ advanceTimers: true });
    jest.setSystemTime(0);

    mockRedisStore = new Map<string, number>();

    mockRequest = {
      path: '/test',
      context: { tenantId: 'test-tenant' },
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();

    // Mock Redis get to return value from store
    (redisService.get as jest.Mock).mockImplementation((key: string) => {
      return Promise.resolve(mockRedisStore.get(key) || 0);
    });

    // Mock Redis set to store value
    (redisService.set as jest.Mock).mockImplementation((key: string, value: number) => {
      mockRedisStore.set(key, value);
      return Promise.resolve(true);
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    mockRedisStore.clear();
  });

  it('should allow requests up to the limit', async () => {
    // Make 5 requests (at the limit)
    for (let i = 0; i < 5; i++) {
      rateLimiter(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );
      await jest.runAllTimersAsync();
      await Promise.resolve();
    }

    expect(mockNext).toHaveBeenCalledTimes(5);
    // Check that none of the calls had an error
    const calls = (mockNext as jest.Mock).mock.calls;
    calls.forEach(call => {
      expect(call[0]).toBeUndefined();
    });
  });

  it('should block requests exceeding the limit', async () => {
    // Set up Redis to return count at limit
    const windowMs = 1000;
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const key = `ratelimit:test-tenant:${windowStart}`;
    mockRedisStore.set(key, 5); // Already at limit

    rateLimiter(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    await jest.runAllTimersAsync();
    await Promise.resolve();

    expect(mockNext).toHaveBeenCalled();
    const error = (mockNext as jest.Mock).mock.calls[0][0];
    expect(error).toBeDefined();
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(429);
  });

  it('should reset counter after window expires', async () => {
    const windowMs = 1000;
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const key = `ratelimit:test-tenant:${windowStart}`;
    
    // Set count at limit for current window
    mockRedisStore.set(key, 5);

    // First request - should be blocked
    rateLimiter(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );
    await jest.runAllTimersAsync();
    await Promise.resolve();

    expect(mockNext).toHaveBeenCalled();
    const firstError = (mockNext as jest.Mock).mock.calls[0][0];
    expect(firstError).toBeInstanceOf(AppError);
    expect(firstError.statusCode).toBe(429);

    // Advance time past the window (1001ms to ensure new window)
    jest.advanceTimersByTime(1001);
    jest.setSystemTime(Date.now() + 1001);

    // Clear mocks for next request
    (mockNext as jest.Mock).mockClear();
    mockRedisStore.clear(); // Clear old window data

    // Next request should be allowed (new window, count starts at 0)
    rateLimiter(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );
    await jest.runAllTimersAsync();
    await Promise.resolve();

    expect(mockNext).toHaveBeenCalled();
    // Should be called without error
    const secondCall = (mockNext as jest.Mock).mock.calls[0];
    expect(secondCall[0]).toBeUndefined();
  });
});

