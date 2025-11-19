#!/bin/bash

# Test API Script for Distributed Document Search Service
# Make sure the service is running on http://localhost:3000

BASE_URL="http://localhost:3000"
TENANT1="tenant-123"
TENANT2="tenant-456"

echo "=========================================="
echo "Testing Document Search Service API"
echo "=========================================="
echo ""

# Health Check
echo "1. Health Check"
echo "GET $BASE_URL/health"
curl -s -X GET "$BASE_URL/health" | jq '.'
echo ""
echo ""

# Create documents for tenant 1
echo "2. Creating documents for Tenant 1 ($TENANT1)"
echo "POST $BASE_URL/documents"
curl -s -X POST "$BASE_URL/documents" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: $TENANT1" \
  -d '{
    "title": "Payment Gateway Timeout Error",
    "content": "We received multiple timeout errors from the payment gateway during peak hours.",
    "tags": ["payments", "errors", "timeout"],
    "metadata": {
      "author": "alice@example.com",
      "type": "incident_report",
      "department": "payments"
    }
  }' | jq '.'
echo ""

curl -s -X POST "$BASE_URL/documents" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: $TENANT1" \
  -d '{
    "title": "User Authentication Best Practices",
    "content": "This document outlines best practices for implementing secure user authentication.",
    "tags": ["security", "authentication"],
    "metadata": {
      "author": "bob@example.com",
      "type": "technical_doc"
    }
  }' | jq '.'
echo ""
echo ""

# Create document for tenant 2
echo "3. Creating document for Tenant 2 ($TENANT2)"
curl -s -X POST "$BASE_URL/documents" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: $TENANT2" \
  -d '{
    "title": "Customer Support Workflow",
    "content": "This document describes the customer support workflow for handling tickets.",
    "tags": ["support", "workflow"],
    "metadata": {
      "author": "diana@example.com",
      "type": "process_doc"
    }
  }' | jq '.'
echo ""
echo ""

# Search as tenant 1
echo "4. Search as Tenant 1 - Query: 'payment'"
echo "GET $BASE_URL/search?q=payment"
curl -s -X GET "$BASE_URL/search?q=payment" \
  -H "X-Tenant-Id: $TENANT1" | jq '.'
echo ""
echo ""

# Search as tenant 2 (should not see tenant 1's docs)
echo "5. Search as Tenant 2 - Query: 'payment' (should return empty)"
echo "GET $BASE_URL/search?q=payment"
curl -s -X GET "$BASE_URL/search?q=payment" \
  -H "X-Tenant-Id: $TENANT2" | jq '.'
echo ""
echo ""

# Search with filters
echo "6. Search with tag filter - Query: 'authentication', Tag: 'security'"
echo "GET $BASE_URL/search?q=authentication&tag=security"
curl -s -X GET "$BASE_URL/search?q=authentication&tag=security" \
  -H "X-Tenant-Id: $TENANT1" | jq '.'
echo ""
echo ""

# Get specific document
echo "7. Get document by ID"
echo "GET $BASE_URL/documents/doc-1"
curl -s -X GET "$BASE_URL/documents/doc-1" \
  -H "X-Tenant-Id: $TENANT1" | jq '.'
echo ""
echo ""

# Try to access tenant 2's document as tenant 1 (should fail)
echo "8. Try to access Tenant 2 document as Tenant 1 (should return 404)"
echo "GET $BASE_URL/documents/doc-4"
curl -s -X GET "$BASE_URL/documents/doc-4" \
  -H "X-Tenant-Id: $TENANT1" | jq '.'
echo ""
echo ""

# Delete document
echo "9. Delete document"
echo "DELETE $BASE_URL/documents/doc-1"
curl -s -X DELETE "$BASE_URL/documents/doc-1" \
  -H "X-Tenant-Id: $TENANT1" | jq '.'
echo ""
echo ""

# Verify deletion
echo "10. Verify document deleted (should return 404)"
echo "GET $BASE_URL/documents/doc-1"
curl -s -X GET "$BASE_URL/documents/doc-1" \
  -H "X-Tenant-Id: $TENANT1" | jq '.'
echo ""
echo ""

echo "=========================================="
echo "Testing Complete"
echo "=========================================="

