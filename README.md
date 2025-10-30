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

## ☁️ Triển Khai AWS

### Kiến Trúc AWS

```
┌────────────────────────────────────────┐
│          Amazon Route 53                │
│      (DNS & Health Checks)              │
└──────────────┬─────────────────────────┘
               │
┌──────────────▼─────────────────────────┐
│    Application Load Balancer (ALB)     │
│    - SSL Termination                   │
│    - Path-based Routing                │
└──────────────┬─────────────────────────┘
               │
┌──────────────▼─────────────────────────┐
│      Amazon EKS Cluster                │
│  ┌─────────────────────────────────┐   │
│  │  Traefik Ingress Controller     │   │
│  └───────┬─────────────────────────┘   │
│          │                              │
│  ┌───────┼─────────────────────────┐   │
│  │ User  │ Driver │ Trip  │ Pods   │   │
│  │Service│ Service│Service│(Auto)  │   │
│  └───────┴────────┴───────┴────────┘   │
└─────────────────────────────────────────┘
          │              │
┌─────────▼──────┐  ┌────▼────────┐
│  ElastiCache   │  │   Amazon    │
│    (Redis)     │  │   MSK       │
└────────────────┘  │  (Kafka)    │
          │         └─────────────┘
┌─────────▼─────────┐
│   Amazon          │
│   DocumentDB      │
│   (MongoDB API)   │
└───────────────────┘
```

### Bước 1: Chuẩn Bị Infrastructure

```bash
cd infrastructure/terraform

# Khởi tạo Terraform
terraform init

# Xem kế hoạch
terraform plan

# Triển khai
terraform apply
```

**Resources được tạo:**

- VPC với public/private subnets
- EKS cluster với managed node groups
- ElastiCache Redis cluster
- Amazon MSK (Kafka)
- DocumentDB (MongoDB-compatible)
- Application Load Balancer
- Security groups & IAM roles

### Bước 2: Cấu Hình kubectl

```bash
# Update kubeconfig
aws eks update-kubeconfig --region us-east-1 --name uit-go-cluster

# Kiểm tra kết nối
kubectl get nodes
```

### Bước 3: Deploy Secrets

```bash
# Tạo namespace
kubectl create namespace uit-go

# Tạo secrets
kubectl create secret generic user-service-secrets \
  --from-env-file=env/user-service.env \
  -n uit-go

kubectl create secret generic driver-service-secrets \
  --from-env-file=env/driver-service.env \
  -n uit-go

kubectl create secret generic trip-service-secrets \
  --from-env-file=env/trip-service.env \
  -n uit-go
```

### Bước 4: Deploy Applications

```bash
# Deploy tất cả services
kubectl apply -f infrastructure/k8s/

# Kiểm tra trạng thái
kubectl get deployments -n uit-go
kubectl get pods -n uit-go
kubectl get services -n uit-go
```

### Bước 5: Cấu Hình Domain & SSL

```bash
# Lấy ALB DNS name
kubectl get ingress -n uit-go

# Tạo Route 53 alias record trỏ đến ALB
# Example: api.uitgo.com -> ALB DNS name

# SSL certificates tự động provisioned qua ACM
```

### Bước 6: Khởi Tạo Database & Kafka

```bash
# Chạy initialization jobs
kubectl apply -f infrastructure/k8s/jobs/init-kafka-topics.yaml
kubectl apply -f infrastructure/k8s/jobs/init-db-indexes.yaml

# Kiểm tra job status
kubectl get jobs -n uit-go
```

### Bước 7: Kiểm Tra Production

```bash
# Kiểm tra API health
curl https://api.uitgo.com/user-service/health
curl https://api.uitgo.com/driver-service/health
curl https://api.uitgo.com/trip-service/health

# Xem logs
kubectl logs -f deployment/user-service -n uit-go
```

### Bước 8: Cấu Hình Auto-Scaling

```bash
# Enable cluster autoscaler
kubectl apply -f infrastructure/k8s/autoscaling/cluster-autoscaler.yaml

# Configure HPA
kubectl apply -f infrastructure/k8s/autoscaling/hpa-user-service.yaml
kubectl apply -f infrastructure/k8s/autoscaling/hpa-driver-service.yaml
kubectl apply -f infrastructure/k8s/autoscaling/hpa-trip-service.yaml
```

**Auto-scaling rules:**

- Scale up: CPU > 70% hoặc Memory > 80%
- Scale down: CPU < 30% và Memory < 50%
- Min pods: 3 per service
- Max pods: 20 per service

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
