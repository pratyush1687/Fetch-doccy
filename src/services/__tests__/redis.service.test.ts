import { redisService } from '../redis.service';

// Mock ioredis
jest.mock('ioredis', () => {
  const mockClientInstance = {
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    exists: jest.fn(),
    ping: jest.fn(),
    quit: jest.fn(),
    on: jest.fn(),
  };

  const RedisConstructor = jest.fn(() => mockClientInstance);
  (RedisConstructor as any).Cluster = jest.fn(() => mockClientInstance);
  
  return {
    __esModule: true,
    default: RedisConstructor,
    Cluster: (RedisConstructor as any).Cluster,
  };
});

// Mock config to ensure stable environment
jest.mock('../../config', () => ({
  config: {
    redis: {
      host: 'localhost',
      port: 6379,
      password: undefined,
      clusterMode: false,
      enableTLS: false,
    },
    logging: {
      level: 'info',
    },
  },
}));

describe('RedisService', () => {
  // We'll reference the mock client instance from the service
  let mockRedisClient: any;

  beforeAll(() => {
    mockRedisClient = (redisService as any).client;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('get', () => {
    it('should retrieve and parse JSON value', async () => {
      const testValue = { key: 'value' };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(testValue));

      const result = await redisService.get<typeof testValue>('test-key');

      expect(result).toEqual(testValue);
      expect(mockRedisClient.get).toHaveBeenCalledWith('test-key');
    });

    it('should return null when key does not exist', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await redisService.get('non-existent-key');

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));

      const result = await redisService.get('error-key');

      expect(result).toBeNull();
    });

    it('should handle invalid JSON gracefully', async () => {
      mockRedisClient.get.mockResolvedValue('invalid-json{');

      const result = await redisService.get('invalid-key');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should set value without TTL', async () => {
      const testValue = { key: 'value' };
      mockRedisClient.set.mockResolvedValue('OK');

      const result = await redisService.set('test-key', testValue);

      expect(result).toBe(true);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify(testValue)
      );
    });

    it('should set value with TTL', async () => {
      const testValue = { key: 'value' };
      mockRedisClient.setex.mockResolvedValue('OK');

      const result = await redisService.set('test-key', testValue, 60);

      expect(result).toBe(true);
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'test-key',
        60,
        JSON.stringify(testValue)
      );
    });

    it('should return false on error', async () => {
      mockRedisClient.set.mockRejectedValue(new Error('Redis error'));

      const result = await redisService.set('error-key', 'value');

      expect(result).toBe(false);
    });

    it('should serialize complex objects', async () => {
      const complexValue = {
        nested: { deep: { value: 'test' } },
        array: [1, 2, 3],
      };
      mockRedisClient.set.mockResolvedValue('OK');

      await redisService.set('complex-key', complexValue);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'complex-key',
        JSON.stringify(complexValue)
      );
    });
  });

  describe('del', () => {
    it('should delete key successfully', async () => {
      mockRedisClient.del.mockResolvedValue(1);

      const result = await redisService.del('test-key');

      expect(result).toBe(true);
      expect(mockRedisClient.del).toHaveBeenCalledWith('test-key');
    });

    it('should return false on error', async () => {
      mockRedisClient.del.mockRejectedValue(new Error('Redis error'));

      const result = await redisService.del('error-key');

      expect(result).toBe(false);
    });
  });

  describe('delPattern', () => {
    it('should delete keys matching pattern', async () => {
      mockRedisClient.keys.mockResolvedValue(['key1', 'key2', 'key3']);
      mockRedisClient.del.mockResolvedValue(3);

      const result = await redisService.delPattern('pattern:*');

      expect(result).toBe(3);
      expect(mockRedisClient.keys).toHaveBeenCalledWith('pattern:*');
      expect(mockRedisClient.del).toHaveBeenCalledWith('key1', 'key2', 'key3');
    });

    it('should return 0 when no keys match', async () => {
      mockRedisClient.keys.mockResolvedValue([]);

      const result = await redisService.delPattern('pattern:*');

      expect(result).toBe(0);
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });

    it('should return 0 on error', async () => {
      mockRedisClient.keys.mockRejectedValue(new Error('Redis error'));

      const result = await redisService.delPattern('pattern:*');

      expect(result).toBe(0);
    });
  });

  describe('exists', () => {
    it('should return true when key exists', async () => {
      mockRedisClient.exists.mockResolvedValue(1);

      const result = await redisService.exists('test-key');

      expect(result).toBe(true);
      expect(mockRedisClient.exists).toHaveBeenCalledWith('test-key');
    });

    it('should return false when key does not exist', async () => {
      mockRedisClient.exists.mockResolvedValue(0);

      const result = await redisService.exists('non-existent-key');

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockRedisClient.exists.mockRejectedValue(new Error('Redis error'));

      const result = await redisService.exists('error-key');

      expect(result).toBe(false);
    });
  });

  describe('ping', () => {
    it('should return true when Redis responds with PONG', async () => {
      mockRedisClient.ping.mockResolvedValue('PONG');

      const result = await redisService.ping();

      expect(result).toBe(true);
      expect(mockRedisClient.ping).toHaveBeenCalled();
    });

    it('should return false when Redis does not respond with PONG', async () => {
      mockRedisClient.ping.mockResolvedValue('PING');

      const result = await redisService.ping();

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockRedisClient.ping.mockRejectedValue(new Error('Redis error'));

      const result = await redisService.ping();

      expect(result).toBe(false);
    });
  });

  describe('close', () => {
    it('should close Redis connection', async () => {
      mockRedisClient.quit.mockResolvedValue('OK');

      await redisService.close();

      expect(mockRedisClient.quit).toHaveBeenCalled();
    });
  });
});
