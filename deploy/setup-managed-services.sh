#!/bin/bash

# Script to set up AWS Managed Services (OpenSearch and Redis)
# Run this after deploying the main infrastructure

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

STACK_NAME="document-search-infra"
AWS_REGION="${AWS_REGION:-us-east-1}"

echo -e "${GREEN}Setting up AWS Managed Services${NC}\n"

# Get infrastructure details
echo -e "${YELLOW}Getting infrastructure details...${NC}"
VPC_ID=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION --query 'Stacks[0].Outputs[?OutputKey==`VPCId`].OutputValue' --output text)
PRIVATE_SUBNET=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION --query 'Stacks[0].Outputs[?OutputKey==`PrivateSubnetId`].OutputValue' --output text)
ECS_SG=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION --query 'Stacks[0].Outputs[?OutputKey==`ECSSecurityGroupId`].OutputValue' --output text)
AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)

echo "VPC ID: $VPC_ID"
echo "Private Subnet: $PRIVATE_SUBNET"
echo "ECS Security Group: $ECS_SG"
echo ""

# Step 1: Set up OpenSearch
echo -e "${YELLOW}Step 1: Setting up AWS OpenSearch Service...${NC}"

# Check if domain already exists
if aws opensearch describe-domain --domain-name document-search-opensearch --region $AWS_REGION >/dev/null 2>&1; then
    echo -e "${YELLOW}OpenSearch domain already exists, skipping creation...${NC}"
    OS_ENDPOINT=$(aws opensearch describe-domain --domain-name document-search-opensearch --region $AWS_REGION --query 'DomainStatus.Endpoint' --output text)
else
    # Create OpenSearch security group
    echo "Creating OpenSearch security group..."
    OS_SG=$(aws ec2 create-security-group \
        --group-name document-search-opensearch-sg \
        --description "Security group for OpenSearch" \
        --vpc-id $VPC_ID \
        --region $AWS_REGION \
        --query 'GroupId' --output text 2>/dev/null || \
        aws ec2 describe-security-groups \
            --filters "Name=group-name,Values=document-search-opensearch-sg" "Name=vpc-id,Values=$VPC_ID" \
            --region $AWS_REGION \
            --query 'SecurityGroups[0].GroupId' --output text)

    # Allow ECS to access OpenSearch
    echo "Configuring security group rules..."
    aws ec2 authorize-security-group-ingress \
        --group-id $OS_SG \
        --protocol tcp \
        --port 443 \
        --source-group $ECS_SG \
        --region $AWS_REGION 2>/dev/null || echo "Rule already exists"

    # Create OpenSearch domain
    echo "Creating OpenSearch domain (this takes 15-30 minutes)..."
    aws opensearch create-domain \
        --domain-name document-search-opensearch \
        --cluster-config InstanceType=t3.small.search,InstanceCount=1 \
        --ebs-options EBSEnabled=true,VolumeType=gp3,VolumeSize=20 \
        --vpc-options "SubnetIds=$PRIVATE_SUBNET,SecurityGroupIds=$OS_SG" \
        --access-policies "{
            \"Version\": \"2012-10-17\",
            \"Statement\": [{
                \"Effect\": \"Allow\",
                \"Principal\": {
                    \"AWS\": \"arn:aws:iam::${AWS_ACCOUNT}:root\"
                },
                \"Action\": \"es:*\",
                \"Resource\": \"arn:aws:es:${AWS_REGION}:${AWS_ACCOUNT}:domain/document-search-opensearch/*\"
            }]
        }" \
        --engine-version "OpenSearch_2.11" \
        --node-to-node-encryption-options Enabled=true \
        --encryption-at-rest-options Enabled=true \
        --region $AWS_REGION

    echo "Waiting for OpenSearch domain to be available..."
    aws opensearch wait domain-available \
        --domain-name document-search-opensearch \
        --region $AWS_REGION

    OS_ENDPOINT=$(aws opensearch describe-domain --domain-name document-search-opensearch --region $AWS_REGION --query 'DomainStatus.Endpoint' --output text)
