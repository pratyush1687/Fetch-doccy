describe('Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should load default values when environment variables are not set', () => {
    delete process.env.PORT;
    delete process.env.NODE_ENV;
    delete process.env.OPENSEARCH_NODE;
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
    delete process.env.OPENSEARCH_INDEX;

    const { config } = require('../index');

    expect(config.server.port).toBe(3000);
    expect(config.server.nodeEnv).toBe('development');
    expect(config.opensearch.node).toBe('http://localhost:9200');
    expect(config.opensearch.index).toBe('documents');
    expect(config.redis.host).toBe('localhost');
    expect(config.redis.port).toBe(6379);
  });

  it('should load values from environment variables', () => {
    process.env.PORT = '8080';
    process.env.NODE_ENV = 'production';
    process.env.OPENSEARCH_NODE = 'http://opensearch:9200';
    process.env.OPENSEARCH_INDEX = 'prod-documents';
    process.env.REDIS_HOST = 'redis-host';
    process.env.REDIS_PORT = '6380';

    const { config } = require('../index');

    expect(config.server.port).toBe(8080);
    expect(config.server.nodeEnv).toBe('production');
    expect(config.opensearch.node).toBe('http://opensearch:9200');
    expect(config.opensearch.index).toBe('prod-documents');
    expect(config.redis.host).toBe('redis-host');
    expect(config.redis.port).toBe(6380);
  });

  it('should parse numeric values correctly', () => {
    process.env.PORT = '3001';
    process.env.REDIS_PORT = '6381';
    process.env.RATE_LIMIT_WINDOW_MS = '120000';
    process.env.RATE_LIMIT_MAX_REQUESTS = '200';
    process.env.CACHE_TTL_SECONDS = '120';
    process.env.SEARCH_CACHE_TTL_SECONDS = '240';

    const { config } = require('../index');

    expect(config.server.port).toBe(3001);
    expect(config.redis.port).toBe(6381);
    expect(config.rateLimit.windowMs).toBe(120000);
    expect(config.rateLimit.maxRequests).toBe(200);
    expect(config.cache.ttlSeconds).toBe(120);
    expect(config.cache.searchTtlSeconds).toBe(240);
  });

  it('should handle boolean environment variables', () => {
    process.env.REDIS_CLUSTER_MODE = 'true';
    process.env.REDIS_ENABLE_TLS = 'true';

    const { config } = require('../index');

    expect(config.redis.clusterMode).toBe(true);
    expect(config.redis.enableTLS).toBe(true);
  });

  it('should handle false boolean environment variables', () => {
    process.env.REDIS_CLUSTER_MODE = 'false';
    process.env.REDIS_ENABLE_TLS = 'false';

    const { config } = require('../index');

    expect(config.redis.clusterMode).toBe(false);
    expect(config.redis.enableTLS).toBe(false);
  });

  it('should handle optional Redis password', () => {
    delete process.env.REDIS_PASSWORD;

    const { config } = require('../index');

    expect(config.redis.password).toBeUndefined();
  });

  it('should set Redis password when provided', () => {
    process.env.REDIS_PASSWORD = 'secret-password';

    const { config } = require('../index');

    expect(config.redis.password).toBe('secret-password');
  });

  it('should handle OpenSearch credentials', () => {
    process.env.OPENSEARCH_USERNAME = 'admin';
    process.env.OPENSEARCH_PASSWORD = 'admin123';

    const { config } = require('../index');

    expect(config.opensearch.username).toBe('admin');
    expect(config.opensearch.password).toBe('admin123');
  });

  it('should handle log level configuration', () => {
    process.env.LOG_LEVEL = 'debug';

    const { config } = require('../index');

    expect(config.logging.level).toBe('debug');
  });
});

