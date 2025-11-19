# Setting Up AWS Managed Services for Redis and OpenSearch

This guide explains your options for Redis and OpenSearch when deploying to AWS.

## Options Overview

### Option 1: AWS Managed Services (Recommended for Production)
- **AWS OpenSearch Service** - Fully managed OpenSearch
- **AWS ElastiCache Redis** - Fully managed Redis

**Pros:**
- ✅ Fully managed (no maintenance)
- ✅ High availability & automatic backups
- ✅ Built-in security & encryption
- ✅ Auto-scaling capabilities
- ✅ Production-ready

**Cons:**
- ❌ Higher cost (~$100-500/month)
- ❌ Takes 15-30 minutes to provision
- ❌ More complex setup

### Option 2: Self-Hosted in ECS (Good for Prototype)
- Run OpenSearch and Redis as ECS tasks

**Pros:**
- ✅ Lower cost (~$30-50/month)
- ✅ Quick to set up
- ✅ Full control

**Cons:**
- ❌ You manage updates & backups
- ❌ Less resilient (single instance)
- ❌ Not ideal for production

### Option 3: External Services (Quick Testing)
- Use public endpoints or third-party services

**Pros:**
- ✅ Fastest to set up
- ✅ Good for testing

**Cons:**
- ❌ Not secure for production
- ❌ May have latency issues
- ❌ Not recommended for AWS deployment

## Recommended Approach

**For Prototype:** Start with Option 2 (self-hosted) or Option 1 (managed services)
**For Production:** Use Option 1 (AWS managed services)

---

## Option 1: AWS Managed Services Setup

### Prerequisites

Before setting up managed services, ensure your CloudFormation stack is deployed:

```bash
cd deploy
# Run your deployment script first
./deploy.sh  # or .\deploy.ps1
```

### Step 1: Set Up AWS OpenSearch Service

#### Using AWS CLI

```bash
# Get your VPC and subnet IDs from CloudFormation
STACK_NAME="document-search-infra"
VPC_ID=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`VPCId`].OutputValue' --output text)
PRIVATE_SUBNET=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`PrivateSubnetId`].OutputValue' --output text)
ECS_SG=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`ECSSecurityGroupId`].OutputValue' --output text)
AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION="us-east-1"

# Create OpenSearch security group
OS_SG=$(aws ec2 create-security-group \
  --group-name document-search-opensearch-sg \
  --description "Security group for OpenSearch" \
  --vpc-id $VPC_ID \
  --query 'GroupId' --output text)

# Allow ECS to access OpenSearch
aws ec2 authorize-security-group-ingress \
  --group-id $OS_SG \
  --protocol tcp \
  --port 443 \
  --source-group $ECS_SG

# Create OpenSearch domain (takes 15-30 minutes)
aws opensearch create-domain \
  --domain-name document-search-opensearch \
  --cluster-config InstanceType=t3.small.search,InstanceCount=1 \
  --ebs-options EBSEnabled=true,VolumeType=gp3,VolumeSize=20 \
  --vpc-options SubnetIds=$PRIVATE_SUBNET,SecurityGroupIds=$OS_SG \
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

# Wait for domain to be active
echo "Waiting for OpenSearch domain to be created (this takes 15-30 minutes)..."
aws opensearch wait domain-available \
  --domain-name document-search-opensearch \
  --region $AWS_REGION

# Get endpoint
OS_ENDPOINT=$(aws opensearch describe-domain \
  --domain-name document-search-opensearch \
  --region $AWS_REGION \
  --query 'DomainStatus.Endpoint' --output text)

echo "OpenSearch endpoint: https://$OS_ENDPOINT"
```

**Note:** For production, use IAM-based authentication instead of username/password. Update your task role to have OpenSearch permissions.

#### Update Task Definition

After getting the OpenSearch endpoint, update your ECS service:

```bash
# Update task definition with OpenSearch endpoint
aws ecs update-service \
  --cluster document-search-cluster \
  --service document-search-service \
  --force-new-deployment \
  --region us-east-1
```

Set environment variables:
- `OPENSEARCH_NODE=https://$OS_ENDPOINT`
- `OPENSEARCH_USERNAME=admin` (or use IAM auth)
- `OPENSEARCH_PASSWORD=your-password` (set during domain creation)

### Step 2: Set Up AWS ElastiCache Redis

#### Using AWS CLI

