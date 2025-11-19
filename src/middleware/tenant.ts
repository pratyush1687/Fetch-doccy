import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import logger from '../utils/logger';

const TenantIdSchema = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);

export function extractTenantId(req: Request, res: Response, next: NextFunction): void {
  const tenantId = req.headers['x-tenant-id'] as string;

  if (!tenantId) {
    logger.warn('Missing X-Tenant-Id header', { path: req.path });
    res.status(400).json({
      error: 'Missing required header: X-Tenant-Id',
    });
    return;
  }

  const validationResult = TenantIdSchema.safeParse(tenantId);
  if (!validationResult.success) {
    logger.warn('Invalid tenant ID format', { tenantId, path: req.path });
    res.status(400).json({
      error: 'Invalid tenant ID format. Must be alphanumeric with hyphens/underscores.',
    });
    return;
  }

  req.context = {
    tenantId: validationResult.data,
  };

  next();
}

