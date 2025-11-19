import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import documentsRoutes from '../documents.routes';
import { opensearchService } from '../../services/opensearch.service';
import { cacheService } from '../../services/cache.service';

jest.mock('../../services/opensearch.service');
jest.mock('../../services/cache.service');

// Mock middleware to set tenant context
const mockTenantMiddleware = (req: Request,_res: Response, next: NextFunction) => {
  const tenantId = req.headers['x-tenant-id'] as string;
  if (tenantId) {
    req.context = { tenantId };
  }
  next();
};

const app = express();
app.use(express.json());
app.use('/documents', mockTenantMiddleware, documentsRoutes);

describe('Documents Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /documents', () => {
    it('should create a document successfully', async () => {
      const tenantId = 'tenant-1';
      const document = {
        title: 'Test Document',
        content: 'Test content',
      };

      (opensearchService.indexDocument as jest.Mock).mockResolvedValue(undefined);
      (cacheService.invalidateTenantSearches as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/documents')
        .set('X-Tenant-Id', tenantId)
        .send(document);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('tenantId', tenantId);
      expect(response.body).toHaveProperty('status', 'indexed');
      expect(opensearchService.indexDocument).toHaveBeenCalled();
      expect(cacheService.invalidateTenantSearches).toHaveBeenCalledWith(tenantId);
    });

    it('should create document with tags and metadata', async () => {
      const tenantId = 'tenant-1';
      const document = {
        title: 'Test Document',
        content: 'Test content',
        tags: ['important', 'test'],
        metadata: {
          author: 'John Doe',
          type: 'article',
        },
      };

      (opensearchService.indexDocument as jest.Mock).mockResolvedValue(undefined);
      (cacheService.invalidateTenantSearches as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/documents')
        .set('X-Tenant-Id', tenantId)
        .send(document);

      expect(response.status).toBe(201);
      expect(opensearchService.indexDocument).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({
          title: document.title,
          content: document.content,
          tags: document.tags,
          metadata: document.metadata,
        })
      );
    });

    it('should reject document with missing title', async () => {
      const tenantId = 'tenant-1';
      const document = {
        content: 'Test content',
      };

      const response = await request(app)
        .post('/documents')
        .set('X-Tenant-Id', tenantId)
        .send(document);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject document with missing content', async () => {
      const tenantId = 'tenant-1';
      const document = {
        title: 'Test Document',
      };

      const response = await request(app)
        .post('/documents')
        .set('X-Tenant-Id', tenantId)
        .send(document);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject document with title too long', async () => {
      const tenantId = 'tenant-1';
      const document = {
        title: 'a'.repeat(501),
        content: 'Test content',
      };

      const response = await request(app)
        .post('/documents')
        .set('X-Tenant-Id', tenantId)
        .send(document);

      expect(response.status).toBe(400);
    });

    it('should reject document with content too long', async () => {
      const tenantId = 'tenant-1';
      const document = {
        title: 'Test Document',
        content: 'a'.repeat(100001),
      };

      const response = await request(app)
        .post('/documents')
        .set('X-Tenant-Id', tenantId)
        .send(document);

      expect(response.status).toBe(400);
    });

    it('should handle indexing errors', async () => {
      const tenantId = 'tenant-1';
      const document = {
        title: 'Test Document',
        content: 'Test content',
      };

      (opensearchService.indexDocument as jest.Mock).mockRejectedValue(
        new Error('Indexing failed')
      );

      const response = await request(app)
        .post('/documents')
        .set('X-Tenant-Id', tenantId)
        .send(document);

      expect(response.status).toBe(500);
    });
  });

  describe('GET /documents/:id', () => {
    it('should retrieve document from cache', async () => {
      const tenantId = 'tenant-1';
      const docId = 'doc-123';
      const cachedDocument = {
        id: docId,
        tenantId,
        title: 'Cached Document',
        content: 'Cached content',
      };

      (cacheService.getDocument as jest.Mock).mockResolvedValue(cachedDocument);

      const response = await request(app)
        .get(`/documents/${docId}`)
        .set('X-Tenant-Id', tenantId);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(cachedDocument);
      expect(opensearchService.getDocument).not.toHaveBeenCalled();
    });

    it('should retrieve document from OpenSearch when not cached', async () => {
      const tenantId = 'tenant-1';
      const docId = 'doc-123';
      const document = {
        id: docId,
        tenantId,
        title: 'Test Document',
        content: 'Test content',
      };

      (cacheService.getDocument as jest.Mock).mockResolvedValue(null);
      (opensearchService.getDocument as jest.Mock).mockResolvedValue(document);
      (cacheService.setDocument as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .get(`/documents/${docId}`)
        .set('X-Tenant-Id', tenantId);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(document);
      expect(opensearchService.getDocument).toHaveBeenCalledWith(tenantId, docId);
      expect(cacheService.setDocument).toHaveBeenCalledWith(tenantId, docId, document);
    });

    it('should return 404 when document not found', async () => {
      const tenantId = 'tenant-1';
      const docId = 'non-existent';

      (cacheService.getDocument as jest.Mock).mockResolvedValue(null);
      (opensearchService.getDocument as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get(`/documents/${docId}`)
        .set('X-Tenant-Id', tenantId);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Document not found');
    });

    it('should handle OpenSearch errors', async () => {
      const tenantId = 'tenant-1';
      const docId = 'doc-123';

      (cacheService.getDocument as jest.Mock).mockResolvedValue(null);
      (opensearchService.getDocument as jest.Mock).mockRejectedValue(
        new Error('OpenSearch error')
      );

      const response = await request(app)
        .get(`/documents/${docId}`)
        .set('X-Tenant-Id', tenantId);

      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /documents/:id', () => {
    it('should delete document successfully', async () => {
      const tenantId = 'tenant-1';
      const docId = 'doc-123';

      (opensearchService.deleteDocument as jest.Mock).mockResolvedValue(true);
      (cacheService.invalidateDocument as jest.Mock).mockResolvedValue(undefined);
      (cacheService.invalidateTenantSearches as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .delete(`/documents/${docId}`)
        .set('X-Tenant-Id', tenantId);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', docId);
      expect(response.body).toHaveProperty('tenantId', tenantId);
      expect(response.body).toHaveProperty('status', 'deleted');
      expect(opensearchService.deleteDocument).toHaveBeenCalledWith(tenantId, docId);
      expect(cacheService.invalidateDocument).toHaveBeenCalledWith(tenantId, docId);
      expect(cacheService.invalidateTenantSearches).toHaveBeenCalledWith(tenantId);
    });

    it('should handle document not found', async () => {
      const tenantId = 'tenant-1';
      const docId = 'non-existent';

      (opensearchService.deleteDocument as jest.Mock).mockResolvedValue(false);
      (cacheService.invalidateDocument as jest.Mock).mockResolvedValue(undefined);
      (cacheService.invalidateTenantSearches as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .delete(`/documents/${docId}`)
        .set('X-Tenant-Id', tenantId);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'not_found_or_deleted');
    });

    it('should handle deletion errors', async () => {
      const tenantId = 'tenant-1';
      const docId = 'doc-123';

      (opensearchService.deleteDocument as jest.Mock).mockRejectedValue(
        new Error('Deletion failed')
      );

      const response = await request(app)
        .delete(`/documents/${docId}`)
        .set('X-Tenant-Id', tenantId);

      expect(response.status).toBe(500);
    });
  });
});

