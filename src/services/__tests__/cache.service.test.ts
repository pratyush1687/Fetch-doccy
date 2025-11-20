import { cacheService } from '../cache.service';
import { redisService } from '../redis.service';
import { config } from '../../config';
import { SearchResponse, Document } from '../../types';

jest.mock('../redis.service');
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));
jest.mock('../../config', () => ({
  config: {
    cache: {
      ttlSeconds: 60,
      searchTtlSeconds: 120,
    },
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

describe('CacheService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSearchResult', () => {
    it('should retrieve cached search result', async () => {
      const tenantId = 'tenant-1';
      const query = 'test query';
      const filters = { tag: 'important' };
      const offset = 0;
      const limit = 10;
      const cachedResult: SearchResponse = {
        tenantId,
        query,
        offset,
        limit,
        total: 5,
        results: [],
      };

      (redisService.get as jest.Mock).mockResolvedValue(cachedResult);

      const result = await cacheService.getSearchResult(
        tenantId,
        query,
        filters,
        offset,
        limit
      );

      expect(result).toEqual(cachedResult);
      expect(redisService.get).toHaveBeenCalled();
    });

    it('should return null when cache miss', async () => {
      (redisService.get as jest.Mock).mockResolvedValue(null);

      const result = await cacheService.getSearchResult(
        'tenant-1',
        'query',
        {},
        0,
        10
      );

      expect(result).toBeNull();
    });

    it('should generate correct cache key with filters', async () => {
      const tenantId = 'tenant-1';
      const query = 'test';
      const filters = { tag: 'important', author: 'john' };
      
      await cacheService.getSearchResult(tenantId, query, filters, 0, 10);

      expect(redisService.get).toHaveBeenCalled();
      const callArgs = (redisService.get as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toContain('search:tenant-1:');
    });
  });

  describe('setSearchResult', () => {
    it('should cache search result with correct TTL', async () => {
      const tenantId = 'tenant-1';
      const query = 'test query';
      const filters = {};
      const offset = 0;
      const limit = 10;
      const result: SearchResponse = {
        tenantId,
        query,
        offset,
        limit,
        total: 5,
        results: [],
      };

      (redisService.set as jest.Mock).mockResolvedValue(true);

      await cacheService.setSearchResult(
        tenantId,
        query,
        filters,
        offset,
        limit,
        result
      );

      expect(redisService.set).toHaveBeenCalledWith(
        expect.stringContaining('search:tenant-1:'),
        result,
        config.cache.searchTtlSeconds
      );
    });
  });

  describe('getDocument', () => {
    it('should retrieve cached document', async () => {
      const tenantId = 'tenant-1';
      const docId = 'doc-123';
      const cachedDoc: Document = {
        id: docId,
        tenantId,
        title: 'Test Document',
        content: 'Test content',
      };

      (redisService.get as jest.Mock).mockResolvedValue(cachedDoc);

      const result = await cacheService.getDocument(tenantId, docId);

      expect(result).toEqual(cachedDoc);
      expect(redisService.get).toHaveBeenCalledWith(`doc:${tenantId}:${docId}`);
    });

    it('should return null when cache miss', async () => {
      (redisService.get as jest.Mock).mockResolvedValue(null);

      const result = await cacheService.getDocument('tenant-1', 'doc-123');

      expect(result).toBeNull();
    });
  });

  describe('setDocument', () => {
    it('should cache document with correct TTL', async () => {
      const tenantId = 'tenant-1';
      const docId = 'doc-123';
      const document: Document = {
        id: docId,
        tenantId,
        title: 'Test Document',
        content: 'Test content',
      };

      (redisService.set as jest.Mock).mockResolvedValue(true);

      await cacheService.setDocument(tenantId, docId, document);

      expect(redisService.set).toHaveBeenCalledWith(
        `doc:${tenantId}:${docId}`,
        document,
        config.cache.ttlSeconds
      );
    });
  });

  describe('invalidateDocument', () => {
    it('should delete document from cache', async () => {
      const tenantId = 'tenant-1';
      const docId = 'doc-123';

      (redisService.del as jest.Mock).mockResolvedValue(true);

      await cacheService.invalidateDocument(tenantId, docId);

      expect(redisService.del).toHaveBeenCalledWith(`doc:${tenantId}:${docId}`);
    });
  });

  describe('invalidateTenantSearches', () => {
    it('should delete all search cache keys for tenant', async () => {
      const tenantId = 'tenant-1';

      (redisService.delPattern as jest.Mock).mockResolvedValue(5);

      await cacheService.invalidateTenantSearches(tenantId);

      expect(redisService.delPattern).toHaveBeenCalledWith(`search:${tenantId}:*`);
    });

    it('should handle zero deleted keys', async () => {
      const tenantId = 'tenant-1';

      (redisService.delPattern as jest.Mock).mockResolvedValue(0);

      await cacheService.invalidateTenantSearches(tenantId);

      expect(redisService.delPattern).toHaveBeenCalledWith(`search:${tenantId}:*`);
    });
  });
});