fi

echo -e "${GREEN}OpenSearch endpoint: https://$OS_ENDPOINT${NC}\n"

# Step 2: Set up Redis
echo -e "${YELLOW}Step 2: Setting up AWS ElastiCache Redis...${NC}"

# Check if replication group already exists
if aws elasticache describe-replication-groups --replication-group-id document-search-redis --region $AWS_REGION >/dev/null 2>&1; then
    echo -e "${YELLOW}Redis cluster already exists, skipping creation...${NC}"
    REDIS_ENDPOINT=$(aws elasticache describe-replication-groups \
        --replication-group-id document-search-redis \
        --region $AWS_REGION \
        --query 'ReplicationGroups[0].NodeGroups[0].PrimaryEndpoint.Address' --output text)
else
    # Create Redis security group
    echo "Creating Redis security group..."
    REDIS_SG=$(aws ec2 create-security-group \
        --group-name document-search-redis-sg \
        --description "Security group for Redis" \
        --vpc-id $VPC_ID \
        --region $AWS_REGION \
        --query 'GroupId' --output text 2>/dev/null || \
        aws ec2 describe-security-groups \
            --filters "Name=group-name,Values=document-search-redis-sg" "Name=vpc-id,Values=$VPC_ID" \
            --region $AWS_REGION \
            --query 'SecurityGroups[0].GroupId' --output text)

    # Allow ECS to access Redis
    echo "Configuring security group rules..."
    aws ec2 authorize-security-group-ingress \
        --group-id $REDIS_SG \
        --protocol tcp \
        --port 6379 \
        --source-group $ECS_SG \
        --region $AWS_REGION 2>/dev/null || echo "Rule already exists"

    # Create subnet group
    echo "Creating cache subnet group..."
    aws elasticache create-cache-subnet-group \
        --cache-subnet-group-name document-search-subnet-group \
        --description "Subnet group for Redis" \
        --subnet-ids $PRIVATE_SUBNET \
        --region $AWS_REGION 2>/dev/null || echo "Subnet group already exists"

    # Create Redis cluster
    echo "Creating Redis cluster (this takes 5-10 minutes)..."
    aws elasticache create-replication-group \
        --replication-group-id document-search-redis \
        --description "Redis for document search" \
        --num-cache-clusters 1 \
        --cache-node-type cache.t3.micro \
        --engine redis \
        --engine-version 7.0 \
        --cache-subnet-group-name document-search-subnet-group \
        --security-group-ids $REDIS_SG \
        --at-rest-encryption-enabled \
        --transit-encryption-enabled \
        --region $AWS_REGION

    echo "Waiting for Redis cluster to be available..."
    aws elasticache wait replication-group-available \
        --replication-group-id document-search-redis \
        --region $AWS_REGION

    REDIS_ENDPOINT=$(aws elasticache describe-replication-groups \
        --replication-group-id document-search-redis \
        --region $AWS_REGION \
        --query 'ReplicationGroups[0].NodeGroups[0].PrimaryEndpoint.Address' --output text)
fi

echo -e "${GREEN}Redis endpoint: $REDIS_ENDPOINT${NC}\n"

# Step 3: Output configuration
echo -e "${GREEN}Setup complete!${NC}\n"
echo -e "${YELLOW}Add these to your environment variables:${NC}"
echo ""
echo "export OPENSEARCH_ENDPOINT=\"https://$OS_ENDPOINT\""
echo "export OPENSEARCH_USERNAME=\"admin\""
echo "export OPENSEARCH_PASSWORD=\"<set-during-domain-creation>\""
echo "export REDIS_ENDPOINT=\"$REDIS_ENDPOINT\""
echo ""
echo -e "${YELLOW}Then update your ECS service:${NC}"
echo ""
echo "cd deploy"
echo "./deploy.sh  # This will use the environment variables"
echo ""
echo -e "${YELLOW}Or manually update task definition and redeploy${NC}"

