# AWS Deployment Guide

This guide provides step-by-step instructions for deploying the Distributed Document Search Service to AWS.

## Prerequisites

### AWS Account Setup

1. **AWS Account:** Active AWS account with appropriate permissions
2. **AWS CLI:** Installed and configured (`aws configure`)
3. **Docker:** Installed for building container images
4. **Node.js:** v18+ installed for local development
5. **IAM Permissions:** Admin access or permissions for:
   - ECS, VPC, EC2, IAM, CloudWatch, S3, SQS, ElastiCache, OpenSearch Service, API Gateway, Cognito

### Local Setup

1. **Clone Repository:**
   ```bash
   git clone <repository-url>
   cd deeprunner-task
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Build Application:**
   ```bash
   npm run build
   ```

## Step 1: Create VPC and Networking

### 1.1 Create VPC

```bash
# Create VPC
aws ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=document-search-vpc}]'

# Note the VpcId from output
VPC_ID="vpc-xxxxxxxx"
```

### 1.2 Create Internet Gateway

```bash
# Create Internet Gateway
IGW_ID=$(aws ec2 create-internet-gateway \
  --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=document-search-igw}]' \
  --query 'InternetGateway.InternetGatewayId' --output text)

# Attach to VPC
aws ec2 attach-internet-gateway \
  --internet-gateway-id $IGW_ID \
  --vpc-id $VPC_ID
```

### 1.3 Create Subnets

```bash
# Get Availability Zones
AZ1="us-east-1a"
AZ2="us-east-1b"
AZ3="us-east-1c"

# Public Subnets
PUBLIC_SUBNET_1=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.1.0/24 \
  --availability-zone $AZ1 \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=public-subnet-1a}]' \
  --query 'Subnet.SubnetId' --output text)

PUBLIC_SUBNET_2=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.2.0/24 \
  --availability-zone $AZ2 \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=public-subnet-1b}]' \
  --query 'Subnet.SubnetId' --output text)

PUBLIC_SUBNET_3=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.3.0/24 \
  --availability-zone $AZ3 \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=public-subnet-1c}]' \
  --query 'Subnet.SubnetId' --output text)

# Private Subnets
PRIVATE_SUBNET_1=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.10.0/24 \
  --availability-zone $AZ1 \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=private-subnet-1a}]' \
  --query 'Subnet.SubnetId' --output text)

PRIVATE_SUBNET_2=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.11.0/24 \
  --availability-zone $AZ2 \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=private-subnet-1b}]' \
  --query 'Subnet.SubnetId' --output text)

PRIVATE_SUBNET_3=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.12.0/24 \
  --availability-zone $AZ3 \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=private-subnet-1c}]' \
  --query 'Subnet.SubnetId' --output text)

# Data Subnets
DATA_SUBNET_1=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.20.0/24 \
  --availability-zone $AZ1 \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=data-subnet-1a}]' \
  --query 'Subnet.SubnetId' --output text)

DATA_SUBNET_2=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.21.0/24 \
  --availability-zone $AZ2 \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=data-subnet-1b}]' \
  --query 'Subnet.SubnetId' --output text)

DATA_SUBNET_3=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.22.0/24 \
  --availability-zone $AZ3 \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=data-subnet-1c}]' \
  --query 'Subnet.SubnetId' --output text)
```

### 1.4 Create NAT Gateways

```bash
# Allocate Elastic IPs
EIP_1=$(aws ec2 allocate-address --domain vpc --query 'AllocationId' --output text)
EIP_2=$(aws ec2 allocate-address --domain vpc --query 'AllocationId' --output text)
EIP_3=$(aws ec2 allocate-address --domain vpc --query 'AllocationId' --output text)

# Create NAT Gateways
NAT_1=$(aws ec2 create-nat-gateway \
  --subnet-id $PUBLIC_SUBNET_1 \
  --allocation-id $EIP_1 \
  --query 'NatGateway.NatGatewayId' --output text)

NAT_2=$(aws ec2 create-nat-gateway \
  --subnet-id $PUBLIC_SUBNET_2 \
  --allocation-id $EIP_2 \
  --query 'NatGateway.NatGatewayId' --output text)

