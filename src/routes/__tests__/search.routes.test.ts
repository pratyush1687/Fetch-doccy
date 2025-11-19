import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import searchRoutes from '../search.routes';
import { opensearchService } from '../../services/opensearch.service';
import { cacheService } from '../../services/cache.service';

jest.mock('../../services/opensearch.service');
jest.mock('../../services/cache.service');

// Mock middleware to set tenant context
const mockTenantMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  const tenantId = req.headers['x-tenant-id'] as string;
  if (tenantId) {
    req.context = { tenantId };
  }
  next();
};

const app = express();
app.use(express.json());
app.use('/search', mockTenantMiddleware, searchRoutes);

describe('Search Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /search', () => {
    it('should return cached search results', async () => {
      const tenantId = 'tenant-1';
      const cachedResult = {
        tenantId,
        query: 'test',
        offset: 0,
        limit: 10,
        total: 5,
        results: [],
      };

      (cacheService.getSearchResult as jest.Mock).mockResolvedValue(cachedResult);

      const response = await request(app)
        .get('/search')
        .set('X-Tenant-Id', tenantId)
        .query({ q: 'test' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(cachedResult);
      expect(opensearchService.search).not.toHaveBeenCalled();
    });

    it('should perform search when not cached', async () => {
      const tenantId = 'tenant-1';
      const searchResults = {
        results: [
          {
            id: 'doc-1',
            title: 'Test Document',
            snippet: 'Test snippet',
            score: 0.95,
            tags: ['test'],
          },
        ],
        total: 1,
      };
      const expectedResponse = {
        tenantId,
        query: 'test',
        offset: 0,
        limit: 10,
        total: 1,
        results: searchResults.results,
      };

      (cacheService.getSearchResult as jest.Mock).mockResolvedValue(null);
      (opensearchService.search as jest.Mock).mockResolvedValue(searchResults);
      (cacheService.setSearchResult as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .get('/search')
        .set('X-Tenant-Id', tenantId)
        .query({ q: 'test' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expectedResponse);
      expect(opensearchService.search).toHaveBeenCalled();
      expect(cacheService.setSearchResult).toHaveBeenCalled();
    });

    it('should handle search with tag filter', async () => {
      const tenantId = 'tenant-1';
      const searchResults = { results: [], total: 0 };

      (cacheService.getSearchResult as jest.Mock).mockResolvedValue(null);
      (opensearchService.search as jest.Mock).mockResolvedValue(searchResults);
      (cacheService.setSearchResult as jest.Mock).mockResolvedValue(undefined);

      await request(app)
        .get('/search')
        .set('X-Tenant-Id', tenantId)
        .query({ q: 'test', tag: 'important' });

      expect(opensearchService.search).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({
          q: 'test',
          tag: 'important',
        })
      );
    });

    it('should handle search with author filter', async () => {
      const tenantId = 'tenant-1';
      const searchResults = { results: [], total: 0 };

      (cacheService.getSearchResult as jest.Mock).mockResolvedValue(null);
      (opensearchService.search as jest.Mock).mockResolvedValue(searchResults);
      (cacheService.setSearchResult as jest.Mock).mockResolvedValue(undefined);

      await request(app)
        .get('/search')
        .set('X-Tenant-Id', tenantId)
        .query({ q: 'test', author: 'john' });

      expect(opensearchService.search).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({
          q: 'test',
          author: 'john',
        })
      );
    });

    it('should handle search with date range', async () => {
      const tenantId = 'tenant-1';
      const searchResults = { results: [], total: 0 };

      (cacheService.getSearchResult as jest.Mock).mockResolvedValue(null);
      (opensearchService.search as jest.Mock).mockResolvedValue(searchResults);
      (cacheService.setSearchResult as jest.Mock).mockResolvedValue(undefined);

      await request(app)
        .get('/search')
        .set('X-Tenant-Id', tenantId)
        .query({ q: 'test', from: '2024-01-01', to: '2024-12-31' });

      expect(opensearchService.search).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({
          q: 'test',
          from: '2024-01-01',
          to: '2024-12-31',
        })
      );
    });

    it('should handle pagination with offset and limit', async () => {
      const tenantId = 'tenant-1';
      const searchResults = { results: [], total: 0 };

      (cacheService.getSearchResult as jest.Mock).mockResolvedValue(null);
      (opensearchService.search as jest.Mock).mockResolvedValue(searchResults);
      (cacheService.setSearchResult as jest.Mock).mockResolvedValue(undefined);

      await request(app)
        .get('/search')
        .set('X-Tenant-Id', tenantId)
        .query({ q: 'test', offset: '10', limit: '20' });

      expect(opensearchService.search).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({
          q: 'test',
          offset: 10,
          limit: 20,
        })
      );
    });

    it('should limit maximum results to 50', async () => {
      const tenantId = 'tenant-1';
      const searchResults = { results: [], total: 0 };

      (cacheService.getSearchResult as jest.Mock).mockResolvedValue(null);
      (opensearchService.search as jest.Mock).mockResolvedValue(searchResults);
      (cacheService.setSearchResult as jest.Mock).mockResolvedValue(undefined);

      await request(app)
        .get('/search')
        .set('X-Tenant-Id', tenantId)
        .query({ q: 'test', limit: '100' });

      expect(opensearchService.search).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({
          limit: 50,
        })
      );
    });

    it('should use default values for offset and limit', async () => {
      const tenantId = 'tenant-1';
      const searchResults = { results: [], total: 0 };

      (cacheService.getSearchResult as jest.Mock).mockResolvedValue(null);
      (opensearchService.search as jest.Mock).mockResolvedValue(searchResults);
      (cacheService.setSearchResult as jest.Mock).mockResolvedValue(undefined);

      await request(app)
        .get('/search')
        .set('X-Tenant-Id', tenantId)
        .query({ q: 'test' });

      expect(opensearchService.search).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({
          offset: 0,
          limit: 10,
        })
      );
    });

    it('should handle search without query string', async () => {
      const tenantId = 'tenant-1';
      const searchResults = { results: [], total: 0 };

      (cacheService.getSearchResult as jest.Mock).mockResolvedValue(null);
      (opensearchService.search as jest.Mock).mockResolvedValue(searchResults);
      (cacheService.setSearchResult as jest.Mock).mockResolvedValue(undefined);

      await request(app)
        .get('/search')
        .set('X-Tenant-Id', tenantId);

      expect(opensearchService.search).toHaveBeenCalled();
    });

    it('should reject invalid offset', async () => {
      const tenantId = 'tenant-1';

      const response = await request(app)
        .get('/search')
        .set('X-Tenant-Id', tenantId)
        .query({ q: 'test', offset: 'invalid' });

      expect(response.status).toBe(400);
    });

    it('should reject invalid limit', async () => {
      const tenantId = 'tenant-1';

      const response = await request(app)
        .get('/search')
        .set('X-Tenant-Id', tenantId)
        .query({ q: 'test', limit: 'invalid' });

      expect(response.status).toBe(400);
    });

    it('should handle search errors', async () => {
      const tenantId = 'tenant-1';

      (cacheService.getSearchResult as jest.Mock).mockResolvedValue(null);
      (opensearchService.search as jest.Mock).mockRejectedValue(
        new Error('Search failed')
      );

      const response = await request(app)
        .get('/search')
        .set('X-Tenant-Id', tenantId)
        .query({ q: 'test' });

      expect(response.status).toBe(500);
    });
  });
});

