import { Request, Response, NextFunction } from 'express';
import { errorHandler, AppError } from '../errorHandler';
import { RequestContext } from '../../types';

describe('ErrorHandler Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      path: '/test',
      context: { tenantId: 'test-tenant' },
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  describe('AppError', () => {
    it('should create an AppError with status code and message', () => {
      const error = new AppError(404, 'Not found');
      
      expect(error).toBeInstanceOf(Error);
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Not found');
      expect(error.isOperational).toBe(true);
    });

    it('should create an AppError with custom isOperational flag', () => {
      const error = new AppError(500, 'Server error', false);
      
      expect(error.isOperational).toBe(false);
    });

    it('should have correct prototype chain', () => {
      const error = new AppError(400, 'Bad request');
      
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('errorHandler', () => {
    it('should handle AppError correctly', () => {
      const error = new AppError(404, 'Document not found');
      
      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Document not found',
      });
    });

    it('should handle AppError with different status codes', () => {
      const error = new AppError(400, 'Bad request');
      
      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Bad request',
      });
    });

    it('should handle generic Error as 500', () => {
      const error = new Error('Unexpected error');
      
      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Internal server error',
      });
    });

    it('should handle errors without stack trace', () => {
      const error = { message: 'Error without stack' } as Error;
      
      expect(() => {
        errorHandler(
          error,
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );
      }).not.toThrow();
    });

    it('should handle request without context', () => {
      const error = new AppError(404, 'Not found');
      mockRequest.context = undefined;
      
      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('should handle request without tenantId in context', () => {
      const error = new AppError(404, 'Not found');
      mockRequest.context = { tenantId: 'test-tenant' } as RequestContext;
      
      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('should handle errors with empty message', () => {
      const error = new AppError(500, '');
      
      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: '',
      });
    });
  });
});

