import Redis, { Cluster } from 'ioredis';
import { config } from '../config';
import logger from '../utils/logger';

class RedisService {
  private client: Redis | Cluster;

  constructor() {
    // Determine if we should use cluster mode
    // Auto-detect cluster mode if host contains cluster/serverless indicators, or use explicit config
    const isClusterMode = config.redis.clusterMode || 
      config.redis.host.includes('.cluster.') || 
      config.redis.host.includes('.serverless.');

    if (isClusterMode) {
      // Cluster mode (for AWS ElastiCache cluster)
      this.client = new Redis.Cluster(
        [{ host: config.redis.host, port: config.redis.port }],
        {
          dnsLookup: (address, callback) => callback(null, address),
          redisOptions: {
            password: config.redis.password,
            ...(config.redis.enableTLS && { tls: {} }),
            maxRetriesPerRequest: 3,
          },
        }
      );
    } else {
      // Standalone mode (for local Redis/Valkey or single-node ElastiCache)
      this.client = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
        ...(config.redis.enableTLS && { tls: {} }),
      });
    }

    // Log connection attempt details for debugging
    logger.info('Attempting Redis connection', {
      host: config.redis.host,
      port: config.redis.port,
      mode: isClusterMode ? 'cluster' : 'standalone',
      tlsEnabled: config.redis.enableTLS,
      hasPassword: !!config.redis.password,
    });

    this.client.on('error', (err) => {
      logger.error('Redis connection error', { 
        error: err.message,
        host: config.redis.host,
        port: config.redis.port,
        mode: isClusterMode ? 'cluster' : 'standalone',
        tlsEnabled: config.redis.enableTLS,
        stack: err.stack,
      });
    });

    this.client.on('connect', () => {
      logger.info('Redis connected', { 
        host: config.redis.host, 
        port: config.redis.port,
        mode: isClusterMode ? 'cluster' : 'standalone'
      });
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Redis get error', { key, error: (error as Error).message });
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, serialized);
      } else {
        await this.client.set(key, serialized);
      }
      return true;
    } catch (error) {
      logger.error('Redis set error', { key, error: (error as Error).message });
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error('Redis delete error', { key, error: (error as Error).message });
      return false;
    }
  }

  async delPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) return 0;
      return await this.client.del(...keys);
    } catch (error) {
      logger.error('Redis delete pattern error', { pattern, error: (error as Error).message });
      return 0;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis exists error', { key, error: (error as Error).message });
      return false;
    }
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.client.quit();
  }
}

export const redisService = new RedisService();

