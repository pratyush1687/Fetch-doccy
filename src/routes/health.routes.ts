import { Router, Request, Response } from 'express';
import { opensearchService } from '../services/opensearch.service';
import { redisService } from '../services/redis.service';
import { HealthStatus } from '../types';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const [opensearchHealthy, redisHealthy] = await Promise.all([
    opensearchService.healthCheck(),
    redisService.ping(),
  ]);

  const status: HealthStatus = {
    status: opensearchHealthy && redisHealthy ? 'UP' : opensearchHealthy || redisHealthy ? 'DEGRADED' : 'DOWN',
    dependencies: {
      elasticsearch: opensearchHealthy ? 'UP' : 'DOWN',
      redis: redisHealthy ? 'UP' : 'DOWN',
    },
  };

  const httpStatus = status.status === 'UP' ? 200 : status.status === 'DEGRADED' ? 200 : 503;
  res.status(httpStatus).json(status);
});

export default router;