NAT_3=$(aws ec2 create-nat-gateway \
  --subnet-id $PUBLIC_SUBNET_3 \
  --allocation-id $EIP_3 \
  --query 'NatGateway.NatGatewayId' --output text)

# Wait for NAT Gateways to be available
aws ec2 wait nat-gateway-available --nat-gateway-ids $NAT_1 $NAT_2 $NAT_3
```

### 1.5 Configure Route Tables

```bash
# Create route tables
PUBLIC_RT=$(aws ec2 create-route-table \
  --vpc-id $VPC_ID \
  --tag-specifications 'ResourceType=route-table,Tags=[{Key=Name,Value=public-rt}]' \
  --query 'RouteTable.RouteTableId' --output text)

PRIVATE_RT=$(aws ec2 create-route-table \
  --vpc-id $VPC_ID \
  --tag-specifications 'ResourceType=route-table,Tags=[{Key=Name,Value=private-rt}]' \
  --query 'RouteTable.RouteTableId' --output text)

# Add routes
aws ec2 create-route --route-table-id $PUBLIC_RT --destination-cidr-block 0.0.0.0/0 --gateway-id $IGW_ID
aws ec2 create-route --route-table-id $PRIVATE_RT --destination-cidr-block 0.0.0.0/0 --nat-gateway-id $NAT_1

# Associate subnets
aws ec2 associate-route-table --subnet-id $PUBLIC_SUBNET_1 --route-table-id $PUBLIC_RT
aws ec2 associate-route-table --subnet-id $PUBLIC_SUBNET_2 --route-table-id $PUBLIC_RT
aws ec2 associate-route-table --subnet-id $PUBLIC_SUBNET_3 --route-table-id $PUBLIC_RT
aws ec2 associate-route-table --subnet-id $PRIVATE_SUBNET_1 --route-table-id $PRIVATE_RT
aws ec2 associate-route-table --subnet-id $PRIVATE_SUBNET_2 --route-table-id $PRIVATE_RT
aws ec2 associate-route-table --subnet-id $PRIVATE_SUBNET_3 --route-table-id $PRIVATE_RT
```

## Step 2: Create Security Groups

```bash
# ECS Service Security Group
ECS_SG=$(aws ec2 create-security-group \
  --group-name ecs-service-sg \
  --description "Security group for ECS services" \
  --vpc-id $VPC_ID \
  --query 'GroupId' --output text)

# OpenSearch Security Group
OS_SG=$(aws ec2 create-security-group \
  --group-name opensearch-sg \
  --description "Security group for OpenSearch" \
  --vpc-id $VPC_ID \
  --query 'GroupId' --output text)

# Redis Security Group
REDIS_SG=$(aws ec2 create-security-group \
  --group-name redis-sg \
  --description "Security group for Redis" \
  --vpc-id $VPC_ID \
  --query 'GroupId' --output text)

# Allow ECS to access OpenSearch
aws ec2 authorize-security-group-ingress \
  --group-id $OS_SG \
  --protocol tcp \
  --port 443 \
  --source-group $ECS_SG

# Allow ECS to access Redis
aws ec2 authorize-security-group-ingress \
  --group-id $REDIS_SG \
  --protocol tcp \
  --port 6379 \
  --source-group $ECS_SG
```

## Step 3: Create IAM Roles

### 3.1 ECS Task Execution Role

```bash
# Create role
aws iam create-role \
  --role-name ECSTaskExecutionRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ecs-tasks.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Attach managed policy
aws iam attach-role-policy \
  --role-name ECSTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
```

### 3.2 ECS Task Role

```bash
# Create role
aws iam create-role \
  --role-name SearchServiceTaskRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ecs-tasks.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Create and attach policy (see AWS-ARCHITECTURE.md for full policy)
aws iam put-role-policy \
  --role-name SearchServiceTaskRole \
  --policy-name SearchServicePolicy \
  --policy-document file://infra/policies/search-service-policy.json
```

## Step 4: Create ECR Repository

```bash
# Create ECR repository
aws ecr create-repository \
  --repository-name document-search \
  --region us-east-1

