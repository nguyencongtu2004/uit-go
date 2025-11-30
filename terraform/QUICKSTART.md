# UIT-GO Terraform Quick Reference

## 🚀 Quick Commands

### Initial Setup

```bash
# Configure AWS
aws configure

# Initialize Terraform
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values
terraform init
```

### Deploy

```bash
terraform plan -out=tfplan
terraform apply tfplan
```

### Get Outputs

```bash
terraform output
terraform output -json > outputs.json
terraform output configure_kubectl
```

### Update

```bash
terraform plan
terraform apply
```

### Destroy

```bash
terraform destroy
```

## 📝 Important Variables

```hcl
# Must change
docdb_master_password = "YOUR_SECURE_PASSWORD"

# Optional
acm_certificate_arn = "arn:aws:acm:..."  # For HTTPS
```

## 🔐 Security Best Practices

1. Never commit `terraform.tfvars`
2. Use AWS Secrets Manager for sensitive data
3. Enable MFA on AWS account
4. Review security groups regularly
5. Enable CloudTrail for audit logs

## 💰 Cost Control

```bash
# Estimate costs before apply
terraform plan

# Use smaller instances for dev
instance_types = ["t3.small"]
desired_size = 2

# Set up billing alerts
aws budgets create-budget --account-id YOUR_ACCOUNT_ID ...
```

## 🐛 Troubleshooting

### State Lock

```bash
terraform force-unlock <LOCK_ID>
```

### Provider Issues

```bash
terraform init -upgrade
```

### Permission Errors

```bash
aws sts get-caller-identity
# Verify your IAM permissions
```

## 📚 Resources Created

- **VPC**: 1 VPC, 6 subnets (3 public + 3 private), 3 NAT gateways
- **EKS**: 1 cluster, 1 node group (3-10 nodes)
- **ElastiCache**: 1 Redis cluster (3 nodes)
- **MSK**: 1 Kafka cluster (3 brokers)
- **DocumentDB**: 1 cluster (3 instances)
- **ALB**: 1 Application Load Balancer
- **ECR**: 3 container repositories
- **Security Groups**: ~10 security groups
- **IAM**: ~5 roles and policies

## ⚡ Emergency Procedures

### Scale Down (Cost Saving)

```bash
# Edit terraform.tfvars
desired_size = 1
docdb_instance_count = 1
redis_num_nodes = 1
kafka_broker_count = 1

terraform apply
```

### Quick Rollback

```bash
# Revert to previous state
terraform state pull > backup.tfstate
terraform state push previous-backup.tfstate
```

### Access Emergency Resources

```bash
# Get bastion/jump host IP
aws ec2 describe-instances --filters "Name=tag:Name,Values=uit-go-bastion"

# Connect to private resources via Session Manager
aws ssm start-session --target <INSTANCE_ID>
```
