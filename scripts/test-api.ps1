# PowerShell Test API Script for Distributed Document Search Service
# Make sure the service is running on http://localhost:3000

$BASE_URL = "http://localhost:3000"
$TENANT1 = "tenant-123"
$TENANT2 = "tenant-456"

Write-Host "=========================================="
Write-Host "Testing Document Search Service API"
Write-Host "=========================================="
Write-Host ""

# Health Check
Write-Host "1. Health Check"
Write-Host "GET $BASE_URL/health"
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/health" -Method Get
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error: $_"
}
Write-Host ""
Write-Host ""

# Create documents for tenant 1
Write-Host "2. Creating documents for Tenant 1 ($TENANT1)"
Write-Host "POST $BASE_URL/documents"

$headers = @{
    "Content-Type" = "application/json"
    "X-Tenant-Id" = $TENANT1
}

$body1 = @{
    title = "Payment Gateway Timeout Error"
    content = "We received multiple timeout errors from the payment gateway during peak hours."
    tags = @("payments", "errors", "timeout")
    metadata = @{
        author = "alice@example.com"
        type = "incident_report"
        department = "payments"
    }
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/documents" -Method Post -Headers $headers -Body $body1
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error: $_"
}
Write-Host ""

$body2 = @{
    title = "User Authentication Best Practices"
    content = "This document outlines best practices for implementing secure user authentication."
    tags = @("security", "authentication")
    metadata = @{
        author = "bob@example.com"
        type = "technical_doc"
    }
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/documents" -Method Post -Headers $headers -Body $body2
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error: $_"
}
Write-Host ""
Write-Host ""

# Create document for tenant 2
Write-Host "3. Creating document for Tenant 2 ($TENANT2)"
$headers2 = @{
    "Content-Type" = "application/json"
    "X-Tenant-Id" = $TENANT2
}

$body3 = @{
    title = "Customer Support Workflow"
    content = "This document describes the customer support workflow for handling tickets."
    tags = @("support", "workflow")
    metadata = @{
        author = "diana@example.com"
        type = "process_doc"
    }
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/documents" -Method Post -Headers $headers2 -Body $body3
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error: $_"
}
Write-Host ""
Write-Host ""

# Search as tenant 1
Write-Host "4. Search as Tenant 1 - Query: 'payment'"
Write-Host "GET $BASE_URL/search?q=payment"
$searchHeaders = @{
    "X-Tenant-Id" = $TENANT1
}
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/search?q=payment" -Method Get -Headers $searchHeaders
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error: $_"
}
Write-Host ""
Write-Host ""

# Search as tenant 2
Write-Host "5. Search as Tenant 2 - Query: 'payment' (should return empty)"
$searchHeaders2 = @{
    "X-Tenant-Id" = $TENANT2
}
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/search?q=payment" -Method Get -Headers $searchHeaders2
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error: $_"
}
Write-Host ""
Write-Host ""

Write-Host "=========================================="
Write-Host "Testing Complete"
Write-Host "=========================================="

