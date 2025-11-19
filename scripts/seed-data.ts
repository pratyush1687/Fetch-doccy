import { Client } from '@opensearch-project/opensearch';
import * as dotenv from 'dotenv';

dotenv.config();

const OPENSEARCH_NODE = process.env.OPENSEARCH_NODE || 'http://localhost:9200';
const OPENSEARCH_INDEX = process.env.OPENSEARCH_INDEX || 'documents';

const client = new Client({
  node: OPENSEARCH_NODE,
});

const tenant1 = 'tenant-123';
const tenant2 = 'tenant-456';

const sampleDocuments = [
  {
    tenant_id: tenant1,
    doc_id: 'doc-1',
    title: 'Payment Gateway Timeout Error',
    content: 'We received multiple timeout errors from the payment gateway during peak hours. The issue occurred when processing credit card transactions. Investigation revealed that the gateway was experiencing high latency due to network issues.',
    tags: ['payments', 'errors', 'timeout'],
    metadata: {
      author: 'alice@example.com',
      type: 'incident_report',
      department: 'payments',
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    tenant_id: tenant1,
    doc_id: 'doc-2',
    title: 'User Authentication Best Practices',
    content: 'This document outlines best practices for implementing secure user authentication. Key points include using JWT tokens, implementing rate limiting, and ensuring proper session management. Always use HTTPS for authentication endpoints.',
    tags: ['security', 'authentication', 'best-practices'],
    metadata: {
      author: 'bob@example.com',
      type: 'technical_doc',
      department: 'engineering',
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    tenant_id: tenant1,
    doc_id: 'doc-3',
    title: 'Database Performance Optimization',
    content: 'We optimized the database queries to reduce response times by 40%. Key changes included adding proper indexes, rewriting slow queries, and implementing connection pooling. The improvements were most noticeable during peak traffic hours.',
    tags: ['database', 'performance', 'optimization'],
    metadata: {
      author: 'charlie@example.com',
      type: 'technical_doc',
      department: 'engineering',
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    tenant_id: tenant2,
    doc_id: 'doc-4',
    title: 'Customer Support Workflow',
    content: 'This document describes the customer support workflow for handling tickets. The process includes ticket creation, assignment to support agents, resolution tracking, and customer feedback collection.',
    tags: ['support', 'workflow', 'process'],
    metadata: {
      author: 'diana@example.com',
      type: 'process_doc',
      department: 'support',
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    tenant_id: tenant2,
    doc_id: 'doc-5',
    title: 'API Rate Limiting Implementation',
    content: 'We implemented rate limiting for our public API to prevent abuse and ensure fair usage. The implementation uses a token bucket algorithm with Redis for distributed rate limiting across multiple server instances.',
    tags: ['api', 'rate-limiting', 'redis'],
    metadata: {
      author: 'eve@example.com',
      type: 'technical_doc',
      department: 'engineering',
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

async function seedData() {
  try {
    console.log('Starting data seeding...');
    console.log(`OpenSearch node: ${OPENSEARCH_NODE}`);
    console.log(`Index: ${OPENSEARCH_INDEX}`);

    // Check if index exists
    const indexExists = await client.indices.exists({ index: OPENSEARCH_INDEX });
    
    if (!indexExists.body) {
      console.log(`Index ${OPENSEARCH_INDEX} does not exist. Please create it first by starting the application.`);
      process.exit(1);
    }

    // Index documents
    for (const doc of sampleDocuments) {
      const id = `${doc.tenant_id}_${doc.doc_id}`;
      await client.index({
        index: OPENSEARCH_INDEX,
        id,
        body: doc,
        refresh: true,
      });
      console.log(`Indexed document: ${id}`);
    }

    console.log(`\nSuccessfully indexed ${sampleDocuments.length} documents`);
    console.log(`\nTenant ${tenant1}: 3 documents`);
    console.log(`Tenant ${tenant2}: 2 documents`);
    console.log('\nYou can now test the API with the provided curl commands.');
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
}

seedData();

