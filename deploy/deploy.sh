#!/bin/bash

# AWS Deployment Script for Document Search Service
# This script automates the deployment process to AWS ECS Fargate

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="document-search"
AWS_REGION="${AWS_REGION:-us-east-1}"
STACK_NAME="${PROJECT_NAME}-infra"

echo -e "${GREEN}Starting AWS Deployment for Document Search Service${NC}\n"

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"
command -v aws >/dev/null 2>&1 || { echo -e "${RED}AWS CLI is required but not installed.${NC}" >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo -e "${RED}Docker is required but not installed.${NC}" >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { echo -e "${YELLOW}jq is not installed. Some features may not work.${NC}" >&2; }

# Check AWS credentials
echo -e "${YELLOW}Checking AWS credentials...${NC}"
aws sts get-caller-identity >/dev/null 2>&1 || { echo -e "${RED}AWS credentials not configured. Run 'aws configure'${NC}" >&2; exit 1; }

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "${GREEN}AWS Account ID: ${AWS_ACCOUNT_ID}${NC}\n"

# Step 1: Deploy CloudFormation Stack
echo -e "${YELLOW}Step 1: Deploying CloudFormation infrastructure...${NC}"
if aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$AWS_REGION" >/dev/null 2>&1; then
    echo -e "${YELLOW}Stack exists, updating...${NC}"
    aws cloudformation update-stack \
        --stack-name "$STACK_NAME" \
        --template-body file://cloudformation-infra.yaml \
        --parameters ParameterKey=ProjectName,ParameterValue="$PROJECT_NAME" \
        --capabilities CAPABILITY_NAMED_IAM \
        --region "$AWS_REGION"
    
    echo -e "${YELLOW}Waiting for stack update to complete...${NC}"
    aws cloudformation wait stack-update-complete --stack-name "$STACK_NAME" --region "$AWS_REGION"
else
    echo -e "${YELLOW}Creating new stack...${NC}"
    aws cloudformation create-stack \
        --stack-name "$STACK_NAME" \
        --template-body file://cloudformation-infra.yaml \
        --parameters ParameterKey=ProjectName,ParameterValue="$PROJECT_NAME" \
        --capabilities CAPABILITY_NAMED_IAM \
        --region "$AWS_REGION"
    
    echo -e "${YELLOW}Waiting for stack creation to complete (this may take 5-10 minutes)...${NC}"
    aws cloudformation wait stack-create-complete --stack-name "$STACK_NAME" --region "$AWS_REGION"
fi

echo -e "${GREEN}Infrastructure deployed successfully!${NC}\n"

# Get stack outputs
VPC_ID=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$AWS_REGION" --query 'Stacks[0].Outputs[?OutputKey==`VPCId`].OutputValue' --output text)
PRIVATE_SUBNET_ID=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$AWS_REGION" --query 'Stacks[0].Outputs[?OutputKey==`PrivateSubnetId`].OutputValue' --output text)
PUBLIC_SUBNET_ID=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$AWS_REGION" --query 'Stacks[0].Outputs[?OutputKey==`PublicSubnetId`].OutputValue' --output text)
ECS_SG_ID=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$AWS_REGION" --query 'Stacks[0].Outputs[?OutputKey==`ECSSecurityGroupId`].OutputValue' --output text)
CLUSTER_NAME=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$AWS_REGION" --query 'Stacks[0].Outputs[?OutputKey==`ECSClusterName`].OutputValue' --output text)
ECR_URI=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$AWS_REGION" --query 'Stacks[0].Outputs[?OutputKey==`ECRRepositoryURI`].OutputValue' --output text)
TASK_EXECUTION_ROLE=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$AWS_REGION" --query 'Stacks[0].Outputs[?OutputKey==`ECSTaskExecutionRoleArn`].OutputValue' --output text)
TASK_ROLE=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$AWS_REGION" --query 'Stacks[0].Outputs[?OutputKey==`ECSTaskRoleArn`].OutputValue' --output text)
LOG_GROUP=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$AWS_REGION" --query 'Stacks[0].Outputs[?OutputKey==`LogGroupName`].OutputValue' --output text)

echo -e "${GREEN}Infrastructure Details:${NC}"
echo "  VPC ID: $VPC_ID"
echo "  Cluster: $CLUSTER_NAME"
echo "  ECR URI: $ECR_URI"
echo ""

# Step 2: Build and push Docker image
echo -e "${YELLOW}Step 2: Building and pushing Docker image...${NC}"

# Login to ECR
echo -e "${YELLOW}Logging into ECR...${NC}"
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR_URI"

# Build image
echo -e "${YELLOW}Building Docker image...${NC}"
cd ..
docker build -t "$PROJECT_NAME:latest" .

# Tag and push
echo -e "${YELLOW}Pushing image to ECR...${NC}"
docker tag "$PROJECT_NAME:latest" "$ECR_URI:latest"
docker push "$ECR_URI:latest"

echo -e "${GREEN}Image pushed successfully!${NC}\n"

# Step 3: Create/Update Task Definition
echo -e "${YELLOW}Step 3: Creating task definition...${NC}"

cd deploy

# Read task definition template
TASK_DEF=$(cat task-definition.json)

# Replace placeholders
TASK_DEF=$(echo "$TASK_DEF" | sed "s|REPLACE_WITH_TASK_EXECUTION_ROLE_ARN|$TASK_EXECUTION_ROLE|g")
TASK_DEF=$(echo "$TASK_DEF" | sed "s|REPLACE_WITH_TASK_ROLE_ARN|$TASK_ROLE|g")
TASK_DEF=$(echo "$TASK_DEF" | sed "s|REPLACE_WITH_ECR_IMAGE_URI|$ECR_URI:latest|g")
TASK_DEF=$(echo "$TASK_DEF" | sed "s|REPLACE_WITH_LOG_GROUP_NAME|$LOG_GROUP|g")
TASK_DEF=$(echo "$TASK_DEF" | sed "s|REPLACE_WITH_AWS_REGION|$AWS_REGION|g")

# For prototype, use public OpenSearch and Redis endpoints
# User needs to provide these or we'll use defaults
OPENSEARCH_ENDPOINT="${OPENSEARCH_ENDPOINT:-http://localhost:9200}"
OPENSEARCH_USERNAME="${OPENSEARCH_USERNAME:-admin}"
OPENSEARCH_PASSWORD="${OPENSEARCH_PASSWORD:-admin}"
REDIS_ENDPOINT="${REDIS_ENDPOINT:-localhost}"

TASK_DEF=$(echo "$TASK_DEF" | sed "s|REPLACE_WITH_OPENSEARCH_ENDPOINT|$OPENSEARCH_ENDPOINT|g")
TASK_DEF=$(echo "$TASK_DEF" | sed "s|REPLACE_WITH_OPENSEARCH_USERNAME|$OPENSEARCH_USERNAME|g")
TASK_DEF=$(echo "$TASK_DEF" | sed "s|REPLACE_WITH_OPENSEARCH_PASSWORD|$OPENSEARCH_PASSWORD|g")
TASK_DEF=$(echo "$TASK_DEF" | sed "s|REPLACE_WITH_REDIS_ENDPOINT|$REDIS_ENDPOINT|g")

# Save temporary task definition
echo "$TASK_DEF" > task-definition-temp.json

# Register task definition
aws ecs register-task-definition \
    --cli-input-json file://task-definition-temp.json \
    --region "$AWS_REGION" > /dev/null

rm task-definition-temp.json

echo -e "${GREEN}Task definition registered!${NC}\n"

# Step 4: Create ECS Service
echo -e "${YELLOW}Step 4: Creating ECS service...${NC}"

SERVICE_NAME="${PROJECT_NAME}-service"

# Check if service exists
if aws ecs describe-services --cluster "$CLUSTER_NAME" --services "$SERVICE_NAME" --region "$AWS_REGION" --query 'services[0].status' --output text 2>/dev/null | grep -q "ACTIVE"; then
    echo -e "${YELLOW}Service exists, updating...${NC}"
    aws ecs update-service \
        --cluster "$CLUSTER_NAME" \
        --service "$SERVICE_NAME" \
        --task-definition "$PROJECT_NAME" \
        --desired-count 1 \
        --region "$AWS_REGION" > /dev/null
else
    echo -e "${YELLOW}Creating new service...${NC}"
    aws ecs create-service \
        --cluster "$CLUSTER_NAME" \
        --service-name "$SERVICE_NAME" \
        --task-definition "$PROJECT_NAME" \
        --desired-count 1 \
        --launch-type FARGATE \
        --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNET_ID],securityGroups=[$ECS_SG_ID],assignPublicIp=ENABLED}" \
        --region "$AWS_REGION" > /dev/null
