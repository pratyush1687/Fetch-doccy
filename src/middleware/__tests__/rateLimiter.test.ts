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
      windowMs: 60000,
      maxRequests: 100,
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

describe('Rate Limiter Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ advanceTimers: true });

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
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should allow request when under rate limit', async () => {
    (redisService.get as jest.Mock).mockResolvedValue(50);
    (redisService.set as jest.Mock).mockResolvedValue(true);

    rateLimiter(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    // Wait for async operations - use runAllTimersAsync to handle fake timers
    await jest.runAllTimersAsync();
    await Promise.resolve();

    expect(mockNext).toHaveBeenCalled();
    expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '100');
    expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(String));
    expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
  });

  it('should block request when rate limit exceeded', async () => {
    (redisService.get as jest.Mock).mockResolvedValue(100);

    rateLimiter(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    await jest.runAllTimersAsync();
    await Promise.resolve();

    expect(mockNext).toHaveBeenCalled();
    const error = (mockNext as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(429);
    expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '100');
    expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '0');
    expect(mockResponse.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
  });

  it('should skip rate limiting when no tenant ID', () => {
    mockRequest.context = undefined;

    rateLimiter(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    expect(mockNext).toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalledWith();
  });

  it('should allow request when Redis fails (fail open)', async () => {
    (redisService.get as jest.Mock).mockRejectedValue(new Error('Redis connection failed'));

    rateLimiter(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    await jest.runAllTimersAsync();
    await Promise.resolve();

    expect(mockNext).toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalledWith();
  });

  it('should increment counter correctly', async () => {
    (redisService.get as jest.Mock).mockResolvedValue(5);
    (redisService.set as jest.Mock).mockResolvedValue(true);

    rateLimiter(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    await jest.runAllTimersAsync();
    await Promise.resolve();

    expect(redisService.set).toHaveBeenCalledWith(
      expect.stringContaining('ratelimit:test-tenant'),
      6,
      expect.any(Number)
    );
  });

  it('should calculate remaining requests correctly', async () => {
    (redisService.get as jest.Mock).mockResolvedValue(75);
    (redisService.set as jest.Mock).mockResolvedValue(true);

    rateLimiter(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    await jest.runAllTimersAsync();
    await Promise.resolve();

    expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '24');
  });

  it('should handle zero current count', async () => {
    (redisService.get as jest.Mock).mockResolvedValue(0);
    (redisService.set as jest.Mock).mockResolvedValue(true);

    rateLimiter(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    await jest.runAllTimersAsync();
    await Promise.resolve();

    expect(redisService.set).toHaveBeenCalledWith(
      expect.any(String),
      1,
      expect.any(Number)
    );
  });

  it('should handle null response from Redis', async () => {
    (redisService.get as jest.Mock).mockResolvedValue(null);
    (redisService.set as jest.Mock).mockResolvedValue(true);

    rateLimiter(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    await jest.runAllTimersAsync();
    await Promise.resolve();

    expect(redisService.set).toHaveBeenCalledWith(
      expect.any(String),
      1,
      expect.any(Number)
    );
    expect(mockNext).toHaveBeenCalled();
  });

  it('should set correct reset time header', async () => {
    const now = Date.now();
    jest.setSystemTime(now);
    
    (redisService.get as jest.Mock).mockResolvedValue(10);
    (redisService.set as jest.Mock).mockResolvedValue(true);

    rateLimiter(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    await jest.runAllTimersAsync();
    await Promise.resolve();

    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'X-RateLimit-Reset',
      expect.any(String)
    );
  });
});

