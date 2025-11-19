import request from 'supertest';
import express from 'express';
import healthRoutes from '../health.routes';
import { opensearchService } from '../../services/opensearch.service';
import { redisService } from '../../services/redis.service';

jest.mock('../../services/opensearch.service');
jest.mock('../../services/redis.service');

const app = express();
app.use('/health', healthRoutes);

describe('Health Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return UP status when all services are healthy', async () => {
      (opensearchService.healthCheck as jest.Mock).mockResolvedValue(true);
      (redisService.ping as jest.Mock).mockResolvedValue(true);

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'UP',
        dependencies: {
          elasticsearch: 'UP',
          redis: 'UP',
        },
      });
    });

    it('should return DEGRADED status when one service is down', async () => {
      (opensearchService.healthCheck as jest.Mock).mockResolvedValue(true);
      (redisService.ping as jest.Mock).mockResolvedValue(false);

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'DEGRADED',
        dependencies: {
          elasticsearch: 'UP',
          redis: 'DOWN',
        },
      });
    });

    it('should return DEGRADED status when OpenSearch is down but Redis is up', async () => {
      (opensearchService.healthCheck as jest.Mock).mockResolvedValue(false);
      (redisService.ping as jest.Mock).mockResolvedValue(true);

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'DEGRADED',
        dependencies: {
          elasticsearch: 'DOWN',
          redis: 'UP',
        },
      });
    });

    it('should return DOWN status when all services are down', async () => {
      (opensearchService.healthCheck as jest.Mock).mockResolvedValue(false);
      (redisService.ping as jest.Mock).mockResolvedValue(false);

      const response = await request(app).get('/health');

      expect(response.status).toBe(503);
      expect(response.body).toEqual({
        status: 'DOWN',
        dependencies: {
          elasticsearch: 'DOWN',
          redis: 'DOWN',
        },
      });
    });

    it('should handle OpenSearch health check errors', async () => {
      (opensearchService.healthCheck as jest.Mock).mockResolvedValue(false);
      (redisService.ping as jest.Mock).mockResolvedValue(true);

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('DEGRADED');
      expect(response.body.dependencies.elasticsearch).toBe('DOWN');
    });

    it('should handle Redis ping errors', async () => {
      (opensearchService.healthCheck as jest.Mock).mockResolvedValue(true);
      (redisService.ping as jest.Mock).mockResolvedValue(false);

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('DEGRADED');
      expect(response.body.dependencies.redis).toBe('DOWN');
    });

    it('should check both services in parallel', async () => {
      (opensearchService.healthCheck as jest.Mock).mockResolvedValue(true);
      (redisService.ping as jest.Mock).mockResolvedValue(true);

      await request(app).get('/health');

      expect(opensearchService.healthCheck).toHaveBeenCalled();
      expect(redisService.ping).toHaveBeenCalled();
    });
  });
});