fi

echo -e "${GREEN}Service created/updated!${NC}\n"

# Step 5: Get service endpoint
echo -e "${YELLOW}Step 5: Getting service endpoint...${NC}"

# Wait for service to stabilize
echo -e "${YELLOW}Waiting for service to stabilize...${NC}"
aws ecs wait services-stable --cluster "$CLUSTER_NAME" --services "$SERVICE_NAME" --region "$AWS_REGION"

# Get task public IP
TASK_ARN=$(aws ecs list-tasks --cluster "$CLUSTER_NAME" --service-name "$SERVICE_NAME" --region "$AWS_REGION" --query 'taskArns[0]' --output text)
ENI_ID=$(aws ecs describe-tasks --cluster "$CLUSTER_NAME" --tasks "$TASK_ARN" --region "$AWS_REGION" --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value' --output text)
PUBLIC_IP=$(aws ec2 describe-network-interfaces --network-interface-ids "$ENI_ID" --region "$AWS_REGION" --query 'NetworkInterfaces[0].Association.PublicIp' --output text)

echo -e "${GREEN}Deployment complete!${NC}\n"
echo -e "${GREEN}Service is running at: http://${PUBLIC_IP}:3000${NC}"
echo -e "${GREEN}Health check: http://${PUBLIC_IP}:3000/health${NC}"
echo -e "${GREEN}API docs: http://${PUBLIC_IP}:3000/api-docs${NC}\n"

echo -e "${YELLOW}Note: For production, you should:${NC}"
echo "  1. Set up AWS OpenSearch Service"
echo "  2. Set up AWS ElastiCache Redis"
echo "  3. Configure proper security groups"
echo "  4. Set up Application Load Balancer"
echo "  5. Configure API Gateway"
echo ""

