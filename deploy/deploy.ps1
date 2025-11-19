# AWS Deployment Script for Document Search Service (PowerShell)
# This script automates the deployment process to AWS ECS Fargate

$ErrorActionPreference = "Stop"

# Configuration
$PROJECT_NAME = "document-search"
$AWS_REGION = if ($env:AWS_REGION) { $env:AWS_REGION } else { "us-east-1" }
$STACK_NAME = "$PROJECT_NAME-infra"

Write-Host "Starting AWS Deployment for Document Search Service" -ForegroundColor Green
Write-Host ""

# Check prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Yellow
try {
    aws --version | Out-Null
} catch {
    Write-Host "AWS CLI is required but not installed." -ForegroundColor Red
    exit 1
}

try {
    docker --version | Out-Null
} catch {
    Write-Host "Docker is required but not installed." -ForegroundColor Red
    exit 1
}

# Check AWS credentials
Write-Host "Checking AWS credentials..." -ForegroundColor Yellow
try {
    $callerIdentity = aws sts get-caller-identity 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "AWS credentials not configured"
    }
    $AWS_ACCOUNT_ID = (aws sts get-caller-identity --query Account --output text)
    Write-Host "AWS Account ID: $AWS_ACCOUNT_ID" -ForegroundColor Green
} catch {
    Write-Host "AWS credentials not configured. Run 'aws configure'" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 1: Deploy CloudFormation Stack
Write-Host "Step 1: Deploying CloudFormation infrastructure..." -ForegroundColor Yellow

$stackExists = aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "Stack exists, updating..." -ForegroundColor Yellow
    aws cloudformation update-stack `
        --stack-name $STACK_NAME `
        --template-body file://cloudformation-infra.yaml `
        --parameters ParameterKey=ProjectName,ParameterValue=$PROJECT_NAME `
        --capabilities CAPABILITY_NAMED_IAM `
        --region $AWS_REGION
    
    Write-Host "Waiting for stack update to complete..." -ForegroundColor Yellow
    aws cloudformation wait stack-update-complete --stack-name $STACK_NAME --region $AWS_REGION
} else {
    Write-Host "Creating new stack..." -ForegroundColor Yellow
    aws cloudformation create-stack `
        --stack-name $STACK_NAME `
        --template-body file://cloudformation-infra.yaml `
        --parameters ParameterKey=ProjectName,ParameterValue=$PROJECT_NAME `
        --capabilities CAPABILITY_NAMED_IAM `
        --region $AWS_REGION
    
    Write-Host "Waiting for stack creation to complete (this may take 5-10 minutes)..." -ForegroundColor Yellow
    aws cloudformation wait stack-create-complete --stack-name $STACK_NAME --region $AWS_REGION
}

Write-Host "Infrastructure deployed successfully!" -ForegroundColor Green
Write-Host ""

# Get stack outputs
$VPC_ID = aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION --query 'Stacks[0].Outputs[?OutputKey==`VPCId`].OutputValue' --output text
$PRIVATE_SUBNET_ID = aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION --query 'Stacks[0].Outputs[?OutputKey==`PrivateSubnetId`].OutputValue' --output text
$PUBLIC_SUBNET_ID = aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION --query 'Stacks[0].Outputs[?OutputKey==`PublicSubnetId`].OutputValue' --output text
$ECS_SG_ID = aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION --query 'Stacks[0].Outputs[?OutputKey==`ECSSecurityGroupId`].OutputValue' --output text
$CLUSTER_NAME = aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION --query 'Stacks[0].Outputs[?OutputKey==`ECSClusterName`].OutputValue' --output text
$ECR_URI = aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION --query 'Stacks[0].Outputs[?OutputKey==`ECRRepositoryURI`].OutputValue' --output text
$TASK_EXECUTION_ROLE = aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION --query 'Stacks[0].Outputs[?OutputKey==`ECSTaskExecutionRoleArn`].OutputValue' --output text
$TASK_ROLE = aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION --query 'Stacks[0].Outputs[?OutputKey==`ECSTaskRoleArn`].OutputValue' --output text
$LOG_GROUP = aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION --query 'Stacks[0].Outputs[?OutputKey==`LogGroupName`].OutputValue' --output text

Write-Host "Infrastructure Details:" -ForegroundColor Green
Write-Host "  VPC ID: $VPC_ID"
Write-Host "  Cluster: $CLUSTER_NAME"
Write-Host "  ECR URI: $ECR_URI"
Write-Host ""

# Step 2: Build and push Docker image
Write-Host "Step 2: Building and pushing Docker image..." -ForegroundColor Yellow

# Login to ECR
Write-Host "Logging into ECR..." -ForegroundColor Yellow
$ecrPassword = aws ecr get-login-password --region $AWS_REGION
$ecrPassword | docker login --username AWS --password-stdin $ECR_URI

# Build image
Write-Host "Building Docker image..." -ForegroundColor Yellow
Set-Location ..
docker build -t "${PROJECT_NAME}:latest" .

# Tag and push
Write-Host "Pushing image to ECR..." -ForegroundColor Yellow
docker tag "${PROJECT_NAME}:latest" "$ECR_URI`:latest"
docker push "$ECR_URI`:latest"

Write-Host "Image pushed successfully!" -ForegroundColor Green
Write-Host ""

