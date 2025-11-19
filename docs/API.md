# API Documentation

## Base URL

```
http://localhost:3000
```

## Authentication

All endpoints (except `/health`) require a tenant identifier in the request header:

```
X-Tenant-Id: tenant-123
```

The tenant ID must be alphanumeric with hyphens/underscores only.

## Endpoints

### Health Check

#### GET /health

Check the health status of the service and its dependencies.

**Request:**
```bash
curl -X GET http://localhost:3000/health
```

**Response:**
```json
{
  "status": "UP",
  "dependencies": {
    "elasticsearch": "UP",
    "redis": "UP"
  }
}
```

**Status Codes:**
- `200 OK` - Service is healthy
- `503 Service Unavailable` - Service is down

---

### Create Document

#### POST /documents

Index a new document for the authenticated tenant.

**Request Headers:**
```
Content-Type: application/json
X-Tenant-Id: tenant-123
```

**Request Body:**
```json
{
  "id": "optional-doc-id",
  "title": "Document Title",
  "content": "Full document content here...",
  "tags": ["tag1", "tag2"],
  "metadata": {
    "author": "user@example.com",
    "type": "technical_doc",
    "department": "engineering"
  }
}
```

**Example:**
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

**Response:**
```json
{
  "id": "doc-1",
  "tenantId": "tenant-123",
  "status": "indexed"
}
```

**Status Codes:**
- `201 Created` - Document successfully indexed
- `400 Bad Request` - Invalid request body or missing tenant ID
- `429 Too Many Requests` - Rate limit exceeded

---

### Search Documents

#### GET /search

Search documents for the authenticated tenant.

**Query Parameters:**
- `q` (optional) - Search query string
- `offset` (optional, default: 0) - Pagination offset
- `limit` (optional, default: 10, max: 50) - Number of results per page
- `tag` (optional) - Filter by tag
- `author` (optional) - Filter by author
- `from` (optional) - Filter by creation date (ISO 8601)
- `to` (optional) - Filter by creation date (ISO 8601)

**Request Headers:**
```
X-Tenant-Id: tenant-123
```

**Example:**
```bash
curl -X GET "http://localhost:3000/search?q=payment&limit=10&offset=0" \
  -H "X-Tenant-Id: tenant-123"
```

**Response:**
```json
{
  "tenantId": "tenant-123",
  "query": "payment",
  "offset": 0,
  "limit": 10,
  "total": 2,
  "results": [
    {
      "id": "doc-1",
      "title": "Payment Gateway Timeout Error",
      "snippet": "We received multiple timeout errors from the payment gateway...",
      "score": 7.42,
      "tags": ["payments", "errors", "timeout"]
    },
    {
      "id": "doc-2",
      "title": "Payment Processing Guide",
      "snippet": "This guide covers payment processing workflows...",
      "score": 6.87,
      "tags": ["payments", "guide"]
    }
  ]
}
```

**Status Codes:**
- `200 OK` - Search completed successfully
- `400 Bad Request` - Invalid query parameters or missing tenant ID
- `429 Too Many Requests` - Rate limit exceeded

---

### Get Document

#### GET /documents/{id}

Retrieve a specific document by ID for the authenticated tenant.

**Request Headers:**
```
X-Tenant-Id: tenant-123
```

**Example:**
```bash
curl -X GET http://localhost:3000/documents/doc-1 \
  -H "X-Tenant-Id: tenant-123"
```

**Response:**
```json
{
  "id": "doc-1",
  "tenantId": "tenant-123",
  "title": "Payment Gateway Timeout Error",
  "content": "We received multiple timeout errors from the payment gateway during peak hours.",
  "tags": ["payments", "errors", "timeout"],
  "metadata": {
    "author": "alice@example.com",
    "type": "incident_report",
    "department": "payments"
  },
  "createdAt": "2025-01-01T12:34:56.789Z",
  "updatedAt": "2025-01-01T12:34:56.789Z"
}
```

**Status Codes:**
- `200 OK` - Document found
- `404 Not Found` - Document not found or belongs to different tenant
- `400 Bad Request` - Missing tenant ID
- `429 Too Many Requests` - Rate limit exceeded

---

### Delete Document

#### DELETE /documents/{id}

Delete a document by ID for the authenticated tenant.

**Request Headers:**
```
X-Tenant-Id: tenant-123
```

**Example:**
```bash
curl -X DELETE http://localhost:3000/documents/doc-1 \
  -H "X-Tenant-Id: tenant-123"
```

**Response:**
```json
{
  "id": "doc-1",
  "tenantId": "tenant-123",
  "status": "deleted"
}
```

**Status Codes:**
- `200 OK` - Document deleted (or already deleted)
- `400 Bad Request` - Missing tenant ID
- `429 Too Many Requests` - Rate limit exceeded

---

## Rate Limiting

Rate limiting is enforced per tenant. Default limits:
- **100 requests per 60 seconds** per tenant

Rate limit information is included in response headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 2025-01-01T12:35:00.000Z
Retry-After: 45
```

When rate limit is exceeded, the service returns:
- **Status Code:** `429 Too Many Requests`
- **Response Body:** Error message with retry information

---

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message description"
}
```

Common error scenarios:
- Missing `X-Tenant-Id` header → `400 Bad Request`
- Invalid tenant ID format → `400 Bad Request`
- Document not found → `404 Not Found`
- Rate limit exceeded → `429 Too Many Requests`
- Internal server error → `500 Internal Server Error`

---

## Multi-Tenancy

The service enforces strict tenant isolation:

1. **Tenant ID Extraction:** Tenant ID is extracted from the `X-Tenant-Id` header (prototype) or JWT claims (production)
2. **Query Filtering:** All search queries automatically include a tenant filter
3. **Document Access:** Documents can only be accessed by their owning tenant
4. **Cache Isolation:** Cache keys are prefixed with tenant ID to prevent cross-tenant data leakage

**Example:** If Tenant A searches for "payment", they will only see documents belonging to Tenant A, even if Tenant B has documents matching "payment".

---

## Search Features

### Full-Text Search
- Uses BM25 ranking algorithm
- Searches across `title` (3x boost), `content`, and `tags` (2x boost)
- Supports phrase matching and relevance scoring

### Filtering
- Filter by tags (exact match)
- Filter by author (exact match)
- Filter by date range (ISO 8601 format)

### Pagination
- Use `offset` and `limit` parameters
- Maximum `limit` is 50 results per page
- Results include `total` count for pagination UI

### Highlighting
- Search results include highlighted snippets
- Snippets show matching text fragments with context

---

## Caching

Search results and document details are cached in Redis:
- **Search results:** 120 seconds TTL
- **Document details:** 60 seconds TTL
- Cache is automatically invalidated on document updates/deletes

Cache keys are tenant-scoped to ensure isolation.

