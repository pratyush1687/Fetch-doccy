# AWS Deployment Quick Start Guide

This guide will help you deploy the Document Search Service prototype to AWS ECS Fargate in under 30 minutes.

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** installed and configured (`aws configure`)
3. **Docker** installed and running
4. **jq** (optional, for JSON parsing)
5. **Bash** (Linux/Mac) or **Git Bash** (Windows)

## Quick Deployment (Automated)

### Step 1: Navigate to Deployment Directory

```bash
cd deploy
```

### Step 2: Make Script Executable (Linux/Mac)

```bash
chmod +x deploy.sh
```

### Step 3: Set Environment Variables (Optional)

```bash
# AWS Region (default: us-east-1)
export AWS_REGION=us-east-1

# OpenSearch endpoint (if using AWS OpenSearch Service)
export OPENSEARCH_ENDPOINT=https://your-opensearch-domain.us-east-1.es.amazonaws.com
export OPENSEARCH_USERNAME=admin
export OPENSEARCH_PASSWORD=your-password

# Redis endpoint (if using AWS ElastiCache)
export REDIS_ENDPOINT=your-redis-cluster.xxxxx.cache.amazonaws.com
```

**Note:** For prototype deployment, you can use public endpoints or set up AWS managed services later.

### Step 4: Run Deployment Script

```bash
./deploy.sh
```

The script will:
1. ✅ Create VPC, subnets, security groups
2. ✅ Create ECS cluster and ECR repository
3. ✅ Build and push Docker image
4. ✅ Register task definition
5. ✅ Create ECS service
6. ✅ Output service endpoint

### Step 5: Access Your Service

After deployment completes, you'll see output like:

```
Service is running at: http://54.123.45.67:3000
Health check: http://54.123.45.67:3000/health
API docs: http://54.123.45.67:3000/api-docs
```

Test the health endpoint:

```bash
curl http://YOUR_PUBLIC_IP:3000/health
```

## Manual Deployment Steps

If you prefer to deploy manually or the script fails, follow these steps:

### Step 1: Deploy Infrastructure

```bash
aws cloudformation create-stack \
  --stack-name document-search-infra \
  --template-body file://cloudformation-infra.yaml \
  --parameters ParameterKey=ProjectName,ParameterValue=document-search \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-east-1

# Wait for stack creation
aws cloudformation wait stack-create-complete \
  --stack-name document-search-infra \
  --region us-east-1
```

### Step 2: Get Stack Outputs

```bash
aws cloudformation describe-stacks \
  --stack-name document-search-infra \
  --region us-east-1 \
  --query 'Stacks[0].Outputs'
```

Save these values:
- `ECRRepositoryURI` - ECR repository URL
- `ECSClusterName` - ECS cluster name
- `ECSTaskExecutionRoleArn` - Task execution role
- `ECSTaskRoleArn` - Task role
- `LogGroupName` - CloudWatch log group
- `PrivateSubnetId` - Private subnet ID
- `ECSSecurityGroupId` - Security group ID

### Step 3: Build and Push Docker Image

```bash
# Get ECR login
ECR_URI=$(aws cloudformation describe-stacks \
  --stack-name document-search-infra \
  --region us-east-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`ECRRepositoryURI`].OutputValue' \
  --output text)

# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin $ECR_URI

# Build image
cd ..
docker build -t document-search:latest .

# Tag and push
docker tag document-search:latest $ECR_URI:latest
docker push $ECR_URI:latest
```

### Step 4: Create Task Definition

Edit `task-definition.json` and replace placeholders:
- `REPLACE_WITH_TASK_EXECUTION_ROLE_ARN`
- `REPLACE_WITH_TASK_ROLE_ARN`
- `REPLACE_WITH_ECR_IMAGE_URI`
- `REPLACE_WITH_LOG_GROUP_NAME`
- `REPLACE_WITH_AWS_REGION`
- `REPLACE_WITH_OPENSEARCH_ENDPOINT`
- `REPLACE_WITH_REDIS_ENDPOINT`

Then register:

```bash
aws ecs register-task-definition \
  --cli-input-json file://task-definition.json \
  --region us-east-1
```

### Step 5: Create ECS Service

```bash
aws ecs create-service \
  --cluster document-search-cluster \
  --service-name document-search-service \
  --task-definition document-search \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}" \
  --region us-east-1
```

### Step 6: Get Service Endpoint

```bash
# Get task ARN
TASK_ARN=$(aws ecs list-tasks \
  --cluster document-search-cluster \
  --service-name document-search-service \
  --region us-east-1 \
  --query 'taskArns[0]' \
  --output text)

# Get network interface ID
ENI_ID=$(aws ecs describe-tasks \
  --cluster document-search-cluster \
  --tasks $TASK_ARN \
  --region us-east-1 \
  --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value' \
  --output text)

# Get public IP
PUBLIC_IP=$(aws ec2 describe-network-interfaces \
  --network-interface-ids $ENI_ID \
  --region us-east-1 \
  --query 'NetworkInterfaces[0].Association.PublicIp' \
  --output text)

echo "Service URL: http://$PUBLIC_IP:3000"
```

## Setting Up AWS Managed Services (Recommended for Production)

