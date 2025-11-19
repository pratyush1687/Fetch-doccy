import { Client } from '@opensearch-project/opensearch';
import { config } from '../config';
import logger from '../utils/logger';
import { Document, DocumentIndex, SearchQuery, SearchResult } from '../types';

class OpenSearchService {
  private client: Client;
  private indexName: string;

  constructor() {
    this.indexName = config.opensearch.index;
    
    const clientConfig: any = {
      node: config.opensearch.node,
    };

    // Only add auth if username/password are provided
    if (config.opensearch.username && config.opensearch.password) {
      clientConfig.auth = {
        username: config.opensearch.username,
        password: config.opensearch.password,
      };
    }

    this.client = new Client(clientConfig);
  }

  async initializeIndex(): Promise<void> {
    try {
      const exists = await this.client.indices.exists({ index: this.indexName });
      
      if (!exists.body) {
        logger.info('Creating OpenSearch index', { index: this.indexName });
        
        await this.client.indices.create({
          index: this.indexName,
          body: {
            settings: {
              number_of_shards: 1,
              number_of_replicas: 0,
              analysis: {
                analyzer: {
                  default: {
                    type: 'standard',
                  },
                },
              },
            },
            mappings: {
              properties: {
                tenant_id: {
                  type: 'keyword',
                },
                doc_id: {
                  type: 'keyword',
                },
                title: {
                  type: 'text',
                  analyzer: 'standard',
                },
                content: {
                  type: 'text',
                  analyzer: 'standard',
                },
                tags: {
                  type: 'keyword',
                },
                metadata: {
                  properties: {
                    author: { type: 'keyword' },
                    type: { type: 'keyword' },
                    department: { type: 'keyword' },
                  },
                },
                created_at: {
                  type: 'date',
                },
                updated_at: {
                  type: 'date',
                },
              },
            },
          },
        });

        logger.info('OpenSearch index created', { index: this.indexName });
      } else {
        logger.info('OpenSearch index already exists', { index: this.indexName });
      }
    } catch (error) {
      logger.error('Failed to initialize OpenSearch index', {
        error: (error as Error).message,
        index: this.indexName,
      });
      throw error;
    }
  }

  async indexDocument(tenantId: string, document: Document): Promise<void> {
    try {
      const now = new Date().toISOString();
      const docId = document.id || this.generateDocId();

      const indexDoc: DocumentIndex = {
        tenant_id: tenantId,
        doc_id: docId,
        title: document.title,
        content: document.content,
        tags: document.tags || [],
        metadata: document.metadata || {},
        created_at: document.createdAt || now,
        updated_at: document.updatedAt || now,
      };

      await this.client.index({
        index: this.indexName,
        id: `${tenantId}_${docId}`,
        body: indexDoc,
        refresh: true,
      });

      logger.info('Document indexed', { tenantId, docId });
    } catch (error) {
      logger.error('Failed to index document', {
        error: (error as Error).message,
        tenantId,
        docId: document.id,
      });
      throw error;
    }
  }

  async getDocument(tenantId: string, docId: string): Promise<Document | null> {
    try {
      const response = await this.client.get({
        index: this.indexName,
        id: `${tenantId}_${docId}`,
      });

      const source = response.body._source as DocumentIndex;
      
      // Verify tenant_id matches
      if (source.tenant_id !== tenantId) {
        logger.warn('Tenant mismatch on document retrieval', { tenantId, docId });
        return null;
      }

      return this.mapIndexToDocument(source);
    } catch (error: any) {
      if (error.statusCode === 404) {
        return null;
      }
      logger.error('Failed to get document', {
        error: error.message,
        tenantId,
        docId,
      });
      throw error;
    }
  }

  async deleteDocument(tenantId: string, docId: string): Promise<boolean> {
    try {
      await this.client.delete({
        index: this.indexName,
        id: `${tenantId}_${docId}`,
        refresh: true,
      });

      logger.info('Document deleted', { tenantId, docId });
      return true;
    } catch (error: any) {
      if (error.statusCode === 404) {
        logger.debug('Document not found for deletion', { tenantId, docId });
        return false;
      }
      logger.error('Failed to delete document', {
        error: error.message,
        tenantId,
        docId,
      });
      throw error;
    }
  }

  async search(tenantId: string, query: SearchQuery): Promise<{ results: SearchResult[]; total: number }> {
    try {
      const offset = query.offset || 0;
      const limit = Math.min(query.limit || 10, 50);

      const mustClauses: any[] = [];
      const filterClauses: any[] = [];

      // Tenant filter (mandatory)
      filterClauses.push({
        term: { tenant_id: tenantId },
      });

      // Full-text search query
      if (query.q && query.q.trim()) {
        mustClauses.push({
          bool: {
            should: [
              {
                multi_match: {
                  query: query.q,
                  fields: ['title^3', 'content', 'tags^2'],
                  type: 'best_fields',
                  operator: 'or',
                },
              },
            ],
          },
        });
      } else {
        // If no query, match all (still filtered by tenant)
        mustClauses.push({ match_all: {} });
      }

      // Additional filters
      if (query.tag) {
        filterClauses.push({
          term: { tags: query.tag },
        });
      }

      if (query.author) {
        filterClauses.push({
          term: { 'metadata.author': query.author },
        });
      }

      if (query.from || query.to) {
        const rangeFilter: any = {};
        if (query.from) rangeFilter.gte = query.from;
        if (query.to) rangeFilter.lte = query.to;
        filterClauses.push({
          range: { created_at: rangeFilter },
        });
      }

      const searchBody: any = {
        query: {
          bool: {
            must: mustClauses,
            filter: filterClauses,
          },
        },
        from: offset,
        size: limit,
        _source: ['doc_id', 'title', 'content', 'tags', 'metadata'],
        highlight: {
          fields: {
            title: {},
            content: {
              fragment_size: 150,
              number_of_fragments: 1,
            },
          },
        },
      };

      const response = await this.client.search({
        index: this.indexName,
        body: searchBody,
      });

      const hits = response.body.hits.hits || [];
      const total = response.body.hits.total.value || 0;

      const results: SearchResult[] = hits.map((hit: any) => {
        const source = hit._source;
        const highlight = hit.highlight || {};
        
        // Use highlighted snippet if available, otherwise truncate content
        let snippet = '';
        if (highlight.content && highlight.content.length > 0) {
          snippet = highlight.content[0];
        } else if (highlight.title && highlight.title.length > 0) {
          snippet = highlight.title[0];
        } else {
          snippet = source.content.substring(0, 150) + (source.content.length > 150 ? '...' : '');
        }

        return {
          id: source.doc_id,
          title: source.title,
          snippet,
          score: hit._score,
          tags: source.tags || [],
        };
      });

      return { results, total };
    } catch (error) {
      logger.error('Search failed', {
        error: (error as Error).message,
        tenantId,
        query: query.q,
      });
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.cluster.health();
      return response.body.status !== 'red';
    } catch (error) {
      logger.error('OpenSearch health check failed', { error: (error as Error).message });
      return false;
    }
  }

  private mapIndexToDocument(source: DocumentIndex): Document {
    return {
      id: source.doc_id,
      tenantId: source.tenant_id,
      title: source.title,
      content: source.content,
      tags: source.tags,
      metadata: source.metadata,
      createdAt: source.created_at,
      updatedAt: source.updated_at,
    };
  }

  private generateDocId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

export const opensearchService = new OpenSearchService();

