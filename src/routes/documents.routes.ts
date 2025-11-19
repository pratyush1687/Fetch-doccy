import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { opensearchService } from '../services/opensearch.service';
import { cacheService } from '../services/cache.service';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import { Document } from '../types';

const router = Router();

const DocumentSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1).max(500),
  content: z.string().min(1).max(100000),
  tags: z.array(z.string()).optional(),
  metadata: z.object({
    author: z.string().optional(),
    type: z.string().optional(),
    department: z.string().optional(),
  }).optional(),
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.context?.tenantId;
    if (!tenantId) {
      throw new AppError(400, 'Tenant ID is required');
    }

    const validationResult = DocumentSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new AppError(400, `Validation error: ${validationResult.error.message}`);
    }

    const document: Document = {
      ...validationResult.data,
      tenantId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await opensearchService.indexDocument(tenantId, document);
    
    const docId = document.id || 'generated';
    
    // Invalidate search cache for this tenant
    await cacheService.invalidateTenantSearches(tenantId);

    logger.info('Document created', { tenantId, docId });

    res.status(201).json({
      id: docId,
      tenantId,
      status: 'indexed',
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next) => {
  try {
    const tenantId = req.context?.tenantId;
    if (!tenantId) {
      throw new AppError(400, 'Tenant ID is required');
    }

    const docId = req.params.id;

    // Check cache first
    const cached = await cacheService.getDocument(tenantId, docId);
    if (cached) {
      res.json(cached);
      return;
    }

    // Query OpenSearch
    const document = await opensearchService.getDocument(tenantId, docId);
    
    if (!document) {
      throw new AppError(404, 'Document not found');
    }

    // Cache the result
    await cacheService.setDocument(tenantId, docId, document);

    res.json(document);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req: Request, res: Response, next) => {
  try {
    const tenantId = req.context?.tenantId;
    if (!tenantId) {
      throw new AppError(400, 'Tenant ID is required');
    }

    const docId = req.params.id;

    const deleted = await opensearchService.deleteDocument(tenantId, docId);
    
    // Invalidate cache
    await cacheService.invalidateDocument(tenantId, docId);
    await cacheService.invalidateTenantSearches(tenantId);

    logger.info('Document deleted', { tenantId, docId, deleted });

    res.json({
      id: docId,
      tenantId,
      status: deleted ? 'deleted' : 'not_found_or_deleted',
    });
  } catch (error) {
    next(error);
  }
});

export default router;