For production deployments, use AWS managed services. See [SETUP-MANAGED-SERVICES.md](SETUP-MANAGED-SERVICES.md) for detailed instructions.

### Quick Setup

After deploying infrastructure, run:

**Linux/Mac:**
```bash
cd deploy
chmod +x setup-managed-services.sh
./setup-managed-services.sh
```

**Windows PowerShell:**
```powershell
cd deploy
.\setup-managed-services.ps1
```

This will create:
- AWS OpenSearch Service domain
- AWS ElastiCache Redis cluster
- Required security groups and networking

### Manual Setup

### AWS OpenSearch Service

For production, set up AWS OpenSearch Service:

```bash
aws opensearch create-domain \
  --domain-name document-search-opensearch \
  --cluster-config InstanceType=t3.small.search,InstanceCount=1 \
  --ebs-options EBSEnabled=true,VolumeType=gp3,VolumeSize=20 \
  --access-policies '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"AWS": "*"},
      "Action": "es:*",
      "Resource": "arn:aws:es:us-east-1:ACCOUNT:domain/document-search-opensearch/*"
    }]
  }' \
  --region us-east-1
```

Get the endpoint:

```bash
aws opensearch describe-domain \
  --domain-name document-search-opensearch \
  --region us-east-1 \
  --query 'DomainStatus.Endpoint' \
  --output text
```

### AWS ElastiCache Redis

For production, set up ElastiCache Redis:

```bash
# Create subnet group
aws elasticache create-cache-subnet-group \
  --cache-subnet-group-name document-search-subnet-group \
  --description "Subnet group for Redis" \
  --subnet-ids subnet-xxx subnet-yyy \
  --region us-east-1

# Create Redis cluster
aws elasticache create-replication-group \
  --replication-group-id document-search-redis \
  --description "Redis for document search" \
  --num-cache-clusters 1 \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --engine-version 7.0 \
  --cache-subnet-group-name document-search-subnet-group \
  --security-group-ids sg-xxx \
  --region us-east-1
```

Get the endpoint:

```bash
aws elasticache describe-replication-groups \
  --replication-group-id document-search-redis \
  --region us-east-1 \
  --query 'ReplicationGroups[0].NodeGroups[0].PrimaryEndpoint.Address' \
  --output text
```

## Updating the Service

To update the service with a new image:

```bash
# Build and push new image
docker build -t document-search:latest .
docker tag document-search:latest $ECR_URI:latest
docker push $ECR_URI:latest

# Force new deployment
aws ecs update-service \
  --cluster document-search-cluster \
  --service document-search-service \
  --force-new-deployment \
  --region us-east-1
```

## Viewing Logs

```bash
# View CloudWatch logs
aws logs tail /ecs/document-search --follow --region us-east-1
```

Or view in AWS Console:
1. Go to CloudWatch → Log groups
2. Select `/ecs/document-search`
3. View log streams

## Monitoring

View service status:

```bash
aws ecs describe-services \
  --cluster document-search-cluster \
  --services document-search-service \
  --region us-east-1
```

View running tasks:

```bash
aws ecs list-tasks \
  --cluster document-search-cluster \
  --service-name document-search-service \
  --region us-east-1
```

## Troubleshooting

### Service Not Starting

1. Check CloudWatch logs:
   ```bash
   aws logs tail /ecs/document-search --follow
   ```

2. Check task status:
   ```bash
   aws ecs describe-tasks \
     --cluster document-search-cluster \
     --tasks TASK_ARN \
     --region us-east-1
   ```

3. Verify security groups allow traffic on port 3000

### Cannot Connect to OpenSearch/Redis

1. Ensure endpoints are correct in task definition
2. Check security groups allow outbound traffic
3. Verify VPC routing (NAT Gateway for private subnets)

### Image Pull Errors

1. Verify ECR login:
   ```bash
   aws ecr get-login-password --region us-east-1 | \
     docker login --username AWS --password-stdin $ECR_URI
   ```

2. Check IAM role has ECR permissions

## Cleanup

To remove all resources:

```bash
# Delete ECS service
aws ecs update-service \
  --cluster document-search-cluster \
  --service document-search-service \
  --desired-count 0 \
  --region us-east-1

aws ecs delete-service \
  --cluster document-search-cluster \
  --service document-search-service \
  --region us-east-1

# Delete CloudFormation stack
aws cloudformation delete-stack \
  --stack-name document-search-infra \
  --region us-east-1

# Wait for deletion
aws cloudformation wait stack-delete-complete \
  --stack-name document-search-infra \
  --region us-east-1
```

## Cost Estimation

Approximate costs for prototype deployment:

- **ECS Fargate:** ~$15-30/month (1 task running 24/7)
- **ECR:** ~$0.10/GB/month (storage)
- **CloudWatch Logs:** ~$0.50/GB ingested
- **NAT Gateway:** ~$32/month (if using private subnet)
- **Data Transfer:** Variable

**Total:** ~$50-100/month for prototype

## Next Steps

1. Set up AWS OpenSearch Service for production
2. Set up AWS ElastiCache Redis for production
3. Configure Application Load Balancer
4. Set up API Gateway
5. Configure auto-scaling
6. Set up monitoring and alerts

For detailed production deployment, see `../docs/DEPLOYMENT.md`.

