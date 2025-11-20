# Distributed Document Search Service

A multi-tenant distributed document search service capable of searching through millions of documents with sub-second response times. Built with Node.js, TypeScript, OpenSearch, and Redis.

## Features

- 🔍 **Full-Text Search:** BM25 ranking algorithm with multi-field search
- 🏢 **Multi-Tenancy:** Strict tenant isolation with header-based authentication
- ⚡ **High Performance:** Sub-500ms P95 latency, 1000+ QPS support
- 📈 **Scalable:** Horizontal scaling with Docker and AWS ECS
- 💾 **Caching:** Redis caching layer for improved performance
- 🚦 **Rate Limiting:** Per-tenant rate limiting
- 🔒 **Secure:** Input validation, error handling, tenant isolation

## Architecture

```
┌─────────────┐
│   Clients   │
└──────┬──────┘
       │
┌──────▼──────┐
│ API Gateway │
└──────┬──────┘
       │
┌──────▼──────────────┐
│  Search Service    │
│  Document Service  │
└──────┬──────────────┘
       │
   ┌───┴───┐
   │       │
┌──▼──┐ ┌──▼──┐
│Redis│ │OpenSearch│
└─────┘ └─────────┘
```

For detailed architecture documentation, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Prerequisites

- **Node.js:** v18 or higher
- **Docker:** v20 or higher
- **Docker Compose:** v2.0 or higher
- **npm:** v9 or higher

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd deeprunner-task
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Infrastructure Services

Start OpenSearch and Redis using Docker Compose:

```bash
docker-compose up -d
```

This will start:
- OpenSearch on `http://localhost:9200`
- OpenSearch Dashboards on `http://localhost:5601`
- Redis on `localhost:6379`

Wait for services to be healthy (check with `docker-compose ps`).

### 4. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` if needed (defaults should work for local development).

### 5. Build and Start the Application

```bash
# Build TypeScript
npm run build

# Start the application
npm start
```

Or run in development mode with auto-reload:

```bash
npm run dev
```

The API will be available at `http://localhost:3000`.

### 6. Initialize OpenSearch Index

The application will automatically create the OpenSearch index on startup. You can verify it was created:

```bash
curl http://localhost:9200/documents
```

### 7. Seed Sample Data (Optional)

```bash
# Install ts-node if not already installed
npm install -g ts-node

# Run seed script
ts-node scripts/seed-data.ts
```

## API Usage

### Health Check

```bash
curl http://localhost:3000/health
```

### Create a Document

```bash
curl -X POST http://localhost:3000/documents \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: tenant-123" \
  -d '{
    "title": "Payment Gateway Timeout Error",
    "content": "We received multiple timeout errors from the payment gateway during peak hours.",
    "tags": ["payments", "errors", "timeout"],
    "metadata": {
      "author": "alice@example.com",
      "type": "incident_report",
      "department": "payments"
    }
  }'
```

### Search Documents

```bash
curl "http://localhost:3000/search?q=payment&limit=10" \
  -H "X-Tenant-Id: tenant-123"
```

### Get Document by ID

```bash
curl http://localhost:3000/documents/doc-1 \
  -H "X-Tenant-Id: tenant-123"
```

### Delete Document

```bash
curl -X DELETE http://localhost:3000/documents/doc-1 \
  -H "X-Tenant-Id: tenant-123"
```

## Testing

### Run Test Scripts

**Bash (Linux/Mac):**
```bash
chmod +x scripts/test-api.sh
./scripts/test-api.sh
```

**PowerShell (Windows):**
```powershell
.\scripts\test-api.ps1
```

### Multi-Tenant Testing

The test scripts demonstrate multi-tenant isolation:
1. Create documents for `tenant-123`
2. Create documents for `tenant-456`
3. Search as `tenant-123` - only sees own documents
4. Search as `tenant-456` - only sees own documents

## Project Structure

```
deeprunner-task/
├── src/
│   ├── config/          # Configuration management
│   ├── middleware/       # Express middleware (auth, rate limiting, error handling)
│   ├── services/        # Business logic (OpenSearch, Redis, cache)
│   ├── routes/          # API route handlers
│   ├── types/           # TypeScript type definitions
│   ├── utils/           # Utility functions
│   └── app.ts           # Express application entry point
├── docs/
│   ├── ARCHITECTURE.md           # System architecture documentation
│   ├── API.md                    # API documentation
│   ├── AWS-ARCHITECTURE.md       # AWS cloud architecture
│   ├── DEPLOYMENT.md             # AWS deployment guide
│   └── PRODUCTION-READINESS.md   # Production readiness analysis
├── scripts/
│   ├── seed-data.ts      # Seed sample data
│   ├── test-api.sh       # Bash test script
│   └── test-api.ps1      # PowerShell test script
├── docker-compose.yml    # Local infrastructure setup
├── tsconfig.json        # TypeScript configuration
├── package.json         # Node.js dependencies
└── README.md            # This file
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development` |
| `OPENSEARCH_NODE` | OpenSearch endpoint | `http://localhost:9200` |
| `OPENSEARCH_INDEX` | Index name | `documents` |
| `OPENSEARCH_USERNAME` | OpenSearch username | `admin` |
| `OPENSEARCH_PASSWORD` | OpenSearch password | `admin` |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `60000` |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` |
| `CACHE_TTL_SECONDS` | Cache TTL | `60` |
| `SEARCH_CACHE_TTL_SECONDS` | Search cache TTL | `120` |
| `LOG_LEVEL` | Logging level | `info` |

## API Documentation

For complete API documentation, see [docs/API.md](docs/API.md).

### Endpoints

- `GET /health` - Health check
- `POST /documents` - Create/index a document
- `GET /search` - Search documents
- `GET /documents/:id` - Get document by ID
- `DELETE /documents/:id` - Delete document

All endpoints (except `/health`) require the `X-Tenant-Id` header.

## Development

### Running in Development Mode

```bash
npm run dev
```

This uses `ts-node-dev` for hot-reloading.

### Building for Production

```bash
npm run build
```

Compiled JavaScript will be in the `dist/` directory.

### Code Quality

The project uses:
- **TypeScript** for type safety
- **ESLint** (recommended) for code linting
- **Prettier** (recommended) for code formatting

## Docker Compose Services

### OpenSearch
- **Port:** 9200
- **Dashboards:** 5601
- **Health Check:** `http://localhost:9200/_cluster/health`

