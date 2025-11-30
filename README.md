# 🚗 UIT-GO - Ride-Hailing Platform

[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://docker.com)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org)
[![Load Tested](https://img.shields.io/badge/Load%20Tested-613%20req%2Fs-brightgreen)](./test/load-tests/STRESS_TEST_REPORT.md)

Nền tảng chia sẻ chuyến đi với kiến trúc microservices, được tối ưu cho hiệu suất cao và khả năng mở rộng.

---

## 📋 Mục Lục

- [Tổng Quan](#-tổng-quan)
- [Tính Năng Chính](#-tính-năng-chính)
- [Kiến Trúc Hệ Thống](#-kiến-trúc-hệ-thống)
- [Công Nghệ](#-công-nghệ)
- [Yêu Cầu Hệ Thống](#-yêu-cầu-hệ-thống)
- [Cài Đặt Local](#-cài-đặt-local)
- [Triển Khai Kubernetes (Minikube)](#-triển-khai-kubernetes-minikube)
- [Triển Khai AWS](#-triển-khai-aws)
- [API Documentation](#-api-documentation)
- [Troubleshooting](#-troubleshooting)

---

## 🎯 Tổng Quan

UIT-GO kết nối **hành khách** với **tài xế** thông qua thuật toán matching thông minh, xây dựng với:

- ⚡ Real-time geospatial matching (Redis GEORADIUS)
- 📡 Event-driven architecture (Apache Kafka)
- 🐳 Microservices với Docker
- 🚀 Xử lý 600+ requests/second với độ trễ < 200ms

---

## ✨ Tính Năng Chính

### Hành Khách

- Đăng ký và quản lý tài khoản
- Yêu cầu chuyến đi với điểm đón/trả
- Theo dõi tài xế real-time (WebSocket)
- Hủy chuyến đi và đánh giá tài xế

### Tài Xế

- Đăng ký thông tin tài xế và xe
- Bật/tắt trạng thái online
- Nhận yêu cầu chuyến đi (15s để chấp nhận)
- Cập nhật vị trí real-time

---

## 🏗 Kiến Trúc Hệ Thống

```
┌─────────────┐         ┌──────────────┐
│  Passenger  │         │    Driver    │
│  (Mobile)   │         │   (Mobile)   │
└──────┬──────┘         └──────┬───────┘
       │                       │
       └───────────┬───────────┘
                   │
            ┌──────▼──────┐
            │   Traefik   │ (API Gateway)
            │   Port 81   │
            └──────┬──────┘
                   │
       ┌───────────┼───────────┐
       │           │           │
   ┌───▼───┐  ┌───▼────┐  ┌───▼────┐
   │ User  │  │ Driver │  │  Trip  │
   │Service│  │Service │  │Service │
   └───┬───┘  └───┬────┘  └───┬────┘
       │          │            │
   ┌───▼──────────▼────────────▼───┐
   │      Event Bus (Kafka)         │
   └────────────────────────────────┘
                   │
       ┌───────────┼───────────┐
       │           │           │
   ┌───▼────┐  ┌──▼───┐  ┌─────▼─────┐
   │MongoDB │  │Redis │  │WebSocket  │
   │ x3 DBs │  │Cache │  │Real-time  │
   └────────┘  └──────┘  └───────────┘
```

### Database Models

**User Model (uitgo_users)**

```javascript
{
  email: String (unique),
  password: String (hashed),
  profile: { firstName, lastName, phone, avatar, dateOfBirth },
  role: 'passenger' | 'driver' | 'admin',
  status: 'active' | 'inactive' | 'suspended'
}
```

**Driver Model (uitgo_drivers)**

```javascript
{
  userId: ObjectId (ref: User),
  driverInfo: { licenseNumber, licenseExpiry, rating, totalTrips },
  vehicle: { make, model, year, licensePlate, color, type },
  location: { type: 'Point', coordinates: [lng, lat] },
  status: 'online' | 'offline' | 'busy'
}
```

**Trip Model (uitgo_trips)**

```javascript
{
  passengerId: ObjectId,
  driverId: ObjectId,
  pickup: { address, location: { coordinates: [lng, lat] } },
  dropoff: { address, location: { coordinates: [lng, lat] } },
  status: 'searching' | 'accepted' | 'ongoing' | 'completed' | 'cancelled'
}
```

---

## 📦 Công Nghệ

| Loại              | Công nghệ             | Mục đích                 |
| ----------------- | --------------------- | ------------------------ |
| **Backend**       | Node.js + Express     | REST API                 |
| **Database**      | MongoDB (3 instances) | Per-service database     |
| **Cache**         | Redis Cluster         | Geospatial queries       |
| **Message Queue** | Apache Kafka          | Event streaming          |
| **API Gateway**   | Traefik v3            | Routing & load balancing |
| **Real-time**     | Socket.IO             | WebSocket                |
| **Container**     | Docker + Compose      | Orchestration            |

---

## 💻 Yêu Cầu Hệ Thống

### Local Development

- **Docker Desktop**: 20.10+ với Docker Compose V2
- **Node.js**: 18+
- **RAM**: 8GB minimum
- **CPU**: 4 cores
- **Disk**: 20GB free

### Production (AWS)

- **AWS Account** với IAM permissions
- **AWS CLI**: Version 2+
- **Terraform**: 1.0+
- **kubectl**: Latest version
- **RAM**: 16GB+
- **CPU**: 8+ cores

---

## 🚀 Cài Đặt Local

### Bước 1: Clone Repository

```bash
git clone https://github.com/nguyencongtu2004/uit-go.git
cd uit-go
```

### Bước 2: Kiểm Tra Environment Variables

Files cấu hình có sẵn trong `env/`:

```
env/
├── user-service.env
├── driver-service.env
└── trip-service.env
```

**Cấu hình mặc định đã sẵn sàng!** Chỉ cần kiểm tra nếu muốn tùy chỉnh:

```bash
# Windows
notepad env\user-service.env

# Linux/Mac
nano env/user-service.env
```

### Bước 3: Khởi Động Services

```bash
# Start tất cả services
docker compose up -d

# Xem logs
docker compose logs -f

# Kiểm tra trạng thái
docker compose ps
```

**Output mong đợi:**

```
NAME                      STATUS    PORTS
uit-go-mongodb-users      Up        0.0.0.0:27017->27017/tcp
uit-go-redis              Up        0.0.0.0:6379->6379/tcp
kafka                     Up        0.0.0.0:9092->9092/tcp
uit-go-user-service       Up
uit-go-driver-service     Up
uit-go-trip-service       Up
uit-go-traefik            Up        0.0.0.0:80,81->80,81/tcp
```

### Bước 4: Khởi Tạo Kafka Topics

```bash
node scripts/setup-kafka-topics.js
```

Topics được tạo:

- `trip.requested`
- `trip.accepted`
- `trip.completed`
- `trip.cancelled`
- `driver.location.updated`

### Bước 5: Kiểm Tra Services

```bash
# Traefik dashboard
start http://localhost:8080/dashboard/

# Health endpoints
curl http://user.localhost:81/health
curl http://driver.localhost:81/health
curl http://trip.localhost:81/health
```

**⚠️ Nếu `.localhost` không hoạt động:**

```bash
# Windows
.\test\load-tests\fix-localhost-dns.ps1

# Hoặc thêm vào C:\Windows\System32\drivers\etc\hosts:
127.0.0.1 user.localhost
127.0.0.1 driver.localhost
127.0.0.1 trip.localhost
```

### Bước 6: Tạo Dữ Liệu Test

```bash
# Windows
.\test\create-test-users.ps1

# Linux/Mac
./test/create-test-users.sh
```

Tạo:

- 10 hành khách test
- 10 tài xế test
- Authentication tokens

### Bước 7: Test API

**Sử dụng Web Simulator:**

```bash
# Mở trong browser
test/uitgo-simulator.html
```

**Hoặc sử dụng cURL:**

```bash
# 1. Đăng ký hành khách
curl -X POST http://user.localhost:81/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "passenger@test.com",
    "password": "Test1234",
    "name": "John Doe",
    "phone": "0901234567",
    "role": "passenger"
  }'

# 2. Login để lấy token
curl -X POST http://user.localhost:81/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "passenger@test.com",
    "password": "Test1234"
  }'

# 3. Yêu cầu chuyến đi
curl -X POST http://trip.localhost:81/trips \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "pickup": {
      "latitude": 10.762622,
      "longitude": 106.660172,
      "address": "UIT, Thu Duc, HCMC"
    },
    "dropoff": {
      "latitude": 10.772622,
      "longitude": 106.670172,
      "address": "District 1, HCMC"
    }
  }'
```

---

## ☸️ Triển Khai Kubernetes (Minikube)

### Yêu Cầu

- **Minikube**: 1.30+
- **kubectl**: Latest version
- **Docker Desktop** hoặc **VirtualBox**
- **RAM**: 8GB minimum cho Minikube
- **CPU**: 4 cores

### Bước 1: Cài Đặt Minikube

**Windows (PowerShell với quyền Admin):**

```powershell
# Sử dụng Chocolatey
choco install minikube kubernetes-cli

# Hoặc download installer từ
# https://minikube.sigs.k8s.io/docs/start/
```

**Linux:**

```bash
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube
```

**macOS:**

```bash
brew install minikube kubectl
```

### Bước 2: Khởi Động Minikube Cluster

```bash
# Start với cấu hình tối ưu
minikube start --cpus=4 --memory=8192 --driver=docker

# Kiểm tra trạng thái
minikube status

# Enable addons cần thiết
minikube addons enable ingress
minikube addons enable metrics-server
```

**Output mong đợi:**

```
✅ minikube v1.32.0 on Windows 11
✅ Using the docker driver
✅ Starting control plane node minikube in cluster minikube
✅ Creating docker container (CPUs=4, Memory=8192MB)
✅ Done! kubectl is now configured to use "minikube" cluster
```

### Bước 3: Build Docker Images trong Minikube

```bash
# Point Docker CLI vào Minikube's Docker daemon
# Windows PowerShell
& minikube -p minikube docker-env --shell powershell | Invoke-Expression

# Linux/Mac
eval $(minikube docker-env)

# Build images
docker build -t uit-go/user-service:local ./services/user-service
docker build -t uit-go/driver-service:local ./services/driver-service
docker build -t uit-go/trip-service:local ./services/trip-service
```

**Lưu ý:** Sau khi build, images sẽ available trong Minikube's Docker daemon.

### Bước 4: Tạo Namespace

```bash
kubectl create namespace uit-go
kubectl config set-context --current --namespace=uit-go
```

### Bước 5: Deploy Infrastructure Components

**Deploy MongoDB:**

```bash
kubectl apply -k k8s/mongodb/user/
kubectl apply -k k8s/mongodb/trip/

# Chờ pods ready
kubectl wait --for=condition=ready pod -l app=mongodb-users --timeout=300s
kubectl wait --for=condition=ready pod -l app=mongodb-trips --timeout=300s
```

**Deploy Redis:**

```bash
kubectl apply -k k8s/redis/

# Kiểm tra
kubectl wait --for=condition=ready pod -l app=redis --timeout=180s
```

**Deploy Kafka:**

```bash
kubectl apply -k k8s/kafka/

# Chờ Kafka ready (có thể mất 2-3 phút)
kubectl wait --for=condition=ready pod -l app=kafka --timeout=300s
```

### Bước 6: Khởi Tạo Kafka Topics

```bash
# Tạo topics thủ công
kubectl exec -it kafka-0 -- kafka-topics --create \
  --bootstrap-server localhost:9092 \
  --topic trip.requested \
  --partitions 3 \
  --replication-factor 1

kubectl exec -it kafka-0 -- kafka-topics --create \
  --bootstrap-server localhost:9092 \
  --topic trip.accepted \
  --partitions 3 \
  --replication-factor 1

kubectl exec -it kafka-0 -- kafka-topics --create \
  --bootstrap-server localhost:9092 \
  --topic trip.completed \
  --partitions 3 \
  --replication-factor 1

kubectl exec -it kafka-0 -- kafka-topics --create \
  --bootstrap-server localhost:9092 \
  --topic trip.cancelled \
  --partitions 3 \
  --replication-factor 1

kubectl exec -it kafka-0 -- kafka-topics --create \
  --bootstrap-server localhost:9092 \
  --topic driver.location.updated \
  --partitions 3 \
  --replication-factor 1

# Verify topics
kubectl exec -it kafka-0 -- kafka-topics --list --bootstrap-server localhost:9092
```

### Bước 7: Deploy Traefik Ingress

```bash
kubectl apply -k k8s/traefik/

# Chờ Traefik ready
kubectl wait --for=condition=ready pod -l app=traefik --timeout=180s
```

### Bước 8: Deploy Application Services

**Update image names trong deployment files:**

Đảm bảo các file `k8s/services/*/deployment.yaml` sử dụng images đã build:

```yaml
image: uit-go/user-service:local
imagePullPolicy: Never # Quan trọng: không pull từ registry
```

**Deploy services:**

```bash
# Deploy User Service
kubectl apply -k k8s/services/user/

# Deploy Trip Service
kubectl apply -k k8s/services/trip/

# Kiểm tra pods
kubectl get pods
```

**Output mong đợi:**

```
NAME                            READY   STATUS    RESTARTS   AGE
kafka-0                         1/1     Running   0          5m
mongodb-trips-0                 1/1     Running   0          4m
mongodb-users-0                 1/1     Running   0          4m
redis-7d8f9c5b6d-xxxxx         1/1     Running   0          3m
traefik-5b4f8d7c9-xxxxx        1/1     Running   0          2m
user-service-6d5c8f9b-xxxxx    1/1     Running   0          1m
trip-service-7f8d9c6a-xxxxx    1/1     Running   0          1m
```

### Bước 9: Cấu Hình Port Forwarding

**Windows PowerShell:**

```powershell
# Mở terminal mới cho mỗi port-forward

# Terminal 1 - Traefik
kubectl port-forward svc/traefik 8080:8080 8000:80

# Terminal 2 - User Service
kubectl port-forward svc/user-service 3001:3000

# Terminal 3 - Trip Service
kubectl port-forward svc/trip-service 3003:3000
```

**Linux/Mac (chạy background):**

```bash
kubectl port-forward svc/traefik 8080:8080 8000:80 &
kubectl port-forward svc/user-service 3001:3000 &
kubectl port-forward svc/trip-service 3003:3000 &
```

### Bước 10: Kiểm Tra Services

```bash
# Health checks
curl http://localhost:3001/health
curl http://localhost:3003/health

# Traefik dashboard
start http://localhost:8080/dashboard/
```

### Bước 11: Tạo Test Data

```bash
# Đăng ký hành khách
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "passenger@test.com",
    "password": "Test1234",
    "name": "John Doe",
    "phone": "0901234567",
    "role": "passenger"
  }'

# Đăng ký tài xế
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "driver@test.com",
    "password": "Test1234",
    "name": "Jane Smith",
    "phone": "0907654321",
    "role": "driver"
  }'
```

### Quản Lý Minikube

**Xem logs:**

```bash
# Service logs
kubectl logs -f deployment/user-service
kubectl logs -f deployment/trip-service

# All logs trong namespace
kubectl logs -l app=user-service --tail=100
```

**Scale services:**

```bash
# Manual scaling
kubectl scale deployment user-service --replicas=3

# Check HPA status
kubectl get hpa
```

**Restart services:**

```bash
kubectl rollout restart deployment/user-service
kubectl rollout restart deployment/trip-service
```

**Access Minikube Dashboard:**

```bash
minikube dashboard
```

**Stop và Clean Up:**

```bash
# Stop Minikube
minikube stop

# Delete cluster
minikube delete

# Clean up port-forwards (Windows)
Get-Process | Where-Object {$_.ProcessName -eq "kubectl"} | Stop-Process
```

### Troubleshooting Minikube

**Pods không start:**

```bash
# Xem pod details
kubectl describe pod <pod-name>

# Check events
kubectl get events --sort-by='.lastTimestamp'
```

**ImagePullBackOff errors:**

```bash
# Verify images trong Minikube
minikube ssh
docker images | grep uit-go

# Re-point Docker và rebuild
eval $(minikube docker-env)
docker build -t uit-go/user-service:local ./services/user-service
```

**Out of memory:**

```bash
# Increase Minikube resources
minikube delete
minikube start --cpus=6 --memory=12288
```

**Kafka connection issues:**

```bash
# Check Kafka logs
kubectl logs kafka-0

# Restart Kafka
kubectl delete pod kafka-0
kubectl wait --for=condition=ready pod kafka-0
```

---

## ☁️ Triển Khai AWS

### Tổng Quan Kiến Trúc AWS

```
┌────────────────────────────────────────┐
│          Amazon Route 53                │
│      (DNS & Health Checks)              │
└──────────────┬─────────────────────────┘
               │
┌──────────────▼─────────────────────────┐
│    Application Load Balancer (ALB)     │
│    - SSL Termination (ACM)             │
│    - Path-based Routing                │
│    - Health Checks                     │
└──────────────┬─────────────────────────┘
               │
┌──────────────▼─────────────────────────┐
│      Amazon EKS Cluster (v1.28)        │
│  ┌─────────────────────────────────┐   │
│  │  Traefik Ingress Controller     │   │
│  └───────┬─────────────────────────┘   │
│          │                              │
│  ┌───────┼─────────────────────────┐   │
│  │ User  │ Driver │ Trip  │ Pods   │   │
│  │Service│ Service│Service│(3-10)  │   │
│  └───────┴────────┴───────┴────────┘   │
│                                         │
│  Auto Scaling:                          │
│  - HPA (CPU/Memory based)              │
│  - Cluster Autoscaler                  │
└─────────────────────────────────────────┘
          │              │
┌─────────▼──────┐  ┌────▼────────┐
│  ElastiCache   │  │   Amazon    │
│  Redis 7.1     │  │   MSK 3.5   │
│  - 3 nodes     │  │  (Kafka)    │
│  - Encryption  │  │  - 3 brokers│
└────────────────┘  │  - TLS      │
          │         └─────────────┘
┌─────────▼─────────┐
│   DocumentDB 5.0  │
│  (MongoDB API)    │
│  - 3 instances    │
│  - Encrypted      │
└───────────────────┘
```

### 💰 Chi Phí Ước Tính

| Service       | Configuration      | Monthly Cost    |
| ------------- | ------------------ | --------------- |
| EKS Cluster   | 1 cluster          | $73             |
| EC2 Nodes     | 3x t3.medium       | ~$100           |
| ElastiCache   | 3x cache.t3.medium | ~$120           |
| MSK           | 3x kafka.t3.small  | ~$150           |
| DocumentDB    | 3x db.t3.medium    | ~$350           |
| NAT Gateway   | 3 gateways         | ~$100           |
| ALB           | 1 load balancer    | ~$25            |
| Data Transfer | Varies             | ~$50            |
| **Tổng**      |                    | **~$968/month** |

### 🛠️ Yêu Cầu Chuẩn Bị

**Tools cần cài đặt:**

```bash
# Windows (PowerShell Admin)
choco install terraform awscli kubernetes-cli

# Linux
sudo apt-get install terraform awscli kubectl

# macOS
brew install terraform awscli kubectl
```

**AWS Account Requirements:**

- AWS Account với IAM permissions đầy đủ
- AWS CLI configured với credentials
- Budget alert được setup (khuyến nghị)

---

## 📦 Phần 1: Triển Khai Infrastructure với Terraform

### Bước 1: Cấu Hình AWS CLI

```bash
# Configure AWS credentials
aws configure
# AWS Access Key ID: YOUR_ACCESS_KEY
# AWS Secret Access Key: YOUR_SECRET_KEY
# Default region name: us-east-1
# Default output format: json

# Verify credentials
aws sts get-caller-identity
```

### Bước 2: Tạo S3 Backend (Lần Đầu Tiên)

```bash
# Create S3 bucket for Terraform state
aws s3api create-bucket \
  --bucket uit-go-terraform-state \
  --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket uit-go-terraform-state \
  --versioning-configuration Status=Enabled

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket uit-go-terraform-state \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

# Create DynamoDB table for state locking
aws dynamodb create-table \
  --table-name uit-go-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
  --region us-east-1
```

### Bước 3: Cấu Hình Terraform Variables

```bash
cd terraform

# Copy example file
cp terraform.tfvars.example terraform.tfvars

# Edit configuration
notepad terraform.tfvars
```

**Cập nhật `terraform.tfvars`:**

```hcl
# AWS Configuration
aws_region   = "us-east-1"
project_name = "uit-go"
environment  = "production"

# VPC Configuration
vpc_cidr = "10.0.0.0/16"
availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]

# EKS Configuration
eks_cluster_version = "1.28"
eks_node_groups = {
  general = {
    desired_size   = 3
    min_size       = 3
    max_size       = 10
    instance_types = ["t3.medium"]
    capacity_type  = "ON_DEMAND"
  }
}

# DocumentDB Configuration
docdb_master_username = "uitgo_admin"
docdb_master_password = "YOUR_SUPER_SECURE_PASSWORD_HERE"  # CHANGE THIS!

# ACM Certificate (nếu có domain)
acm_certificate_arn = ""  # Leave empty for HTTP only
```

### Bước 4: Khởi Tạo Terraform

```bash
# Initialize Terraform
terraform init

# Validate configuration
terraform validate

# Format files
terraform fmt -recursive
```

**Output mong đợi:**

```
Initializing modules...
Initializing the backend...
Initializing provider plugins...
Terraform has been successfully initialized!
```

### Bước 5: Review Infrastructure Plan

```bash
# Generate and review plan
terraform plan -out=tfplan

# Save plan details to file for review
terraform show tfplan > plan.txt
```

**Review checklist:**

- ✅ VPC và subnets configuration
- ✅ EKS cluster và node groups
- ✅ Security groups rules
- ✅ Database credentials (đảm bảo secure)
- ✅ Cost estimation

### Bước 6: Apply Infrastructure

```bash
# Apply the planned infrastructure
terraform apply tfplan

# Hoặc apply trực tiếp (cần confirm)
terraform apply
```

⏱️ **Thời gian ước tính: 20-30 phút**

**Progress tracking:**

```
module.vpc.aws_vpc.main: Creating...
module.vpc.aws_internet_gateway.main: Creating...
module.eks.aws_eks_cluster.main: Creating... (15-20 mins)
module.elasticache.aws_elasticache_replication_group.redis: Creating...
module.msk.aws_msk_cluster.main: Creating... (15-20 mins)
module.documentdb.aws_docdb_cluster.main: Creating...
```

### Bước 7: Lưu Terraform Outputs

```bash
# View all outputs
terraform output

# Save important outputs
terraform output -json > terraform-outputs.json

# Get specific values
terraform output eks_cluster_endpoint
terraform output alb_dns_name
terraform output ecr_repository_urls
```

### Bước 8: Store Secrets Securely

```bash
# Store sensitive values in AWS Secrets Manager
aws secretsmanager create-secret \
  --name uit-go/production/redis-auth-token \
  --description "Redis authentication token" \
  --secret-string "$(terraform output -raw elasticache_auth_token)"

aws secretsmanager create-secret \
  --name uit-go/production/docdb-connection \
  --description "DocumentDB connection string" \
  --secret-string "mongodb://uitgo_admin:YOUR_PASSWORD@$(terraform output -raw documentdb_endpoint):27017/?tls=true"

aws secretsmanager create-secret \
  --name uit-go/production/kafka-brokers \
  --description "Kafka bootstrap brokers" \
  --secret-string "$(terraform output -raw msk_bootstrap_brokers)"
```

---

## 🚀 Phần 2: Deploy Application lên EKS

### Bước 1: Cấu Hình kubectl

```bash
# Get kubectl configuration command
terraform output configure_kubectl

# Update kubeconfig
aws eks update-kubeconfig --region us-east-1 --name uit-go-production-cluster

# Verify connection
kubectl get nodes
```

**Output mong đợi:**

```
NAME                          STATUS   ROLES    AGE   VERSION
ip-10-0-x-x.ec2.internal      Ready    <none>   5m    v1.28.x
ip-10-0-x-x.ec2.internal      Ready    <none>   5m    v1.28.x
ip-10-0-x-x.ec2.internal      Ready    <none>   5m    v1.28.x
```

### Bước 2: Build và Push Docker Images

```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $(terraform output -json ecr_repository_urls | jq -r '."uit-go/user-service"' | cut -d'/' -f1)

# Get ECR URLs
$ECR_USER = terraform output -json ecr_repository_urls | ConvertFrom-Json | Select-Object -ExpandProperty "uit-go/user-service"
$ECR_DRIVER = terraform output -json ecr_repository_urls | ConvertFrom-Json | Select-Object -ExpandProperty "uit-go/driver-service"
$ECR_TRIP = terraform output -json ecr_repository_urls | ConvertFrom-Json | Select-Object -ExpandProperty "uit-go/trip-service"

# Build and push images
docker build -t ${ECR_USER}:latest ./services/user-service
docker push ${ECR_USER}:latest

docker build -t ${ECR_DRIVER}:latest ./services/driver-service
docker push ${ECR_DRIVER}:latest

docker build -t ${ECR_TRIP}:latest ./services/trip-service
docker push ${ECR_TRIP}:latest
```

### Bước 3: Tạo Kubernetes Namespace và Secrets

```bash
# Create namespace
kubectl create namespace uit-go
kubectl config set-context --current --namespace=uit-go

# Get connection strings from Terraform
$REDIS_ENDPOINT = terraform output -raw elasticache_endpoint
$KAFKA_BROKERS = terraform output -raw msk_bootstrap_brokers
$DOCDB_ENDPOINT = terraform output -raw documentdb_endpoint

# Create secrets
kubectl create secret generic user-service-secrets `
  --from-literal=MONGODB_URI="mongodb://uitgo_admin:YOUR_PASSWORD@${DOCDB_ENDPOINT}:27017/uitgo_users?tls=true" `
  --from-literal=JWT_SECRET="$(openssl rand -base64 32)" `
  --from-literal=REDIS_HOST="${REDIS_ENDPOINT}" `
  -n uit-go

kubectl create secret generic driver-service-secrets `
  --from-literal=MONGODB_URI="mongodb://uitgo_admin:YOUR_PASSWORD@${DOCDB_ENDPOINT}:27017/uitgo_drivers?tls=true" `
  --from-literal=REDIS_HOST="${REDIS_ENDPOINT}" `
  --from-literal=KAFKA_BROKERS="${KAFKA_BROKERS}" `
  -n uit-go

kubectl create secret generic trip-service-secrets `
  --from-literal=MONGODB_URI="mongodb://uitgo_admin:YOUR_PASSWORD@${DOCDB_ENDPOINT}:27017/uitgo_trips?tls=true" `
  --from-literal=REDIS_HOST="${REDIS_ENDPOINT}" `
  --from-literal=KAFKA_BROKERS="${KAFKA_BROKERS}" `
  -n uit-go
```

### Bước 4: Update K8s Deployment Files

**Update image URLs trong các deployment files:**

```yaml
# k8s/services/user/deployment.yaml
spec:
  template:
    spec:
      containers:
        - name: user-service
          image: <YOUR_ECR_URL>/uit-go/user-service:latest
          imagePullPolicy: Always
```

**Tương tự cho driver-service và trip-service.**

### Bước 5: Deploy Infrastructure Components

```bash
# Deploy Redis
kubectl apply -k k8s/redis/

# Deploy Kafka
kubectl apply -k k8s/kafka/

# Deploy MongoDB
kubectl apply -k k8s/mongodb/user/
kubectl apply -k k8s/mongodb/trip/

# Wait for all pods
kubectl wait --for=condition=ready pod --all -n uit-go --timeout=300s
```

### Bước 6: Deploy Traefik và Application Services

```bash
# Deploy Traefik
kubectl apply -k k8s/traefik/

# Deploy User Service
kubectl apply -k k8s/services/user/

# Deploy Trip Service
kubectl apply -k k8s/services/trip/

# Check status
kubectl get deployments -n uit-go
kubectl get pods -n uit-go
kubectl get services -n uit-go
```

**Output mong đợi:**

```
NAME              READY   UP-TO-DATE   AVAILABLE   AGE
user-service      3/3     3            3           2m
trip-service      3/3     3            3           2m
traefik           1/1     1            1           3m
```

### Bước 7: Khởi Tạo Kafka Topics

```bash
# Create Kafka client pod
kubectl run kafka-client --rm -it --restart='Never' `
  --image docker.io/bitnami/kafka:3.5 `
  --namespace uit-go `
  --command -- bash

# Inside the pod, create topics:
kafka-topics.sh --create --bootstrap-server $KAFKA_BROKERS `
  --replication-factor 3 --partitions 3 `
  --topic trip.requested

kafka-topics.sh --create --bootstrap-server $KAFKA_BROKERS `
  --replication-factor 3 --partitions 3 `
  --topic trip.accepted

kafka-topics.sh --create --bootstrap-server $KAFKA_BROKERS `
  --replication-factor 3 --partitions 3 `
  --topic trip.completed

kafka-topics.sh --create --bootstrap-server $KAFKA_BROKERS `
  --replication-factor 3 --partitions 3 `
  --topic trip.cancelled

kafka-topics.sh --create --bootstrap-server $KAFKA_BROKERS `
  --replication-factor 3 --partitions 3 `
  --topic driver.location.updated

# Verify topics
kafka-topics.sh --list --bootstrap-server $KAFKA_BROKERS
```

### Bước 8: Cấu Hình Domain & SSL (Optional)

**Nếu có domain:**

```bash
# Get ALB DNS name
$ALB_DNS = terraform output -raw alb_dns_name

# Create Route 53 alias record
aws route53 change-resource-record-sets `
  --hosted-zone-id YOUR_HOSTED_ZONE_ID `
  --change-batch @"
{
  \"Changes\": [{
    \"Action\": \"CREATE\",
    \"ResourceRecordSet\": {
      \"Name\": \"api.uitgo.com\",
      \"Type\": \"A\",
      \"AliasTarget\": {
        \"HostedZoneId\": \"Z35SXDOTRQ7X7K\",
        \"DNSName\": \"$ALB_DNS\",
        \"EvaluateTargetHealth\": false
      }
    }
  }]
}
"@
```

**Request SSL Certificate:**

```bash
# Request certificate from ACM
aws acm request-certificate `
  --domain-name api.uitgo.com `
  --validation-method DNS `
  --region us-east-1

# Sau khi verify, update terraform.tfvars với certificate ARN
# Chạy terraform apply lại để update ALB listener
```

### Bước 9: Configure Auto-Scaling

```bash
# HPA (Horizontal Pod Autoscaler) đã được cấu hình trong k8s/services/*/hpa.yaml
# Verify HPA status
kubectl get hpa -n uit-go

# Install Cluster Autoscaler
kubectl apply -f https://raw.githubusercontent.com/kubernetes/autoscaler/master/cluster-autoscaler/cloudprovider/aws/examples/cluster-autoscaler-autodiscover.yaml

# Update cluster-autoscaler deployment
kubectl -n kube-system annotate deployment.apps/cluster-autoscaler cluster-autoscaler.kubernetes.io/safe-to-evict="false"

kubectl -n kube-system set image deployment.apps/cluster-autoscaler `
  cluster-autoscaler=k8s.gcr.io/autoscaling/cluster-autoscaler:v1.28.0
```

**Auto-scaling rules:**

- Scale up: CPU > 70% hoặc Memory > 80%
- Scale down: CPU < 30% và Memory < 50%
- Min pods: 3 per service
- Max pods: 10 per service

### Bước 10: Kiểm Tra Production

```bash
# Get ALB DNS or domain
$API_URL = terraform output -raw alb_dns_name
# Hoặc nếu đã cấu hình domain: $API_URL = "api.uitgo.com"

# Kiểm tra health endpoints
curl http://${API_URL}/health

# Test với application endpoints
curl -X POST http://${API_URL}/auth/register `
  -H "Content-Type: application/json" `
  -d '{
    "email": "test@uitgo.com",
    "password": "Test1234",
    "name": "Test User",
    "phone": "0901234567",
    "role": "passenger"
  }'

# Xem logs
kubectl logs -f deployment/user-service -n uit-go
kubectl logs -f deployment/trip-service -n uit-go

# Monitor pods
kubectl top pods -n uit-go
kubectl get pods -n uit-go --watch
```

---

## 📊 So Sánh Các Môi Trường Triển Khai

| Tính năng             | Docker Compose | Minikube          | AWS EKS           |
| --------------------- | -------------- | ----------------- | ----------------- |
| **Setup Time**        | < 5 phút       | 15-20 phút        | 30-45 phút        |
| **Complexity**        | ⭐             | ⭐⭐⭐            | ⭐⭐⭐⭐⭐        |
| **Resource Usage**    | 4GB RAM        | 8GB RAM           | Tùy chỉnh         |
| **Cost**              | Free           | Free              | ~$968/month       |
| **Auto-Scaling**      | ❌             | ✅ (HPA)          | ✅ (HPA + CA)     |
| **Load Balancing**    | Traefik        | Traefik + Ingress | ALB + Traefik     |
| **High Availability** | ❌             | ❌                | ✅                |
| **Production Ready**  | ❌             | ❌                | ✅                |
| **Use Case**          | Local dev      | K8s learning      | Production        |
| **Backup/Recovery**   | Manual         | Manual            | Automated         |
| **Monitoring**        | Basic logs     | Basic metrics     | CloudWatch + logs |
| **SSL/TLS**           | Self-signed    | Self-signed       | ACM Certificates  |

---

## 🔧 Quản Lý và Bảo Trì AWS Infrastructure

### Monitoring và Logging

```bash
# View CloudWatch logs
aws logs tail /aws/eks/uit-go-production-cluster/cluster --follow

# View MSK metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Kafka \
  --metric-name BytesInPerSec \
  --dimensions Name=Cluster Name,Value=uit-go-production-msk \
  --statistics Average \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300

# View ElastiCache metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ElastiCache \
  --metric-name CPUUtilization \
  --dimensions Name=CacheClusterId,Value=uit-go-production-redis-001 \
  --statistics Average \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300
```

### Backup và Recovery

```bash
# Create DocumentDB snapshot
aws docdb create-db-cluster-snapshot \
  --db-cluster-snapshot-identifier uit-go-manual-backup-$(date +%Y%m%d) \
  --db-cluster-identifier uit-go-production-docdb

# List snapshots
aws docdb describe-db-cluster-snapshots \
  --db-cluster-identifier uit-go-production-docdb

# Restore from snapshot (if needed)
aws docdb restore-db-cluster-from-snapshot \
  --db-cluster-identifier uit-go-restored \
  --snapshot-identifier <SNAPSHOT_ID> \
  --engine docdb
```

### Scaling Operations

```bash
# Scale EKS node group
aws eks update-nodegroup-config \
  --cluster-name uit-go-production-cluster \
  --nodegroup-name uit-go-production-cluster-general \
  --scaling-config minSize=5,maxSize=15,desiredSize=5

# Scale application deployments
kubectl scale deployment user-service --replicas=5 -n uit-go

# Update node instance type (via Terraform)
# Edit terraform.tfvars:
eks_node_groups = {
  general = {
    instance_types = ["t3.large"]  # Upgrade from t3.medium
  }
}
# Run: terraform apply
```

### Update Infrastructure

```bash
# Pull latest Terraform changes
git pull

# Review changes
terraform plan

# Apply updates
terraform apply

# Update kubectl config if cluster changed
aws eks update-kubeconfig --region us-east-1 --name uit-go-production-cluster
```

### Cost Optimization

```bash
# Check current costs
aws ce get-cost-and-usage \
  --time-period Start=$(date -d '1 month ago' +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE

# Stop non-production resources (staging/dev)
# Scale down to smaller instances
# Use Spot instances for non-critical workloads
```

### Cleanup và Destroy

```bash
# CẢNH BÁO: Thao tác này sẽ XÓA toàn bộ infrastructure!

# Delete Kubernetes resources first
kubectl delete namespace uit-go

# Destroy Terraform infrastructure
cd terraform
terraform destroy

# Confirm deletion
# Type: yes

# Clean up S3 backend
aws s3 rm s3://uit-go-terraform-state --recursive
aws s3 rb s3://uit-go-terraform-state

# Delete DynamoDB table
aws dynamodb delete-table --table-name uit-go-terraform-locks
```

---

## 📚 API Documentation

### Service Endpoints

| Service    | Local URL                  | AWS URL                              | Docs                                            |
| ---------- | -------------------------- | ------------------------------------ | ----------------------------------------------- |
| **User**   | http://user.localhost:81   | https://api.uitgo.com/user-service   | [Guide](./services/user-service/API_GUIDE.md)   |
| **Driver** | http://driver.localhost:81 | https://api.uitgo.com/driver-service | [Guide](./services/driver-service/API_GUIDE.md) |
| **Trip**   | http://trip.localhost:81   | https://api.uitgo.com/trip-service   | [Guide](./services/trip-service/API_GUIDE.md)   |

### API Examples

**1. User Registration**

```bash
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123",
  "name": "John Doe",
  "phone": "0901234567",
  "role": "passenger"
}
```

**2. Driver Location Update**

```bash
POST /location/update
Authorization: Bearer <token>
Content-Type: application/json

{
  "latitude": 10.762622,
  "longitude": 106.660172
}
```

**3. Trip Booking**

```bash
POST /trips
Authorization: Bearer <token>
Content-Type: application/json

{
  "pickup": {
    "latitude": 10.762622,
    "longitude": 106.660172,
    "address": "UIT, HCMC"
  },
  "dropoff": {
    "latitude": 10.772622,
    "longitude": 106.670172,
    "address": "District 1, HCMC"
  }
}
```

---

## 🔧 Troubleshooting

### Services Không Khởi Động

```bash
# Kiểm tra port conflicts
netstat -ano | findstr :27017
netstat -ano | findstr :6379

# Restart services
docker compose down
docker compose up -d
```

### Không Kết Nối Được `.localhost`

```bash
# Windows - Run DNS fix
.\test\load-tests\fix-localhost-dns.ps1

# Hoặc thêm vào hosts file:
# C:\Windows\System32\drivers\etc\hosts
127.0.0.1 user.localhost
127.0.0.1 driver.localhost
127.0.0.1 trip.localhost
```

### Kafka Topics Không Tồn Tại

```bash
# Tạo topics thủ công
node scripts/setup-kafka-topics.js

# Kiểm tra Kafka logs
docker logs kafka
```

### MongoDB Connection Refused

```bash
# Kiểm tra MongoDB status
docker compose ps

# Xem MongoDB logs
docker logs uit-go-mongodb-users

# Restart MongoDB
docker compose restart mongodb-users
```

### JWT Token Expired

```bash
# Login lại để lấy token mới
curl -X POST http://user.localhost:81/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","password":"Test1234"}'
```

### Performance Issues

```bash
# Kiểm tra resource usage
docker stats

# Xem service logs
docker compose logs -f user-service

# Kiểm tra Redis
docker exec -it uit-go-redis redis-cli -a redis123 ping
```

### Minikube Issues

**Cluster không start:**

```bash
# Windows: Chuyển driver
minikube start --driver=hyperv
# hoặc
minikube start --driver=virtualbox

# Linux: Kiểm tra Docker
sudo systemctl status docker
```

**Pods pending/stuck:**

```bash
# Xem resource usage
kubectl top nodes
kubectl top pods

# Increase resources
minikube delete
minikube start --cpus=6 --memory=12288
```

**Connection từ host vào Minikube:**

```bash
# Sử dụng minikube service
minikube service user-service --url

# Hoặc tunnel (cần quyền admin)
minikube tunnel
```

---

## 📞 Contact

- **Project**: UIT-Go Ride-Hailing Platform
- **University**: University of Information Technology (UIT)
- **GitHub**: [@nguyencongtu2004](https://github.com/nguyencongtu2004)
- **Repository**: [uit-go](https://github.com/nguyencongtu2004/uit-go)

---

## 📄 License

Licensed under the ISC License. See [LICENSE](LICENSE) for details.

---

**Made with ❤️ by UIT Students**
