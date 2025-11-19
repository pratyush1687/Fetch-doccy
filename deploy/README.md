# AWS Deployment

This directory contains all the files needed to deploy the Document Search Service to AWS ECS Fargate.

## Files

- `cloudformation-infra.yaml` - CloudFormation template for infrastructure (VPC, ECS cluster, ECR, IAM roles)
- `task-definition.json` - ECS task definition template
- `deploy.sh` - Automated deployment script for Linux/Mac
- `deploy.ps1` - Automated deployment script for Windows PowerShell
- `setup-managed-services.sh` - Script to set up AWS OpenSearch and Redis (Linux/Mac)
- `setup-managed-services.ps1` - Script to set up AWS OpenSearch and Redis (Windows)
- `DEPLOYMENT-QUICKSTART.md` - Detailed deployment guide
- `SETUP-MANAGED-SERVICES.md` - Guide for setting up AWS managed services

## Quick Start

### Linux/Mac

```bash
chmod +x deploy.sh
./deploy.sh
```

### Windows PowerShell

```powershell
.\deploy.ps1
```

## Prerequisites

1. AWS CLI installed and configured (`aws configure`)
2. Docker installed and running
3. AWS account with appropriate permissions

## What Gets Deployed

The deployment creates:

- **VPC** with public and private subnets
- **NAT Gateway** for private subnet internet access
- **ECS Fargate Cluster** for running containers
- **ECR Repository** for storing Docker images
- **IAM Roles** for ECS task execution
- **CloudWatch Log Group** for application logs
- **Security Groups** for network access control
- **ECS Service** running your application

## Cost

Approximate monthly costs for prototype:
- ECS Fargate: ~$15-30/month
- NAT Gateway: ~$32/month
- Data Transfer: Variable
- **Total: ~$50-100/month**

## Next Steps

After deployment, consider:
1. Setting up AWS OpenSearch Service
2. Setting up AWS ElastiCache Redis
3. Configuring Application Load Balancer
4. Setting up API Gateway
5. Configuring auto-scaling

See `DEPLOYMENT-QUICKSTART.md` for detailed instructions.