# Step 3: Create/Update Task Definition
Write-Host "Step 3: Creating task definition..." -ForegroundColor Yellow

Set-Location deploy

# Read task definition template
$taskDef = Get-Content task-definition.json -Raw

# Replace placeholders
$taskDef = $taskDef -replace "REPLACE_WITH_TASK_EXECUTION_ROLE_ARN", $TASK_EXECUTION_ROLE
$taskDef = $taskDef -replace "REPLACE_WITH_TASK_ROLE_ARN", $TASK_ROLE
$taskDef = $taskDef -replace "REPLACE_WITH_ECR_IMAGE_URI", "$ECR_URI`:latest"
$taskDef = $taskDef -replace "REPLACE_WITH_LOG_GROUP_NAME", $LOG_GROUP
$taskDef = $taskDef -replace "REPLACE_WITH_AWS_REGION", $AWS_REGION

# For prototype, use public OpenSearch and Redis endpoints
$OPENSEARCH_ENDPOINT = if ($env:OPENSEARCH_ENDPOINT) { $env:OPENSEARCH_ENDPOINT } else { "http://localhost:9200" }
$OPENSEARCH_USERNAME = if ($env:OPENSEARCH_USERNAME) { $env:OPENSEARCH_USERNAME } else { "admin" }
$OPENSEARCH_PASSWORD = if ($env:OPENSEARCH_PASSWORD) { $env:OPENSEARCH_PASSWORD } else { "admin" }
$REDIS_ENDPOINT = if ($env:REDIS_ENDPOINT) { $env:REDIS_ENDPOINT } else { "localhost" }

$taskDef = $taskDef -replace "REPLACE_WITH_OPENSEARCH_ENDPOINT", $OPENSEARCH_ENDPOINT
$taskDef = $taskDef -replace "REPLACE_WITH_OPENSEARCH_USERNAME", $OPENSEARCH_USERNAME
$taskDef = $taskDef -replace "REPLACE_WITH_OPENSEARCH_PASSWORD", $OPENSEARCH_PASSWORD
$taskDef = $taskDef -replace "REPLACE_WITH_REDIS_ENDPOINT", $REDIS_ENDPOINT

# Save temporary task definition
$taskDef | Out-File -FilePath task-definition-temp.json -Encoding utf8

# Register task definition
aws ecs register-task-definition `
    --cli-input-json file://task-definition-temp.json `
    --region $AWS_REGION | Out-Null

Remove-Item task-definition-temp.json

Write-Host "Task definition registered!" -ForegroundColor Green
Write-Host ""

# Step 4: Create ECS Service
Write-Host "Step 4: Creating ECS service..." -ForegroundColor Yellow

$SERVICE_NAME = "$PROJECT_NAME-service"

# Check if service exists
$serviceStatus = aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME --region $AWS_REGION --query 'services[0].status' --output text 2>&1
if ($serviceStatus -eq "ACTIVE") {
    Write-Host "Service exists, updating..." -ForegroundColor Yellow
    aws ecs update-service `
        --cluster $CLUSTER_NAME `
        --service $SERVICE_NAME `
        --task-definition $PROJECT_NAME `
        --desired-count 1 `
        --region $AWS_REGION | Out-Null
} else {
    Write-Host "Creating new service..." -ForegroundColor Yellow
    aws ecs create-service `
        --cluster $CLUSTER_NAME `
        --service-name $SERVICE_NAME `
        --task-definition $PROJECT_NAME `
        --desired-count 1 `
        --launch-type FARGATE `
        --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNET_ID],securityGroups=[$ECS_SG_ID],assignPublicIp=ENABLED}" `
        --region $AWS_REGION | Out-Null
}

Write-Host "Service created/updated!" -ForegroundColor Green
Write-Host ""

# Step 5: Get service endpoint
Write-Host "Step 5: Getting service endpoint..." -ForegroundColor Yellow

# Wait for service to stabilize
Write-Host "Waiting for service to stabilize..." -ForegroundColor Yellow
aws ecs wait services-stable --cluster $CLUSTER_NAME --services $SERVICE_NAME --region $AWS_REGION

# Get task public IP
$TASK_ARN = aws ecs list-tasks --cluster $CLUSTER_NAME --service-name $SERVICE_NAME --region $AWS_REGION --query 'taskArns[0]' --output text
$ENI_ID = aws ecs describe-tasks --cluster $CLUSTER_NAME --tasks $TASK_ARN --region $AWS_REGION --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value' --output text
$PUBLIC_IP = aws ec2 describe-network-interfaces --network-interface-ids $ENI_ID --region $AWS_REGION --query 'NetworkInterfaces[0].Association.PublicIp' --output text

Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Service is running at: http://$PUBLIC_IP`:3000" -ForegroundColor Green
Write-Host "Health check: http://$PUBLIC_IP`:3000/health" -ForegroundColor Green
Write-Host "API docs: http://$PUBLIC_IP`:3000/api-docs" -ForegroundColor Green
Write-Host ""
Write-Host "Note: For production, you should:" -ForegroundColor Yellow
Write-Host "  1. Set up AWS OpenSearch Service"
Write-Host "  2. Set up AWS ElastiCache Redis"
Write-Host "  3. Configure proper security groups"
Write-Host "  4. Set up Application Load Balancer"
Write-Host "  5. Configure API Gateway"
Write-Host ""