### Redis
- **Port:** 6379
- **Health Check:** `redis-cli ping`

### Managing Services

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Check status
docker-compose ps
```

## AWS Deployment

### Quick Deployment (Prototype)

For a quick prototype deployment to AWS ECS Fargate:

```bash
cd deploy
chmod +x deploy.sh  # Linux/Mac
./deploy.sh
```

Or on Windows PowerShell:
```powershell
cd deploy
.\deploy.ps1
```

See [deploy/DEPLOYMENT-QUICKSTART.md](deploy/DEPLOYMENT-QUICKSTART.md) for detailed instructions.

### Production Deployment

For deploying to AWS production, see:
- [AWS Architecture](docs/AWS-ARCHITECTURE.md) - Cloud architecture design
- [Deployment Guide](docs/DEPLOYMENT.md) - Step-by-step deployment instructions
- [Production Readiness](docs/PRODUCTION-READINESS.md) - Production considerations

## Performance

### Benchmarks (Local Development)

- **Search Latency:** P95 < 100ms (local)
- **Indexing Latency:** < 50ms per document
- **Cache Hit Ratio:** > 80% (with repeated queries)

### Production Targets

- **Search Latency:** P95 < 500ms
- **Throughput:** 1000+ QPS
- **Availability:** 99.95%

## Security

### Multi-Tenancy

- Tenant ID extracted from `X-Tenant-Id` header (prototype)
- All queries filtered by tenant ID
- Cache keys prefixed with tenant ID
- No cross-tenant data leakage

### Production Security

For production, implement:
- JWT token authentication (Cognito/OIDC)
- Tenant ID from JWT claims (not headers)
- WAF rules for API protection
- Encryption at rest and in transit
- Security groups and IAM roles

See [Production Readiness](docs/PRODUCTION-READINESS.md) for details.

## Monitoring

### Health Checks

The `/health` endpoint reports:
- Service status (UP/DOWN/DEGRADED)
- OpenSearch connectivity
- Redis connectivity

### Logging

Structured JSON logs with:
- Timestamp
- Log level
- Message
- Tenant ID (when available)
- Request context

### Metrics

**Built with prom-client** - Industry-standard Prometheus metrics library

**Endpoints:**
- `GET /metrics` - Prometheus format (for scraping by Prometheus/Grafana)
- `GET /metrics/json` - JSON format (human-readable)
- `GET /metrics/summary` - Quick summary

**Metrics Collected:**
- **HTTP Metrics**: Request duration (histogram), total requests, errors by status code
- **Cache Metrics**: Hits/misses by cache type (search/document)
- **Rate Limit Metrics**: Violations by tenant
- **System Metrics**: CPU, memory, event loop lag (via prom-client defaults)
- **Uptime**: Process uptime in seconds

**Example Usage:**
```bash
# Prometheus format (for scraping)
curl http://localhost:3000/metrics

# JSON format (easier to read)
curl http://localhost:3000/metrics/json
```

**Integration with Prometheus:**
The `/metrics` endpoint returns standard Prometheus format. You can:
1. Run Prometheus locally and configure it to scrape `http://localhost:3000/metrics`
2. Visualize metrics in Grafana
3. Set up alerts based on metrics

See [Metrics Documentation](docs/METRICS.md) for detailed setup instructions.

## Troubleshooting

### OpenSearch Connection Issues

1. Verify OpenSearch is running: `curl http://localhost:9200`
2. Check security settings (if enabled)
3. Verify network connectivity

### Redis Connection Issues

1. Verify Redis is running: `redis-cli ping`
2. Check Redis port (default: 6379)
3. Verify firewall rules

### Rate Limiting Issues

- Check `X-RateLimit-*` headers in response
- Verify Redis is accessible (rate limiting uses Redis)
- Adjust `RATE_LIMIT_MAX_REQUESTS` if needed

### Cache Issues

- Verify Redis is running and accessible
- Check cache TTL settings
- Monitor cache hit ratio

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

ISC

## Author

Principal Enterprise Software Engineer - Technical Assessment

## Acknowledgments

- OpenSearch for search capabilities
- Redis for caching
- Express.js for the web framework
- TypeScript for type safety

## Additional Resources

- [Architecture Documentation](docs/ARCHITECTURE.md)
- [API Documentation](docs/API.md)
- [AWS Architecture](docs/AWS-ARCHITECTURE.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Production Readiness](docs/PRODUCTION-READINESS.md)

