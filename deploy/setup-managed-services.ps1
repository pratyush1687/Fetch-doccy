# Script to set up AWS Managed Services (OpenSearch and Redis) - PowerShell
# Run this after deploying the main infrastructure

$ErrorActionPreference = "Stop"

$STACK_NAME = "document-search-infra"
$AWS_REGION = if ($env:AWS_REGION) { $env:AWS_REGION } else { "us-east-1" }

Write-Host "Setting up AWS Managed Services" -ForegroundColor Green
Write-Host ""

# Get infrastructure details
Write-Host "Getting infrastructure details..." -ForegroundColor Yellow
$VPC_ID = aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION --query 'Stacks[0].Outputs[?OutputKey==`VPCId`].OutputValue' --output text
$PRIVATE_SUBNET = aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION --query 'Stacks[0].Outputs[?OutputKey==`PrivateSubnetId`].OutputValue' --output text
$ECS_SG = aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION --query 'Stacks[0].Outputs[?OutputKey==`ECSSecurityGroupId`].OutputValue' --output text
$AWS_ACCOUNT = aws sts get-caller-identity --query Account --output text

Write-Host "VPC ID: $VPC_ID"
Write-Host "Private Subnet: $PRIVATE_SUBNET"
Write-Host "ECS Security Group: $ECS_SG"
Write-Host ""

# Step 1: Set up OpenSearch
Write-Host "Step 1: Setting up AWS OpenSearch Service..." -ForegroundColor Yellow

