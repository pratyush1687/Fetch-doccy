import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import { extractTenantId } from './middleware/tenant';
import { rateLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import documentsRoutes from './routes/documents.routes';
import searchRoutes from './routes/search.routes';
import healthRoutes from './routes/health.routes';
import { opensearchService } from './services/opensearch.service';
import { config } from './config';
import logger from './utils/logger';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  next();
});

// Health check (no auth required)
app.use('/health', healthRoutes);

// Swagger API documentation (no auth required)
// Path resolves to project root: dist/../swagger.yaml -> swagger.yaml
try {
  const swaggerPath = path.join(__dirname, '../swagger.yaml');
  const swaggerDocument = YAML.load(swaggerPath);
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Document Search API Documentation'
  }));
  logger.info('Swagger documentation loaded', { path: swaggerPath });
} catch (error) {
  logger.warn('Failed to load Swagger documentation', { 
    error: (error as Error).message,
    path: path.join(__dirname, '../swagger.yaml')
  });
  // Continue without Swagger - API will still work
}

// Protected routes (require tenant ID)
app.use('/documents', extractTenantId, rateLimiter, documentsRoutes);
app.use('/search', extractTenantId, rateLimiter, searchRoutes);

// Error handler (must be last)
app.use(errorHandler);

// Initialize OpenSearch index on startup
async function initialize() {
  try {
    await opensearchService.initializeIndex();
    logger.info('Application initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize application', { error: (error as Error).message });
    process.exit(1);
  }
}

// Start server
const PORT = config.server.port;

app.listen(PORT, async () => {
  logger.info(`Server starting on port ${PORT}`);
  await initialize();
  logger.info(`Server ready on http://localhost:${PORT}`);
});

export default app;