```bash
# Get subnet IDs (need at least 2 for ElastiCache)
STACK_NAME="document-search-infra"
PRIVATE_SUBNET=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`PrivateSubnetId`].OutputValue' --output text)
ECS_SG=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`ECSSecurityGroupId`].OutputValue' --output text)
VPC_ID=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`VPCId`].OutputValue' --output text)

# Create Redis security group
REDIS_SG=$(aws ec2 create-security-group \
  --group-name document-search-redis-sg \
  --description "Security group for Redis" \
  --vpc-id $VPC_ID \
  --query 'GroupId' --output text)

# Allow ECS to access Redis
aws ec2 authorize-security-group-ingress \
  --group-id $REDIS_SG \
  --protocol tcp \
  --port 6379 \
  --source-group $ECS_SG

# Create subnet group (ElastiCache needs subnet group)
aws elasticache create-cache-subnet-group \
  --cache-subnet-group-name document-search-subnet-group \
  --description "Subnet group for Redis" \
  --subnet-ids $PRIVATE_SUBNET \
  --region us-east-1

# Create Redis cluster (takes 5-10 minutes)
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
  --region us-east-1

# Wait for cluster to be available
echo "Waiting for Redis cluster to be created (this takes 5-10 minutes)..."
aws elasticache wait replication-group-available \
  --replication-group-id document-search-redis \
  --region us-east-1

# Get endpoint
REDIS_ENDPOINT=$(aws elasticache describe-replication-groups \
  --replication-group-id document-search-redis \
  --region us-east-1 \
  --query 'ReplicationGroups[0].NodeGroups[0].PrimaryEndpoint.Address' --output text)

echo "Redis endpoint: $REDIS_ENDPOINT"
```

**Note:** For production, use `cache.t3.small` or larger, and enable Multi-AZ.

#### Update Task Definition

After getting the Redis endpoint, update your ECS service:

```bash
# Set Redis endpoint in task definition
# Update task-definition.json with REDIS_ENDPOINT
# Then force new deployment
aws ecs update-service \
  --cluster document-search-cluster \
  --service document-search-service \
  --force-new-deployment \
  --region us-east-1
```

Set environment variable:
- `REDIS_HOST=$REDIS_ENDPOINT`
- `REDIS_PORT=6379`

---

## Option 2: Self-Hosted in ECS (Prototype)

For a quick prototype, you can run OpenSearch and Redis as ECS tasks. See `docker-compose.yml` for the configuration.

### Quick Setup Script

Create a script to deploy OpenSearch and Redis as ECS services:

```bash
# This would create ECS services for OpenSearch and Redis
# Similar to how you deploy the main app
```

**Cost:** ~$30-50/month for both services

---

## Cost Comparison

### AWS Managed Services
- **OpenSearch:** ~$50-200/month (t3.small.search)
- **Redis:** ~$15-50/month (cache.t3.micro)
- **Total:** ~$65-250/month

### Self-Hosted in ECS
- **OpenSearch:** ~$15-30/month (Fargate)
- **Redis:** ~$15-30/month (Fargate)
- **Total:** ~$30-60/month

### Recommendation
- **Prototype:** Self-hosted (~$30-60/month)
- **Production:** Managed services (~$100-300/month)

---

## Quick Setup Script

I'll create automated scripts for both options. For now, use the AWS CLI commands above.

---

## Updating Your Deployment

After setting up managed services, update your deployment:

### Method 1: Environment Variables

```bash
export OPENSEARCH_ENDPOINT="https://your-opensearch-domain.es.amazonaws.com"
export OPENSEARCH_USERNAME="admin"
export OPENSEARCH_PASSWORD="your-password"
export REDIS_ENDPOINT="your-redis-cluster.cache.amazonaws.com"

# Then run deployment script
cd deploy
./deploy.sh
```

### Method 2: Update Task Definition Manually

Edit `task-definition.json` and replace:
- `REPLACE_WITH_OPENSEARCH_ENDPOINT` → Your OpenSearch endpoint
- `REPLACE_WITH_REDIS_ENDPOINT` → Your Redis endpoint

Then register and update service:

```bash
aws ecs register-task-definition \
  --cli-input-json file://task-definition.json \
  --region us-east-1

aws ecs update-service \
  --cluster document-search-cluster \
  --service document-search-service \
  --task-definition document-search \
  --region us-east-1
```

---

## Security Best Practices

### For Production:

1. **OpenSearch:**
   - Use IAM-based authentication (not username/password)
   - Enable fine-grained access control
   - Use VPC endpoints
   - Enable encryption at rest and in transit

2. **Redis:**
   - Enable transit encryption (TLS)
   - Use auth tokens
   - Restrict security groups
   - Enable encryption at rest

3. **Network:**
   - Use private subnets
   - Restrict security groups to specific sources
   - Use VPC endpoints for AWS services

---

## Troubleshooting

### OpenSearch Connection Issues

1. Check security groups allow port 443 from ECS
2. Verify VPC configuration
3. Check IAM permissions for OpenSearch
4. Verify endpoint URL is correct

### Redis Connection Issues

1. Check security groups allow port 6379 from ECS
2. Verify subnet group configuration
3. Check if transit encryption matches client config
4. Verify endpoint URL is correct

### Testing Connectivity

```bash
# Test OpenSearch (from ECS task)
curl -u admin:password https://your-opensearch-domain.es.amazonaws.com/_cluster/health

# Test Redis (from ECS task)
redis-cli -h your-redis-endpoint.cache.amazonaws.com -p 6379 ping
```

---

## Next Steps

1. Choose your option (managed vs self-hosted)
2. Set up the services using commands above
3. Update your task definition with endpoints
4. Redeploy your ECS service
5. Test the endpoints

For automated setup scripts, see `setup-managed-services.sh` (coming soon).

