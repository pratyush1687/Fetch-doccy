import { Request, Response, NextFunction } from 'express';
import { RequestContext } from '../types';

/**
 * Mock tenant middleware for testing
 */
export const mockTenantMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  const tenantId = req.headers['x-tenant-id'] as string;
  if (tenantId) {
    req.context = { tenantId };
  }
  next();
};

/**
 * Create a mock Express request
 */
export const createMockRequest = (overrides: Partial<Request> = {}): Partial<Request> => {
  return {
    path: '/test',
    method: 'GET',
    headers: {},
    query: {},
    params: {},
    body: {},
    context: {
      tenantId: 'test-tenant'
    } as RequestContext,
    ...overrides,
  };
};

/**
 * Create a mock Express response
 */
export const createMockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
  };
  return res;
};

/**
 * Create a mock NextFunction
 */
export const createMockNext = (): NextFunction => {
  return jest.fn();
};

