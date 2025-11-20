import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import logger from '../utils/logger';

/**
 * Prometheus metrics registry and collectors
 * Uses prom-client for industry-standard metrics collection
 */
class MetricsService {
  private register: Registry;
  
  // HTTP Metrics
  private httpRequestDuration: Histogram<string>;
  private httpRequestTotal: Counter<string>;
  private httpRequestErrors: Counter<string>;
  
  // Cache Metrics
  private cacheHits: Counter<string>;
  private cacheMisses: Counter<string>;
  
  // Rate Limit Metrics
  private rateLimitViolations: Counter<string>;
  
  // System Metrics
  private uptimeGauge: Gauge<string>;

  constructor() {
    // Create a registry
    this.register = new Registry();

    // HTTP Request Duration Histogram (for latency percentiles)
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_ms',
      help: 'Duration of HTTP requests in milliseconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [10, 50, 100, 200, 300, 500, 1000, 2000, 5000], // buckets in ms
      registers: [this.register],
    });

    // HTTP Request Total Counter
    this.httpRequestTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.register],
    });

    // HTTP Request Errors Counter
    this.httpRequestErrors = new Counter({
      name: 'http_request_errors_total',
      help: 'Total number of HTTP request errors',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.register],
    });

    // Cache Metrics
    this.cacheHits = new Counter({
      name: 'cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['cache_type'],
      registers: [this.register],
    });

    this.cacheMisses = new Counter({
      name: 'cache_misses_total',
      help: 'Total number of cache misses',
      labelNames: ['cache_type'],
      registers: [this.register],
    });

    // Rate Limit Violations
    this.rateLimitViolations = new Counter({
      name: 'rate_limit_violations_total',
      help: 'Total number of rate limit violations',
      labelNames: ['tenant_id'],
      registers: [this.register],
    });

    // Uptime Gauge
    this.uptimeGauge = new Gauge({
      name: 'process_uptime_seconds',
      help: 'Process uptime in seconds',
      registers: [this.register],
    });

    // Collect default metrics (CPU, memory, event loop, etc.)
    collectDefaultMetrics({ register: this.register });

    logger.info('Metrics service initialized with prom-client');
  }

  /**
   * Record HTTP request metrics
   */
  recordRequest(method: string, route: string, duration: number, statusCode: number): void {
    const labels = {
      method,
      route: this.normalizeRoute(route),
      status_code: statusCode.toString(),
    };

    // Record duration
    this.httpRequestDuration.observe(labels, duration);

    // Increment total requests
    this.httpRequestTotal.inc(labels);

    // Record errors (4xx and 5xx)
    if (statusCode >= 400) {
      this.httpRequestErrors.inc(labels);
    }
  }

  /**
   * Record cache hit
   */
  recordCacheHit(cacheType: string = 'default'): void {
    this.cacheHits.inc({ cache_type: cacheType });
  }

  /**
   * Record cache miss
   */
  recordCacheMiss(cacheType: string = 'default'): void {
    this.cacheMisses.inc({ cache_type: cacheType });
  }

  /**
   * Record rate limit violation
   */
  recordRateLimitViolation(tenantId: string): void {
    this.rateLimitViolations.inc({ tenant_id: tenantId });
  }

  /**
   * Update uptime gauge
   */
  updateUptime(): void {
    this.uptimeGauge.set(process.uptime());
  }

  /**
   * Normalize route path for consistent labeling
   * Removes IDs and dynamic segments
   */
  private normalizeRoute(route: string): string {
    // Replace common ID patterns with placeholders
    return route
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id') // UUIDs
      .replace(/\/\d+/g, '/:id') // Numeric IDs
      .replace(/\/[^/]+$/g, '/:id'); // Last segment if it looks like an ID
  }

  /**
   * Get metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    this.updateUptime();
    return await this.register.metrics();
  }

  /**
   * Get metrics registry (for custom metrics)
   */
  getRegister(): Registry {
    return this.register;
  }

  /**
   * Get summary metrics in JSON format (for easy consumption)
   */
  async getSummary(): Promise<{
    timestamp: string;
    uptime: number;
    endpoints: Record<string, {
      requests: number;
      errors: number;
      errorRate: number;
      latency: {
        p50: number;
        p95: number;
        p99: number;
        avg: number;
      };
    }>;
    cache: {
      hits: number;
      misses: number;
      hitRatio: number;
    };
    rateLimit: {
      violations: number;
    };
  }> {
    this.updateUptime();
    const metrics = await this.register.getMetricsAsJSON();

    // Parse metrics to create summary
    const summary: any = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      endpoints: {},
      cache: {
        hits: 0,
        misses: 0,
        hitRatio: 0,
      },
      rateLimit: {
        violations: 0,
      },
    };

    // Extract endpoint metrics
    const requestDuration = metrics.find((m: any) => m.name === 'http_request_duration_ms');
    const requestTotal = metrics.find((m: any) => m.name === 'http_requests_total');
    const requestErrors = metrics.find((m: any) => m.name === 'http_request_errors_total');

    if (requestTotal && requestTotal.values) {
      const endpointMap: Record<string, any> = {};
      
      requestTotal.values.forEach((value: any) => {
        const key = `${value.labels.method} ${value.labels.route}`;
        if (!endpointMap[key]) {
          endpointMap[key] = {
            requests: 0,
            errors: 0,
            latency: { p50: 0, p95: 0, p99: 0, avg: 0 },
          };
        }
        endpointMap[key].requests += value.value;
      });

      if (requestErrors && requestErrors.values) {
        requestErrors.values.forEach((value: any) => {
          const key = `${value.labels.method} ${value.labels.route}`;
          if (endpointMap[key]) {
            endpointMap[key].errors += value.value;
          }
        });
      }

      // Calculate latency percentiles from histogram
      if (requestDuration && requestDuration.values) {
        requestDuration.values.forEach((value: any) => {
          const key = `${value.labels.method} ${value.labels.route}`;
          if (endpointMap[key]) {
            // Prometheus histograms have buckets, we'll use the le (less than or equal) buckets
            if (value.labels.le) {
              const le = parseFloat(value.labels.le);
              // Approximate percentiles from buckets
              if (le <= 50) endpointMap[key].latency.p50 = Math.max(endpointMap[key].latency.p50, le);
              if (le <= 200) endpointMap[key].latency.p95 = Math.max(endpointMap[key].latency.p95, le);
              if (le <= 500) endpointMap[key].latency.p99 = Math.max(endpointMap[key].latency.p99, le);
            }
          }
        });
      }

      // Calculate error rates
      Object.keys(endpointMap).forEach((key) => {
        endpointMap[key].errorRate = endpointMap[key].requests > 0
          ? (endpointMap[key].errors / endpointMap[key].requests) * 100
          : 0;
      });

      summary.endpoints = endpointMap;
    }

    // Extract cache metrics
    const cacheHitsMetric = metrics.find((m: any) => m.name === 'cache_hits_total');
    const cacheMissesMetric = metrics.find((m: any) => m.name === 'cache_misses_total');

    if (cacheHitsMetric && cacheHitsMetric.values) {
      summary.cache.hits = cacheHitsMetric.values.reduce((sum: number, v: any) => sum + v.value, 0);
    }
    if (cacheMissesMetric && cacheMissesMetric.values) {
      summary.cache.misses = cacheMissesMetric.values.reduce((sum: number, v: any) => sum + v.value, 0);
    }
    
    const cacheTotal = summary.cache.hits + summary.cache.misses;
    summary.cache.hitRatio = cacheTotal > 0 ? (summary.cache.hits / cacheTotal) * 100 : 0;

    // Extract rate limit metrics
    const rateLimitMetric = metrics.find((m: any) => m.name === 'rate_limit_violations_total');
    if (rateLimitMetric && rateLimitMetric.values) {
      summary.rateLimit.violations = rateLimitMetric.values.reduce((sum: number, v: any) => sum + v.value, 0);
    }

    return summary;
  }
}

export const metricsService = new MetricsService();

