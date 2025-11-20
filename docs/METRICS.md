# Performance Metrics

This document describes the performance metrics system built with **prom-client**, the industry-standard Prometheus client for Node.js.

## Overview

The metrics system uses [prom-client](https://github.com/siimon/prom-client), which provides:
- ✅ Industry-standard Prometheus format
- ✅ Production-ready and battle-tested
- ✅ Automatic system metrics (CPU, memory, event loop)
- ✅ Easy integration with Prometheus and Grafana
- ✅ Efficient metric collection with minimal overhead

## Metrics Collected

### HTTP Request Metrics

- **`http_request_duration_ms`** (Histogram): Request latency in milliseconds
  - Labels: `method`, `route`, `status_code`
  - Buckets: 10, 50, 100, 200, 300, 500, 1000, 2000, 5000ms
  - Used to calculate P50, P95, P99 percentiles

- **`http_requests_total`** (Counter): Total number of HTTP requests
  - Labels: `method`, `route`, `status_code`

- **`http_request_errors_total`** (Counter): Total number of HTTP errors (4xx, 5xx)
  - Labels: `method`, `route`, `status_code`

### Cache Metrics

- **`cache_hits_total`** (Counter): Total cache hits
  - Labels: `cache_type` (search, document)

- **`cache_misses_total`** (Counter): Total cache misses
  - Labels: `cache_type` (search, document)

### Rate Limit Metrics

- **`rate_limit_violations_total`** (Counter): Total rate limit violations
  - Labels: `tenant_id`

### System Metrics (Automatic)

prom-client automatically collects:
- **`process_cpu_user_seconds_total`**: CPU time spent in user mode
- **`process_cpu_system_seconds_total`**: CPU time spent in system mode
- **`process_cpu_seconds_total`**: Total CPU time
- **`process_start_time_seconds`**: Process start time
- **`process_resident_memory_bytes`**: Resident memory size
- **`nodejs_heap_size_total_bytes`**: Total heap size
- **`nodejs_heap_size_used_bytes`**: Used heap size
- **`nodejs_external_memory_bytes`**: External memory size
- **`nodejs_eventloop_lag_seconds`**: Event loop lag
- **`process_uptime_seconds`**: Process uptime

## Endpoints

### GET /metrics

Returns metrics in **Prometheus exposition format**. This is the standard format that Prometheus scrapes.

**Content-Type:** `text/plain; version=0.0.4; charset=utf-8`

**Example Response:**
```
# HELP http_request_duration_ms Duration of HTTP requests in milliseconds
# TYPE http_request_duration_ms histogram
http_request_duration_ms_bucket{method="GET",route="/search",status_code="200",le="10"} 0
http_request_duration_ms_bucket{method="GET",route="/search",status_code="200",le="50"} 5
http_request_duration_ms_bucket{method="GET",route="/search",status_code="200",le="100"} 12
http_request_duration_ms_bucket{method="GET",route="/search",status_code="200",le="200"} 18
http_request_duration_ms_sum{method="GET",route="/search",status_code="200"} 1250.5
http_request_duration_ms_count{method="GET",route="/search",status_code="200"} 20

# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",route="/search",status_code="200"} 20

# HELP cache_hits_total Total number of cache hits
# TYPE cache_hits_total counter
cache_hits_total{cache_type="search"} 15
cache_hits_total{cache_type="document"} 8
```

### GET /metrics/json

Returns metrics in JSON format for easier human consumption.

**Example Response:**
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "endpoints": {
    "GET /search": {
      "requests": 1250,
      "errors": 5,
      "errorRate": 0.4,
      "latency": {
        "p50": 75,
        "p95": 200,
        "p99": 350,
        "avg": 85.5
      }
    }
  },
  "cache": {
    "hits": 800,
    "misses": 200,
    "hitRatio": 80.0
  },
  "rateLimit": {
    "violations": 3
  }
}
```

### GET /metrics/summary

Alias for `/metrics/json` (backward compatibility).

## Usage Examples

### View Prometheus Metrics

```bash
curl http://localhost:3000/metrics
```

### View JSON Metrics

```bash
curl http://localhost:3000/metrics/json
```

### Monitor Metrics Continuously

**Linux/Mac:**
```bash
watch -n 5 'curl -s http://localhost:3000/metrics/json | jq'
```

**PowerShell (Windows):**
```powershell
while ($true) {
    Invoke-RestMethod http://localhost:3000/metrics/json | ConvertTo-Json -Depth 10
    Start-Sleep -Seconds 5
}
```

## Integration with Prometheus

### 1. Install Prometheus

Download from [prometheus.io](https://prometheus.io/download/)

### 2. Configure Prometheus

Create `prometheus.yml`:

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'fetch-doccy'
    static_configs:
      - targets: ['localhost:3000']
```

### 3. Start Prometheus

```bash
./prometheus --config.file=prometheus.yml
```

Prometheus will scrape metrics from `http://localhost:3000/metrics` every 15 seconds.

### 4. View Metrics in Prometheus UI

Open `http://localhost:9090` and query metrics:

- `rate(http_requests_total[5m])` - Requests per second
- `histogram_quantile(0.95, http_request_duration_ms_bucket)` - P95 latency
- `rate(cache_hits_total[5m]) / rate(cache_hits_total[5m] + cache_misses_total[5m])` - Cache hit ratio

## Integration with Grafana

### 1. Install Grafana

Download from [grafana.com](https://grafana.com/grafana/download)

### 2. Add Prometheus Data Source

1. Go to Configuration → Data Sources
2. Add Prometheus data source
3. Set URL to `http://localhost:9090` (Prometheus server)

### 3. Create Dashboard

Create panels for:
- **Request Rate**: `rate(http_requests_total[5m])`
- **Error Rate**: `rate(http_request_errors_total[5m])`
- **P95 Latency**: `histogram_quantile(0.95, http_request_duration_ms_bucket)`
- **Cache Hit Ratio**: `rate(cache_hits_total[5m]) / rate(cache_hits_total[5m] + cache_misses_total[5m])`
- **Memory Usage**: `process_resident_memory_bytes`
- **CPU Usage**: `rate(process_cpu_seconds_total[5m])`

## Advantages of prom-client

1. **Industry Standard**: Used by thousands of production applications
2. **Prometheus Compatible**: Works seamlessly with Prometheus ecosystem
3. **Automatic System Metrics**: Collects CPU, memory, event loop metrics automatically
4. **Efficient**: Low overhead, optimized for production use
5. **Well Maintained**: Active development and community support
6. **Type Safe**: Full TypeScript support
7. **Flexible**: Easy to add custom metrics

## Performance Considerations

- Metrics collection adds minimal overhead (~1-2ms per request)
- Histogram buckets are pre-defined for efficient storage
- Counters are atomic and thread-safe
- Metrics are stored in memory (reset on server restart)
- For production, use Prometheus for long-term storage

## Troubleshooting

### Metrics Not Appearing

- Ensure the metrics middleware is enabled in `app.ts`
- Check that requests are reaching the application
- Verify the endpoint path matches exactly

### Prometheus Not Scraping

- Verify Prometheus can reach `http://localhost:3000/metrics`
- Check Prometheus logs for scrape errors
- Ensure firewall allows connections

### High Memory Usage

- prom-client manages memory efficiently
- Histogram buckets limit memory usage
- System metrics are collected at intervals (not per-request)

## Additional Resources

- [prom-client Documentation](https://github.com/siimon/prom-client)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)