# Get login token
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Build and push image
docker build -t document-search .
docker tag document-search:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/document-search:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/document-search:latest
```

## Step 5: Create OpenSearch Domain

```bash
# Create OpenSearch domain (this takes 15-30 minutes)
aws opensearch create-domain \
  --domain-name document-search-domain \
  --cluster-config '{
    "InstanceType": "r6g.large.search",
    "InstanceCount": 3,
    "DedicatedMasterEnabled": true,
    "MasterInstanceType": "r6g.medium.search",
    "MasterInstanceCount": 3,
    "ZoneAwarenessEnabled": true,
    "ZoneAwarenessConfig": {"AvailabilityZoneCount": 3}
  }' \
  --ebs-options '{
    "EBSEnabled": true,
    "VolumeType": "gp3",
    "VolumeSize": 100
  }' \
  --vpc-options '{
    "SubnetIds": ["'$DATA_SUBNET_1'", "'$DATA_SUBNET_2'", "'$DATA_SUBNET_3'"],
    "SecurityGroupIds": ["'$OS_SG'"]
  }' \
  --encryption-at-rest-options '{
    "Enabled": true
  }' \
  --node-to-node-encryption-options '{
    "Enabled": true
  }' \
  --access-policies file://infra/policies/opensearch-access-policy.json

# Wait for domain to be active
aws opensearch describe-domain --domain-name document-search-domain --query 'DomainStatus.Processing' --output text
```

## Step 6: Create ElastiCache Redis Cluster

```bash
# Create subnet group
aws elasticache create-cache-subnet-group \
  --cache-subnet-group-name document-search-subnet-group \
  --description "Subnet group for Redis" \
  --subnet-ids $DATA_SUBNET_1 $DATA_SUBNET_2 $DATA_SUBNET_3

# Create Redis cluster
aws elasticache create-replication-group \
  --replication-group-id document-search-redis \
  --description "Redis cluster for document search" \
  --num-cache-clusters 3 \
  --cache-node-type cache.r6g.large \
  --engine redis \
  --engine-version 7.0 \
  --cache-subnet-group-name document-search-subnet-group \
  --security-group-ids $REDIS_SG \
  --at-rest-encryption-enabled \
  --transit-encryption-enabled \
  --multi-az-enabled \
  --automatic-failover-enabled
```

## Step 7: Create S3 Bucket

```bash
# Create S3 bucket
aws s3 mb s3://document-storage-$(aws sts get-caller-identity --query Account --output text)-us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket document-storage-$(aws sts get-caller-identity --query Account --output text)-us-east-1 \
  --versioning-configuration Status=Enabled

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket document-storage-$(aws sts get-caller-identity --query Account --output text)-us-east-1 \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'
```

## Step 8: Create SQS Queue

```bash
# Create SQS queue
aws sqs create-queue \
  --queue-name document-ingestion-queue \
  --attributes '{
    "VisibilityTimeout": "300",
    "MessageRetentionPeriod": "1209600"
  }'

# Create dead letter queue
aws sqs create-queue \
  --queue-name document-ingestion-dlq

# Get queue URLs
INGESTION_QUEUE_URL=$(aws sqs get-queue-url --queue-name document-ingestion-queue --query 'QueueUrl' --output text)
DLQ_URL=$(aws sqs get-queue-url --queue-name document-ingestion-dlq --query 'QueueUrl' --output text)

# Get DLQ ARN
DLQ_ARN=$(aws sqs get-queue-attributes \
  --queue-url $DLQ_URL \
  --attribute-names QueueArn \
  --query 'Attributes.QueueArn' --output text)

# Configure DLQ on main queue
aws sqs set-queue-attributes \
  --queue-url $INGESTION_QUEUE_URL \
  --attributes "{\"RedrivePolicy\":\"{\\\"deadLetterTargetArn\\\":\\\"$DLQ_ARN\\\",\\\"maxReceiveCount\\\":3}\"}"
