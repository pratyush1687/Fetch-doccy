# Test Suite Documentation

This directory contains comprehensive tests for the Fetch-doccy application.

## Test Structure

### Unit Tests

- **Utils Tests** (`utils/__tests__/`)
  - `hash.test.ts` - Tests for hash utility functions
  - `logger.test.ts` - Tests for logger configuration and methods

- **Middleware Tests** (`middleware/__tests__/`)
  - `errorHandler.test.ts` - Tests for error handling middleware
  - `rateLimiter.test.ts` - Tests for rate limiting middleware
  - `tenant.test.ts` - Tests for tenant ID extraction middleware

- **Service Tests** (`services/__tests__/`)
  - `redis.service.test.ts` - Tests for Redis service operations
  - `cache.service.test.ts` - Tests for cache service operations
  - `opensearch.service.test.ts` - Tests for OpenSearch service operations

- **Route Tests** (`routes/__tests__/`)
  - `documents.routes.test.ts` - Tests for document CRUD endpoints
  - `search.routes.test.ts` - Tests for search endpoints
  - `health.routes.test.ts` - Tests for health check endpoints

- **Config Tests** (`config/__tests__/`)
  - `index.test.ts` - Tests for configuration loading

### Integration Tests

- `hash.integration.test.ts` - Integration tests for hash utilities
- `rateLimiter.integration.test.ts` - Integration tests for rate limiting

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Test Coverage

The test suite covers:

- ✅ All utility functions
- ✅ All middleware functions
- ✅ All service methods
- ✅ All route handlers
- ✅ Configuration loading
- ✅ Error handling
- ✅ Edge cases and error scenarios
- ✅ Integration scenarios

## Test Helpers

The `helpers.ts` file provides common test utilities:
- `mockTenantMiddleware` - Mock middleware for setting tenant context
- `createMockRequest` - Helper to create mock Express requests
- `createMockResponse` - Helper to create mock Express responses
- `createMockNext` - Helper to create mock NextFunction

## Mocking

Tests use Jest mocks for:
- External services (Redis, OpenSearch)
- Express middleware
- Configuration values
- Logger

## Writing New Tests

When adding new functionality:

1. Create test files in the appropriate `__tests__` directory
2. Follow the existing test structure and naming conventions
3. Use descriptive test names that explain what is being tested
4. Include both success and error cases
5. Mock external dependencies appropriately
6. Ensure tests are isolated and don't depend on each other

