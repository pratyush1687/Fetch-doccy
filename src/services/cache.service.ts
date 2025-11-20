import { redisService } from './redis.service';
import { config } from '../config';
import { hashQuery } from '../utils/hash';
import { SearchResponse, Document } from '../types';
import logger from '../utils/logger';
import { metricsService } from './metrics.service';

class CacheService {
  private getSearchKey(tenantId: string, query: string, filters: Record<string, any>, offset: number, limit: number): string {
    const queryHash = hashQuery(query, { ...filters, offset, limit });
    return `search:${tenantId}:${queryHash}`;
  }

  private getDocumentKey(tenantId: string, docId: string): string {
    return `doc:${tenantId}:${docId}`;
  }

  async getSearchResult(
    tenantId: string,
    query: string,
    filters: Record<string, any>,
    offset: number,
    limit: number
  ): Promise<SearchResponse | null> {
    const key = this.getSearchKey(tenantId, query, filters, offset, limit);
    const cached = await redisService.get<SearchResponse>(key);
    if (cached) {
      logger.debug('Cache hit for search', { tenantId, query });
      metricsService.recordCacheHit('search');
    } else {
      metricsService.recordCacheMiss('search');
    }
    return cached;
  }

  async setSearchResult(
    tenantId: string,
    query: string,
    filters: Record<string, any>,
    offset: number,
    limit: number,
    result: SearchResponse
  ): Promise<void> {
    const key = this.getSearchKey(tenantId, query, filters, offset, limit);
    await redisService.set(key, result, config.cache.searchTtlSeconds);
    logger.debug('Cached search result', { tenantId, query });
  }

  async getDocument(tenantId: string, docId: string): Promise<Document | null> {
    const key = this.getDocumentKey(tenantId, docId);
    const cached = await redisService.get<Document>(key);
    if (cached) {
      logger.debug('Cache hit for document', { tenantId, docId });
      metricsService.recordCacheHit('document');
    } else {
      metricsService.recordCacheMiss('document');
    }
    return cached;
  }

  async setDocument(tenantId: string, docId: string, document: Document): Promise<void> {
    const key = this.getDocumentKey(tenantId, docId);
    await redisService.set(key, document, config.cache.ttlSeconds);
    logger.debug('Cached document', { tenantId, docId });
  }

  async invalidateDocument(tenantId: string, docId: string): Promise<void> {
    const key = this.getDocumentKey(tenantId, docId);
    await redisService.del(key);
    
    // Invalidate all search results for this tenant (soft invalidation - let TTL handle it)
    // For stronger consistency, we could maintain a list of search keys per tenant
    // but for prototype, TTL-based expiration is acceptable
    logger.debug('Invalidated document cache', { tenantId, docId });
  }

  async invalidateTenantSearches(tenantId: string): Promise<void> {
    const pattern = `search:${tenantId}:*`;
    const deleted = await redisService.delPattern(pattern);
    logger.debug('Invalidated tenant search cache', { tenantId, deletedCount: deleted });
  }
}

export const cacheService = new CacheService();

