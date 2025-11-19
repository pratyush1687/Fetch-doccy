export interface Document {
  id?: string;
  tenantId: string;
  title: string;
  content: string;
  tags?: string[];
  metadata?: {
    author?: string;
    type?: string;
    department?: string;
    [key: string]: any;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface DocumentIndex {
  tenant_id: string;
  doc_id: string;
  title: string;
  content: string;
  tags?: string[];
  metadata?: {
    author?: string;
    type?: string;
    department?: string;
    [key: string]: any;
  };
  created_at: string;
  updated_at: string;
}

export interface SearchQuery {
  q: string;
  offset?: number;
  limit?: number;
  tag?: string;
  author?: string;
  from?: string;
  to?: string;
}

export interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  score: number;
  tags?: string[];
}

export interface SearchResponse {
  tenantId: string;
  query: string;
  offset: number;
  limit: number;
  total: number;
  results: SearchResult[];
}

export interface HealthStatus {
  status: 'UP' | 'DOWN' | 'DEGRADED';
  dependencies: {
    elasticsearch: 'UP' | 'DOWN';
    redis: 'UP' | 'DOWN';
  };
}

export interface RequestContext {
  tenantId: string;
  [key: string]: any;
}

declare global {
  namespace Express {
    interface Request {
      context?: RequestContext;
    }
  }
}

