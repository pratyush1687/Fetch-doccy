// Test setup file
// This file runs before all tests

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.PORT = '3000';
process.env.OPENSEARCH_NODE = 'http://localhost:9200';
process.env.OPENSEARCH_INDEX = 'test-documents';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';

