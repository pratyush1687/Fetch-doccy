import { Router, Request, Response } from 'express';
import { metricsService } from '../services/metrics.service';

const router = Router();

/**
 * GET /metrics
 * Returns metrics in Prometheus format (standard for scraping)
 * This is the standard endpoint that Prometheus scrapes
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const metrics = await metricsService.getMetrics();
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(metrics);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve metrics',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /metrics/json
 * Returns metrics in JSON format (easier to read for humans)
 */
router.get('/json', async (_req: Request, res: Response) => {
  try {
    const summary = await metricsService.getSummary();
    res.json(summary);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve metrics',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /metrics/summary
 * Returns a quick summary of key metrics (backward compatibility)
 */
router.get('/summary', async (_req: Request, res: Response) => {
  try {
    const summary = await metricsService.getSummary();
    res.json(summary);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve metrics summary',
      message: (error as Error).message,
    });
  }
});

export default router;