```

## Step 9: Create ECS Cluster and Services

### 9.1 Create ECS Cluster

```bash
aws ecs create-cluster \
  --cluster-name document-search-cluster \
  --capacity-providers FARGATE FARGATE_SPOT \
  --default-capacity-provider-strategy \
    capacityProvider=FARGATE,weight=1 \
    capacityProvider=FARGATE_SPOT,weight=0

# Enable Container Insights
aws ecs update-cluster-settings \
  --cluster document-search-cluster \
  --settings name=containerInsights,value=enabled
```

### 9.2 Create Task Definition

```bash
# Create task definition JSON (see infra/task-definitions/search-service.json)
aws ecs register-task-definition \
  --cli-input-json file://infra/task-definitions/search-service.json
```

### 9.3 Create Network Load Balancer

```bash
# Create NLB
NLB_ARN=$(aws elbv2 create-load-balancer \
  --name document-search-nlb \
  --type network \
  --scheme internal \
  --subnets $PRIVATE_SUBNET_1 $PRIVATE_SUBNET_2 $PRIVATE_SUBNET_3 \
  --query 'LoadBalancers[0].LoadBalancerArn' --output text)

# Create target group
TARGET_GROUP_ARN=$(aws elbv2 create-target-group \
  --name search-service-tg \
  --protocol TCP \
  --port 3000 \
  --vpc-id $VPC_ID \
  --health-check-protocol HTTP \
  --health-check-path /health \
  --health-check-interval-seconds 30 \
  --query 'TargetGroups[0].TargetGroupArn' --output text)

# Create listener
aws elbv2 create-listener \
  --load-balancer-arn $NLB_ARN \
  --protocol TCP \
  --port 3000 \
  --default-actions Type=forward,TargetGroupArn=$TARGET_GROUP_ARN
```

### 9.4 Create ECS Service

```bash
aws ecs create-service \
  --cluster document-search-cluster \
  --service-name search-service \
  --task-definition search-service \
  --desired-count 3 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNET_1,$PRIVATE_SUBNET_2,$PRIVATE_SUBNET_3],securityGroups=[$ECS_SG],assignPublicIp=DISABLED}" \
  --load-balancers "targetGroupArn=$TARGET_GROUP_ARN,containerName=search-service,containerPort=3000" \
  --enable-logging \
  --log-driver awslogs \
  --log-options "awslogs-group=/ecs/search-service,awslogs-region=us-east-1,awslogs-stream-prefix=ecs"
```

## Step 10: Create API Gateway

```bash
# Create VPC Link
VPC_LINK_ID=$(aws apigateway create-vpc-link \
  --name document-search-vpc-link \
  --subnet-ids $PRIVATE_SUBNET_1 $PRIVATE_SUBNET_2 $PRIVATE_SUBNET_3 \
  --query 'id' --output text)

# Create REST API
API_ID=$(aws apigateway create-rest-api \
  --name document-search-api \
  --query 'id' --output text)

# Create resources and methods (see infra/api-gateway/ for full configuration)
# This is complex - consider using AWS Console or CloudFormation/Terraform
```

## Step 11: Create Cognito User Pool

```bash
# Create user pool
USER_POOL_ID=$(aws cognito-idp create-user-pool \
  --pool-name document-search-users \
  --auto-verified-attributes email \
  --policies '{
    "PasswordPolicy": {
      "MinimumLength": 8,
      "RequireUppercase": true,
      "RequireLowercase": true,
      "RequireNumbers": true,
      "RequireSymbols": true
    }
  }' \
  --query 'UserPool.Id' --output text)

# Create app client
CLIENT_ID=$(aws cognito-idp create-user-pool-client \
  --user-pool-id $USER_POOL_ID \
  --client-name document-search-client \
  --generate-secret \
  --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH \
  --query 'UserPoolClient.ClientId' --output text)
```

## Step 12: Configure Environment Variables

Update ECS task definitions with environment variables:

```bash
# Get OpenSearch endpoint
OS_ENDPOINT=$(aws opensearch describe-domain \
  --domain-name document-search-domain \
  --query 'DomainStatus.Endpoint' --output text)

