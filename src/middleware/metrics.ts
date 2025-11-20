import { Request, Response, NextFunction } from 'express';
import { metricsService } from '../services/metrics.service';

/**
 * Middleware to track request metrics using prom-client
 * Automatically records latency, status codes, and errors
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const route = req.route?.path || req.path;

  // Override res.end to capture response status and latency
  const originalEnd = res.end.bind(res);
  res.end = function (chunk?: any, encoding?: any, cb?: any): Response {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    
    // Record metrics using prom-client
    metricsService.recordRequest(req.method, route, duration, statusCode);
    
    // Call original end with proper arguments
    if (typeof chunk === 'function') {
      return originalEnd(chunk);
    } else if (typeof encoding === 'function') {
      return originalEnd(chunk, encoding);
    } else {
      return originalEnd(chunk, encoding, cb);
    }
  };

  next();
}