$osDomainExists = aws opensearch describe-domain --domain-name document-search-opensearch --region $AWS_REGION 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "OpenSearch domain already exists, skipping creation..." -ForegroundColor Yellow
    $OS_ENDPOINT = aws opensearch describe-domain --domain-name document-search-opensearch --region $AWS_REGION --query 'DomainStatus.Endpoint' --output text
} else {
    # Create OpenSearch security group
    Write-Host "Creating OpenSearch security group..."
    $osSgResult = aws ec2 create-security-group --group-name document-search-opensearch-sg --description "Security group for OpenSearch" --vpc-id $VPC_ID --region $AWS_REGION 2>&1
    if ($LASTEXITCODE -eq 0) {
        $OS_SG = ($osSgResult | ConvertFrom-Json).GroupId
    } else {
        $OS_SG = aws ec2 describe-security-groups --filters "Name=group-name,Values=document-search-opensearch-sg" "Name=vpc-id,Values=$VPC_ID" --region $AWS_REGION --query 'SecurityGroups[0].GroupId' --output text
    }

    # Allow ECS to access OpenSearch
    Write-Host "Configuring security group rules..."
    aws ec2 authorize-security-group-ingress --group-id $OS_SG --protocol tcp --port 443 --source-group $ECS_SG --region $AWS_REGION 2>&1 | Out-Null

    # Create OpenSearch domain
    Write-Host "Creating OpenSearch domain (this takes 15-30 minutes)..."
    $accessPolicy = @{
        Version = "2012-10-17"
        Statement = @(
            @{
                Effect = "Allow"
                Principal = @{
                    AWS = "arn:aws:iam::${AWS_ACCOUNT}:root"
                }
                Action = "es:*"
                Resource = "arn:aws:es:${AWS_REGION}:${AWS_ACCOUNT}:domain/document-search-opensearch/*"
            }
        )
    } | ConvertTo-Json -Compress

    aws opensearch create-domain `
        --domain-name document-search-opensearch `
        --cluster-config InstanceType=t3.small.search,InstanceCount=1 `
        --ebs-options EBSEnabled=true,VolumeType=gp3,VolumeSize=20 `
        --vpc-options "SubnetIds=$PRIVATE_SUBNET,SecurityGroupIds=$OS_SG" `
        --access-policies $accessPolicy `
        --engine-version "OpenSearch_2.11" `
        --node-to-node-encryption-options Enabled=true `
        --encryption-at-rest-options Enabled=true `
        --region $AWS_REGION | Out-Null

    Write-Host "Waiting for OpenSearch domain to be available..."
    aws opensearch wait domain-available --domain-name document-search-opensearch --region $AWS_REGION

    $OS_ENDPOINT = aws opensearch describe-domain --domain-name document-search-opensearch --region $AWS_REGION --query 'DomainStatus.Endpoint' --output text
}

Write-Host "OpenSearch endpoint: https://$OS_ENDPOINT" -ForegroundColor Green
Write-Host ""

# Step 2: Set up Redis
Write-Host "Step 2: Setting up AWS ElastiCache Redis..." -ForegroundColor Yellow

$redisExists = aws elasticache describe-replication-groups --replication-group-id document-search-redis --region $AWS_REGION 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "Redis cluster already exists, skipping creation..." -ForegroundColor Yellow
    $REDIS_ENDPOINT = aws elasticache describe-replication-groups --replication-group-id document-search-redis --region $AWS_REGION --query 'ReplicationGroups[0].NodeGroups[0].PrimaryEndpoint.Address' --output text
} else {
    # Create Redis security group
    Write-Host "Creating Redis security group..."
    $redisSgResult = aws ec2 create-security-group --group-name document-search-redis-sg --description "Security group for Redis" --vpc-id $VPC_ID --region $AWS_REGION 2>&1
    if ($LASTEXITCODE -eq 0) {
        $REDIS_SG = ($redisSgResult | ConvertFrom-Json).GroupId
    } else {
        $REDIS_SG = aws ec2 describe-security-groups --filters "Name=group-name,Values=document-search-redis-sg" "Name=vpc-id,Values=$VPC_ID" --region $AWS_REGION --query 'SecurityGroups[0].GroupId' --output text
    }

    # Allow ECS to access Redis
    Write-Host "Configuring security group rules..."
    aws ec2 authorize-security-group-ingress --group-id $REDIS_SG --protocol tcp --port 6379 --source-group $ECS_SG --region $AWS_REGION 2>&1 | Out-Null

    # Create subnet group
    Write-Host "Creating cache subnet group..."
    aws elasticache create-cache-subnet-group --cache-subnet-group-name document-search-subnet-group --description "Subnet group for Redis" --subnet-ids $PRIVATE_SUBNET --region $AWS_REGION 2>&1 | Out-Null

    # Create Redis cluster
    Write-Host "Creating Redis cluster (this takes 5-10 minutes)..."
    aws elasticache create-replication-group `
        --replication-group-id document-search-redis `
        --description "Redis for document search" `
        --num-cache-clusters 1 `
        --cache-node-type cache.t3.micro `
        --engine redis `
        --engine-version 7.0 `
        --cache-subnet-group-name document-search-subnet-group `
        --security-group-ids $REDIS_SG `
        --at-rest-encryption-enabled `
        --transit-encryption-enabled `
        --region $AWS_REGION | Out-Null

    Write-Host "Waiting for Redis cluster to be available..."
    aws elasticache wait replication-group-available --replication-group-id document-search-redis --region $AWS_REGION

    $REDIS_ENDPOINT = aws elasticache describe-replication-groups --replication-group-id document-search-redis --region $AWS_REGION --query 'ReplicationGroups[0].NodeGroups[0].PrimaryEndpoint.Address' --output text
}

Write-Host "Redis endpoint: $REDIS_ENDPOINT" -ForegroundColor Green
Write-Host ""

# Step 3: Output configuration
Write-Host "Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Add these to your environment variables:" -ForegroundColor Yellow
Write-Host ""
Write-Host "`$env:OPENSEARCH_ENDPOINT = 'https://$OS_ENDPOINT'"
Write-Host "`$env:OPENSEARCH_USERNAME = 'admin'"
Write-Host "`$env:OPENSEARCH_PASSWORD = '<set-during-domain-creation>'"
Write-Host "`$env:REDIS_ENDPOINT = '$REDIS_ENDPOINT'"
Write-Host ""
Write-Host "Then update your ECS service:" -ForegroundColor Yellow
Write-Host ""
Write-Host "cd deploy"
Write-Host ".\deploy.ps1  # This will use the environment variables"
Write-Host ""
Write-Host "Or manually update task definition and redeploy" -ForegroundColor Yellow

