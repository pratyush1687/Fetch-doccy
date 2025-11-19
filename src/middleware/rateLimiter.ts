import { Request, Response, NextFunction } from 'express';
import { redisService } from '../services/redis.service';
import { config } from '../config';
import logger from '../utils/logger';
import { AppError } from './errorHandler';

export function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  const tenantId = req.context?.tenantId;
  
  if (!tenantId) {
    // If no tenant ID, skip rate limiting (shouldn't happen if tenant middleware runs first)
    next();
    return;
  }

  // Use async IIFE to handle Redis calls
  (async () => {
    try {
      const key = `ratelimit:${tenantId}`;
      const windowMs = config.rateLimit.windowMs;
      const maxRequests = config.rateLimit.maxRequests;
      const now = Date.now();
      const windowStart = Math.floor(now / windowMs) * windowMs;
      const resetTime = windowStart + windowMs;

      // Get current count
      const countKey = `${key}:${windowStart}`;
      const currentCount = await redisService.get<number>(countKey) || 0;

      if (currentCount >= maxRequests) {
        const retryAfter = Math.ceil((resetTime - now) / 1000);
        res.setHeader('X-RateLimit-Limit', maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', '0');
        res.setHeader('X-RateLimit-Reset', new Date(resetTime).toISOString());
        res.setHeader('Retry-After', retryAfter.toString());

        logger.warn('Rate limit exceeded', { tenantId, currentCount, maxRequests });
        
        const error = new AppError(
          429,
          `Rate limit exceeded. Maximum ${maxRequests} requests per ${windowMs / 1000} seconds. Retry after ${retryAfter} seconds.`
        );
        next(error);
        return;
      }

      // Increment counter
      const newCount = currentCount + 1;
      await redisService.set(countKey, newCount, Math.ceil(windowMs / 1000));

      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - newCount).toString());
      res.setHeader('X-RateLimit-Reset', new Date(resetTime).toISOString());

      next();
    } catch (error) {
      // If Redis fails, log but allow request (fail open)
      logger.error('Rate limiter error', {
        error: (error as Error).message,
        tenantId,
      });
      next();
    }
  })();
}

