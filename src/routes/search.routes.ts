import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { opensearchService } from '../services/opensearch.service';
import { cacheService } from '../services/cache.service';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import { SearchQuery, SearchResponse } from '../types';

const router = Router();

const SearchQuerySchema = z.object({
  q: z.string().min(1).optional(),
  offset: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  tag: z.string().optional(),
  author: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.context?.tenantId;
    if (!tenantId) {
      throw new AppError(400, 'Tenant ID is required');
    }

    const validationResult = SearchQuerySchema.safeParse(req.query);
    if (!validationResult.success) {
      throw new AppError(400, `Invalid query parameters: ${validationResult.error.message}`);
    }

    const query: SearchQuery = {
      q: validationResult.data.q || '',
      offset: validationResult.data.offset || 0,
      limit: validationResult.data.limit || 10,
      tag: validationResult.data.tag,
      author: validationResult.data.author,
      from: validationResult.data.from,
      to: validationResult.data.to,
    };

    // Validate limit
    if (query.limit && query.limit > 50) {
      query.limit = 50;
    }

    // Check cache
    const cached = await cacheService.getSearchResult(
      tenantId,
      query.q || '',
      {
        tag: query.tag,
        author: query.author,
        from: query.from,
        to: query.to,
      },
      query.offset || 0,
      query.limit || 10
    );

    if (cached) {
      res.json(cached);
      return;
    }

    // Perform search
    const { results, total } = await opensearchService.search(tenantId, query);

    const response: SearchResponse = {
      tenantId,
      query: query.q || '',
      offset: query.offset || 0,
      limit: query.limit || 10,
      total,
      results,
    };

    // Cache the result
    await cacheService.setSearchResult(
      tenantId,
      query.q || '',
      {
        tag: query.tag,
        author: query.author,
        from: query.from,
        to: query.to,
      },
      query.offset || 0,
      query.limit || 10,
      response
    );

    logger.info('Search performed', { tenantId, query: query.q, total });

    res.json(response);
    return;
  } catch (error) {
    next(error);
    return;
  }
});

export default router;

