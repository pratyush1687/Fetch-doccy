import { opensearchService } from '../opensearch.service';
import { Client } from '@opensearch-project/opensearch';
import { Document, SearchQuery } from '../../types';

jest.mock('@opensearch-project/opensearch');

describe('OpenSearchService', () => {
  let mockIndicesExists: jest.Mock;
  let mockIndicesCreate: jest.Mock;
  let mockIndex: jest.Mock;
  let mockGet: jest.Mock;
  let mockDelete: jest.Mock;
  let mockSearch: jest.Mock;
  let mockClusterHealth: jest.Mock;
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create individual mock functions
    mockIndicesExists = jest.fn();
    mockIndicesCreate = jest.fn();
    mockIndex = jest.fn();
    mockGet = jest.fn();
    mockDelete = jest.fn();
    mockSearch = jest.fn();
    mockClusterHealth = jest.fn();
    
    mockClient = {
      indices: {
        exists: mockIndicesExists,
        create: mockIndicesCreate,
      },
      index: mockIndex,
      get: mockGet,
      delete: mockDelete,
      search: mockSearch,
      cluster: {
        health: mockClusterHealth,
      },
    };

    (Client as jest.MockedClass<typeof Client>).mockImplementation(() => mockClient);
  });

  describe('initializeIndex', () => {
    it('should create index if it does not exist', async () => {
      mockIndicesExists.mockResolvedValue({ body: false });

      await opensearchService.initializeIndex();

      expect(mockIndicesCreate).toHaveBeenCalled();
    });

    it('should not create index if it already exists', async () => {
      mockIndicesExists.mockResolvedValue({ body: true });

      await opensearchService.initializeIndex();

      expect(mockIndicesCreate).not.toHaveBeenCalled();
    });

    it('should throw error on initialization failure', async () => {
      mockIndicesExists.mockRejectedValue(new Error('Connection failed'));

      await expect(opensearchService.initializeIndex()).rejects.toThrow();
    });
  });

  describe('indexDocument', () => {
    it('should index document successfully', async () => {
      const tenantId = 'tenant-1';
      const document: Document = {
        id: 'doc-123',
        tenantId,
        title: 'Test Document',
        content: 'Test content',
      };

      mockIndex.mockResolvedValue({});

      await opensearchService.indexDocument(tenantId, document);

      expect(mockIndex).toHaveBeenCalledWith(
        expect.objectContaining({
          index: expect.any(String),
          id: `${tenantId}_doc-123`,
          body: expect.objectContaining({
            tenant_id: tenantId,
            doc_id: 'doc-123',
            title: document.title,
            content: document.content,
          }),
        })
      );
    });

    it('should generate doc ID if not provided', async () => {
      const tenantId = 'tenant-1';
      const document: Document = {
        tenantId,
        title: 'Test Document',
        content: 'Test content',
      };

      mockIndex.mockResolvedValue({});

      await opensearchService.indexDocument(tenantId, document);

      expect(mockIndex).toHaveBeenCalled();
      const callArgs = mockIndex.mock.calls[0][0] as any;
      expect(callArgs.id).toContain(tenantId);
      expect(callArgs.body.doc_id).toBeDefined();
    });

    it('should include tags and metadata', async () => {
      const tenantId = 'tenant-1';
      const document: Document = {
        tenantId,
        title: 'Test',
        content: 'Content',
        tags: ['tag1', 'tag2'],
        metadata: { author: 'John', type: 'article' },
      };

      mockIndex.mockResolvedValue({});

      await opensearchService.indexDocument(tenantId, document);

      const callArgs = mockIndex.mock.calls[0][0] as any;
      expect(callArgs.body.tags).toEqual(['tag1', 'tag2']);
      expect(callArgs.body.metadata).toEqual({ author: 'John', type: 'article' });
    });

    it('should throw error on indexing failure', async () => {
      const tenantId = 'tenant-1';
      const document: Document = {
        tenantId,
        title: 'Test',
        content: 'Content',
      };

      mockIndex.mockRejectedValue(new Error('Indexing failed'));

      await expect(
        opensearchService.indexDocument(tenantId, document)
      ).rejects.toThrow();
    });
  });

  describe('getDocument', () => {
    it('should retrieve document successfully', async () => {
      const tenantId = 'tenant-1';
      const docId = 'doc-123';
      const documentIndex = {
        tenant_id: tenantId,
        doc_id: docId,
        title: 'Test Document',
        content: 'Test content',
        tags: [],
        metadata: {},
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockGet.mockResolvedValue({
        body: { _source: documentIndex },
      });

      const result = await opensearchService.getDocument(tenantId, docId);

      expect(result).toBeDefined();
      expect(result?.id).toBe(docId);
      expect(result?.tenantId).toBe(tenantId);
      expect(mockGet).toHaveBeenCalledWith({
        index: expect.any(String),
        id: `${tenantId}_${docId}`,
      });
    });

    it('should return null when document not found', async () => {
      const tenantId = 'tenant-1';
      const docId = 'non-existent';

      const error: any = new Error('Not found');
      error.statusCode = 404;
      mockGet.mockRejectedValue(error);

      const result = await opensearchService.getDocument(tenantId, docId);

      expect(result).toBeNull();
    });

    it('should return null on tenant mismatch', async () => {
      const tenantId = 'tenant-1';
      const docId = 'doc-123';
      const documentIndex = {
        tenant_id: 'different-tenant',
        doc_id: docId,
        title: 'Test',
        content: 'Content',
        tags: [],
        metadata: {},
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockGet.mockResolvedValue({
        body: { _source: documentIndex },
      });

      const result = await opensearchService.getDocument(tenantId, docId);

      expect(result).toBeNull();
    });

    it('should throw error on non-404 errors', async () => {
      const tenantId = 'tenant-1';
      const docId = 'doc-123';

      const error: any = new Error('Server error');
      error.statusCode = 500;
      mockGet.mockRejectedValue(error);

      await expect(
        opensearchService.getDocument(tenantId, docId)
      ).rejects.toThrow();
    });
  });

  describe('deleteDocument', () => {
    it('should delete document successfully', async () => {
      const tenantId = 'tenant-1';
      const docId = 'doc-123';

      mockDelete.mockResolvedValue({});

      const result = await opensearchService.deleteDocument(tenantId, docId);

      expect(result).toBe(true);
      expect(mockDelete).toHaveBeenCalledWith({
        index: expect.any(String),
        id: `${tenantId}_${docId}`,
        refresh: true,
      });
    });

    it('should return false when document not found', async () => {
      const tenantId = 'tenant-1';
      const docId = 'non-existent';

      const error: any = new Error('Not found');
      error.statusCode = 404;
      mockDelete.mockRejectedValue(error);

      const result = await opensearchService.deleteDocument(tenantId, docId);

      expect(result).toBe(false);
    });

    it('should throw error on non-404 errors', async () => {
      const tenantId = 'tenant-1';
      const docId = 'doc-123';

      const error: any = new Error('Server error');
      error.statusCode = 500;
      mockDelete.mockRejectedValue(error);

      await expect(
        opensearchService.deleteDocument(tenantId, docId)
      ).rejects.toThrow();
    });
  });

  describe('search', () => {
    it('should perform search with query', async () => {
      const tenantId = 'tenant-1';
      const query: SearchQuery = {
        q: 'test query',
        offset: 0,
        limit: 10,
      };

      mockSearch.mockResolvedValue({
        body: {
          hits: {
            hits: [],
            total: { value: 0 },
          },
        },
      });

      const result = await opensearchService.search(tenantId, query);

      expect(result).toBeDefined();
      expect(result.results).toEqual([]);
      expect(result.total).toBe(0);
      expect(mockSearch).toHaveBeenCalled();
    });

    it('should include tenant filter in search', async () => {
      const tenantId = 'tenant-1';
      const query: SearchQuery = { q: 'test' };

      mockSearch.mockResolvedValue({
        body: {
          hits: {
            hits: [],
            total: { value: 0 },
          },
        },
      });

      await opensearchService.search(tenantId, query);

      const callArgs = mockSearch.mock.calls[0][0] as any;
      const filterClauses = callArgs.body.query.bool.filter;
      expect(filterClauses).toContainEqual({
        term: { tenant_id: tenantId },
      });
    });

    it('should apply tag filter when provided', async () => {
      const tenantId = 'tenant-1';
      const query: SearchQuery = {
        q: 'test',
        tag: 'important',
      };

      mockSearch.mockResolvedValue({
        body: {
          hits: {
            hits: [],
            total: { value: 0 },
          },
        },
      });

      await opensearchService.search(tenantId, query);

      const callArgs = mockSearch.mock.calls[0][0] as any;
      const filterClauses = callArgs.body.query.bool.filter;
      expect(filterClauses).toContainEqual({
        term: { tags: 'important' },
      });
    });

    it('should apply author filter when provided', async () => {
      const tenantId = 'tenant-1';
      const query: SearchQuery = {
        q: 'test',
        author: 'john',
      };

      mockSearch.mockResolvedValue({
        body: {
          hits: {
            hits: [],
            total: { value: 0 },
          },
        },
      });

      await opensearchService.search(tenantId, query);

      const callArgs = mockSearch.mock.calls[0][0] as any;
      const filterClauses = callArgs.body.query.bool.filter;
      expect(filterClauses).toContainEqual({
        term: { 'metadata.author': 'john' },
      });
    });

    it('should apply date range filter when provided', async () => {
      const tenantId = 'tenant-1';
      const query: SearchQuery = {
        q: 'test',
        from: '2024-01-01',
        to: '2024-12-31',
      };

      mockSearch.mockResolvedValue({
        body: {
          hits: {
            hits: [],
            total: { value: 0 },
          },
        },
      });

      await opensearchService.search(tenantId, query);

      const callArgs = mockSearch.mock.calls[0][0] as any;
      const filterClauses = callArgs.body.query.bool.filter;
      const rangeFilter = filterClauses.find((f: any) => f.range);
      expect(rangeFilter).toBeDefined();
      expect(rangeFilter.range.created_at.gte).toBe('2024-01-01');
      expect(rangeFilter.range.created_at.lte).toBe('2024-12-31');
    });

    it('should limit results to maximum 50', async () => {
      const tenantId = 'tenant-1';
      const query: SearchQuery = {
        q: 'test',
        limit: 100,
      };

      mockSearch.mockResolvedValue({
        body: {
          hits: {
            hits: [],
            total: { value: 0 },
          },
        },
      });

      await opensearchService.search(tenantId, query);

      const callArgs = mockSearch.mock.calls[0][0] as any;
      expect(callArgs.body.size).toBe(50);
    });

    it('should map search results correctly', async () => {
      const tenantId = 'tenant-1';
      const query: SearchQuery = { q: 'test' };

      mockSearch.mockResolvedValue({
        body: {
          hits: {
            hits: [
              {
                _source: {
                  doc_id: 'doc-1',
                  title: 'Test Document',
                  content: 'This is a test document with some content',
                  tags: ['test'],
                },
                _score: 0.95,
                highlight: {
                  content: ['This is a <em>test</em> document'],
                },
              },
            ],
            total: { value: 1 },
          },
        },
      });

      const result = await opensearchService.search(tenantId, query);

      expect(result.results).toHaveLength(1);
      expect(result.results[0].id).toBe('doc-1');
      expect(result.results[0].title).toBe('Test Document');
      expect(result.results[0].snippet).toContain('test');
      expect(result.results[0].score).toBe(0.95);
    });

    it('should throw error on search failure', async () => {
      const tenantId = 'tenant-1';
      const query: SearchQuery = { q: 'test' };

      mockSearch.mockRejectedValue(new Error('Search failed'));

      await expect(
        opensearchService.search(tenantId, query)
      ).rejects.toThrow();
    });
  });

  describe('healthCheck', () => {
    it('should return true when cluster is healthy', async () => {
      mockClusterHealth.mockResolvedValue({
        body: { status: 'green' },
      });

      const result = await opensearchService.healthCheck();

      expect(result).toBe(true);
    });

    it('should return true when cluster is yellow', async () => {
      mockClusterHealth.mockResolvedValue({
        body: { status: 'yellow' },
      });

      const result = await opensearchService.healthCheck();

      expect(result).toBe(true);
    });

    it('should return false when cluster is red', async () => {
      mockClusterHealth.mockResolvedValue({
        body: { status: 'red' },
      });

      const result = await opensearchService.healthCheck();

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockClusterHealth.mockRejectedValue(new Error('Connection failed'));

      const result = await opensearchService.healthCheck();

      expect(result).toBe(false);
    });
  });
});

