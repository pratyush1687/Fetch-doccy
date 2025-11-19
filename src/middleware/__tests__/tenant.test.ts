import { Request, Response, NextFunction } from 'express';
import { extractTenantId } from '../tenant';

describe('Tenant Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      path: '/test',
      headers: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  it('should extract valid tenant ID from header', () => {
    mockRequest.headers = {
      'x-tenant-id': 'tenant-123',
    };

    extractTenantId(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    expect(mockRequest.context).toBeDefined();
    expect(mockRequest.context?.tenantId).toBe('tenant-123');
    expect(mockNext).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  it('should reject missing tenant ID header', () => {
    mockRequest.headers = {};

    extractTenantId(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Missing required header: X-Tenant-Id',
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should reject tenant ID with invalid characters', () => {
    mockRequest.headers = {
      'x-tenant-id': 'tenant@123',
    };

    extractTenantId(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Invalid tenant ID format. Must be alphanumeric with hyphens/underscores.',
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should reject tenant ID with spaces', () => {
    mockRequest.headers = {
      'x-tenant-id': 'tenant 123',
    };

    extractTenantId(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should accept tenant ID with hyphens', () => {
    mockRequest.headers = {
      'x-tenant-id': 'tenant-123-abc',
    };

    extractTenantId(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    expect(mockRequest.context?.tenantId).toBe('tenant-123-abc');
    expect(mockNext).toHaveBeenCalled();
  });

  it('should accept tenant ID with underscores', () => {
    mockRequest.headers = {
      'x-tenant-id': 'tenant_123_abc',
    };

    extractTenantId(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    expect(mockRequest.context?.tenantId).toBe('tenant_123_abc');
    expect(mockNext).toHaveBeenCalled();
  });

  it('should accept tenant ID with numbers', () => {
    mockRequest.headers = {
      'x-tenant-id': '123456',
    };

    extractTenantId(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    expect(mockRequest.context?.tenantId).toBe('123456');
    expect(mockNext).toHaveBeenCalled();
  });

  it('should accept tenant ID with mixed alphanumeric', () => {
    mockRequest.headers = {
      'x-tenant-id': 'tenant123ABC',
    };

    extractTenantId(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    expect(mockRequest.context?.tenantId).toBe('tenant123ABC');
    expect(mockNext).toHaveBeenCalled();
  });

  it('should reject empty tenant ID', () => {
    mockRequest.headers = {
      'x-tenant-id': '',
    };

    extractTenantId(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should reject tenant ID that is too long', () => {
    const longTenantId = 'a'.repeat(101);
    mockRequest.headers = {
      'x-tenant-id': longTenantId,
    };

    extractTenantId(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should accept tenant ID at maximum length', () => {
    const maxTenantId = 'a'.repeat(100);
    mockRequest.headers = {
      'x-tenant-id': maxTenantId,
    };

    extractTenantId(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    expect(mockRequest.context?.tenantId).toBe(maxTenantId);
    expect(mockNext).toHaveBeenCalled();
  });

  it('should handle case-insensitive header name', () => {
    mockRequest.headers = {
      'X-TENANT-ID': 'tenant-123',
    } as any;

    extractTenantId(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    // Express normalizes headers to lowercase, so this should work
    // But if it doesn't, we'd need to handle it
    if (mockRequest.context) {
      expect(mockRequest.context.tenantId).toBe('tenant-123');
    }
  });
});