# Get Redis endpoint
REDIS_ENDPOINT=$(aws elasticache describe-replication-groups \
  --replication-group-id document-search-redis \
  --query 'ReplicationGroups[0].NodeGroups[0].PrimaryEndpoint.Address' --output text)

# Update task definition with these values
```

## Step 13: Initialize OpenSearch Index

```bash
# SSH into ECS task or use AWS Systems Manager Session Manager
# Run initialization script to create index
curl -X PUT "https://$OS_ENDPOINT/documents" \
  -H "Content-Type: application/json" \
  -d @infra/opensearch/index-mapping.json
```

## Step 14: Health Checks and Monitoring

### 14.1 Create CloudWatch Alarms

```bash
# High latency alarm
aws cloudwatch put-metric-alarm \
  --alarm-name search-service-high-latency \
  --alarm-description "Alert when P95 latency exceeds 500ms" \
  --metric-name SearchLatency \
  --namespace DocumentSearch \
  --statistic p95 \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 500 \
  --comparison-operator GreaterThanThreshold

# Error rate alarm
aws cloudwatch put-metric-alarm \
  --alarm-name search-service-high-errors \
  --alarm-description "Alert when error rate exceeds 1%" \
  --metric-name ErrorRate \
  --namespace DocumentSearch \
  --statistic Average \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 0.01 \
  --comparison-operator GreaterThanThreshold
```

## Step 15: Testing

### 15.1 Test Health Endpoint

```bash
# Get API Gateway endpoint
API_ENDPOINT=$(aws apigateway get-rest-apis --query "items[?name=='document-search-api'].id" --output text)

curl https://$API_ENDPOINT.execute-api.us-east-1.amazonaws.com/prod/health
```

### 15.2 Test Authentication

```bash
# Create test user
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username testuser \
  --user-attributes Name=email,Value=test@example.com Name=custom:tenant_id,Value=tenant-123 \
  --temporary-password TempPass123!

# Get authentication token
TOKEN=$(aws cognito-idp admin-initiate-auth \
  --user-pool-id $USER_POOL_ID \
  --client-id $CLIENT_ID \
  --auth-flow ADMIN_NO_SRP_AUTH \
  --auth-parameters USERNAME=testuser,PASSWORD=TempPass123! \
  --query 'AuthenticationResult.IdToken' --output text)

# Test API with token
curl -H "Authorization: Bearer $TOKEN" \
  https://$API_ENDPOINT.execute-api.us-east-1.amazonaws.com/prod/search?q=test
```

## Troubleshooting

### Common Issues

1. **ECS tasks failing to start:**
   - Check CloudWatch Logs for errors
   - Verify IAM roles have correct permissions
   - Ensure security groups allow necessary traffic

2. **OpenSearch connection failures:**
   - Verify security group rules
   - Check VPC endpoint configuration
   - Ensure IAM access policy is correct

3. **Redis connection failures:**
   - Verify security group allows port 6379
   - Check Redis endpoint is correct
   - Ensure transit encryption matches client configuration

4. **API Gateway 502 errors:**
   - Check VPC Link status
   - Verify NLB target group health
   - Ensure ECS tasks are running and healthy

### Log Locations

- **ECS Logs:** `/ecs/search-service`, `/ecs/document-service`
- **OpenSearch Logs:** `/aws/opensearch/domains/document-search-domain`
- **API Gateway Logs:** Configured in API Gateway settings

## Next Steps

1. Set up CI/CD pipeline (GitHub Actions, AWS CodePipeline)
2. Configure auto-scaling policies
3. Set up backup and disaster recovery procedures
4. Implement monitoring dashboards in CloudWatch
5. Set up alerting via SNS

## Cost Estimation

Approximate monthly costs (us-east-1):

- **OpenSearch:** ~$500-800 (3x r6g.large + 3x master nodes)
- **ElastiCache Redis:** ~$300-500 (3x cache.r6g.large)
- **ECS Fargate:** ~$200-400 (depending on traffic)
- **NAT Gateways:** ~$135 (3x $45/month)
- **Data Transfer:** Variable
- **S3 Storage:** Variable (pay per GB)
- **API Gateway:** Pay per request

**Total:** ~$1,200-2,000/month for moderate traffic

