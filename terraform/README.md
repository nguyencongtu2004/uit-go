# UIT-GO Terraform Infrastructure

Terraform configuration để triển khai UIT-GO lên AWS với kiến trúc production-ready.

## 📁 Cấu Trúc

```
terraform/
├── main.tf                    # Root module
├── variables.tf               # Input variables
├── outputs.tf                 # Output values
├── terraform.tfvars.example   # Example configuration
├── README.md                  # Documentation
└── modules/
    ├── vpc/                   # VPC, Subnets, NAT Gateway
    ├── eks/                   # EKS Cluster & Node Groups
    ├── elasticache/           # Redis Cluster
    ├── msk/                   # Kafka (Amazon MSK)
    ├── documentdb/            # MongoDB-compatible database
    ├── alb/                   # Application Load Balancer
    ├── ecr/                   # Container Registry
    └── security-groups/       # Security Groups
```

## 🏗️ Infrastructure Components

### Networking (VPC Module)

- VPC với CIDR 10.0.0.0/16
- 3 Public subnets (cho ALB)
- 3 Private subnets (cho EKS, databases)
- NAT Gateways cho high availability
- Internet Gateway

### Compute (EKS Module)

- EKS Cluster v1.28
- Managed Node Groups (t3.medium)
- Auto-scaling: 3-10 nodes
- IRSA (IAM Roles for Service Accounts)

### Caching (ElastiCache Module)

- Redis 7.1 cluster
- 3 nodes (1 primary + 2 replicas)
- Encryption at rest & in transit
- Automatic failover enabled

### Messaging (MSK Module)

- Apache Kafka 3.5.1
- 3 brokers across 3 AZs
- TLS encryption
- CloudWatch logging

### Database (DocumentDB Module)

- MongoDB-compatible API
- 3 instances cluster
- Automated backups (7 days retention)
- TLS encryption

### Load Balancer (ALB Module)

- Application Load Balancer
- HTTP/HTTPS listeners
- SSL/TLS termination
- Health checks

### Container Registry (ECR Module)

- Private repositories
- Image scanning enabled
- Lifecycle policies

## 🚀 Quick Start

### Prerequisites

```bash
# Install required tools
# Terraform
choco install terraform

# AWS CLI
choco install awscli

# kubectl
choco install kubernetes-cli
```

### 1. Configure AWS Credentials

```bash
aws configure
# Enter:
# - AWS Access Key ID
# - AWS Secret Access Key
# - Default region: us-east-1
# - Default output format: json
```

### 2. Create S3 Backend (First Time Only)

```bash
# Create S3 bucket for Terraform state
aws s3api create-bucket --bucket uit-go-terraform-state --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket uit-go-terraform-state \
  --versioning-configuration Status=Enabled

# Create DynamoDB table for state locking
aws dynamodb create-table \
  --table-name uit-go-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
  --region us-east-1
```

### 3. Initialize Terraform

```bash
cd terraform

# Copy example variables
cp terraform.tfvars.example terraform.tfvars

# Edit terraform.tfvars
notepad terraform.tfvars
# Update:
# - docdb_master_username
# - docdb_master_password (use strong password!)
# - acm_certificate_arn (if using HTTPS)

# Initialize
terraform init
```

### 4. Plan Infrastructure

```bash
# Review what will be created
terraform plan

# Save plan to file
terraform plan -out=tfplan
```

### 5. Apply Infrastructure

```bash
# Apply the plan
terraform apply tfplan

# Or apply directly (with confirmation)
terraform apply

# This will take ~20-30 minutes
```

### 6. Configure kubectl

```bash
# Get the command from Terraform output
terraform output configure_kubectl

# Run the command
aws eks update-kubeconfig --region us-east-1 --name uit-go-production-cluster

# Verify connection
kubectl get nodes
```

## 📊 Outputs

After successful apply, you'll get:

```bash
# View all outputs
terraform output

# Specific outputs
terraform output eks_cluster_endpoint
terraform output alb_dns_name
terraform output ecr_repository_urls
```

## 🔐 Security Best Practices

### Secrets Management

```bash
# Store sensitive outputs in AWS Secrets Manager
aws secretsmanager create-secret \
  --name uit-go/production/redis-auth-token \
  --secret-string "$(terraform output -raw elasticache_auth_token)"

aws secretsmanager create-secret \
  --name uit-go/production/docdb-password \
  --secret-string "YOUR_DOCDB_PASSWORD"
```

### Network Security

- All databases in private subnets
- Security groups with least privilege
- TLS encryption enabled for all services
- VPC Flow Logs for monitoring

## 💰 Cost Estimation

Estimated monthly costs (us-east-1):

| Service         | Configuration      | Monthly Cost    |
| --------------- | ------------------ | --------------- |
| EKS Cluster     | 1 cluster          | $73             |
| EC2 (t3.medium) | 3 nodes            | ~$100           |
| ElastiCache     | cache.t3.medium x3 | ~$120           |
| MSK             | kafka.t3.small x3  | ~$150           |
| DocumentDB      | db.t3.medium x3    | ~$350           |
| NAT Gateway     | 3 gateways         | ~$100           |
| ALB             | 1 load balancer    | ~$25            |
| Data Transfer   | Varies             | ~$50            |
| **Total**       |                    | **~$968/month** |

### Cost Optimization Tips

```hcl
# Use smaller instances for dev/staging
eks_node_groups = {
  general = {
    instance_types = ["t3.small"]  # Instead of t3.medium
    desired_size   = 2             # Instead of 3
  }
}

# Reduce database instances
docdb_instance_count = 1  # Instead of 3
redis_num_nodes     = 1  # Instead of 3
kafka_broker_count  = 1  # Instead of 3
```

## 🔄 Updates & Maintenance

### Update Infrastructure

```bash
# Pull latest changes
git pull

# Review changes
terraform plan

# Apply updates
terraform apply
```

### Scaling

```bash
# Edit terraform.tfvars
eks_node_groups = {
  general = {
    desired_size = 5  # Scale from 3 to 5
    max_size     = 15 # Increase max
  }
}

# Apply changes
terraform apply
```

## 🗑️ Cleanup

### Destroy Infrastructure

```bash
# DANGER: This will delete everything!
terraform destroy

# With auto-approve (use with caution)
terraform destroy -auto-approve
```

### Clean Up S3 Backend

```bash
# Delete DynamoDB table
aws dynamodb delete-table --table-name uit-go-terraform-locks

# Delete S3 bucket (must be empty)
aws s3 rb s3://uit-go-terraform-state --force
```

## 🐛 Troubleshooting

### Terraform State Lock

```bash
# If state is locked
terraform force-unlock <LOCK_ID>
```

### EKS Node Group Issues

```bash
# Check node group status
aws eks describe-nodegroup \
  --cluster-name uit-go-production-cluster \
  --nodegroup-name uit-go-production-cluster-general
```

### Connection Timeout

```bash
# Check security groups
aws ec2 describe-security-groups --filters "Name=vpc-id,Values=<VPC_ID>"

# Check route tables
aws ec2 describe-route-tables --filters "Name=vpc-id,Values=<VPC_ID>"
```

## 📚 Additional Resources

- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS EKS Best Practices](https://aws.github.io/aws-eks-best-practices/)
- [Terraform Best Practices](https://www.terraform-best-practices.com/)

## 🤝 Support

For issues or questions:

1. Check Terraform plan output
2. Review AWS CloudWatch logs
3. Check security group rules
4. Verify IAM permissions
