# 🚗 UIT-GO - Ride-Hailing Platform# UIT-Go - Ride Sharing Microservices Platform

**UIT-GO** is a high-performance, event-driven ride-hailing platform built with microservices architecture. Designed for scalability and real-time responsiveness, optimized for stress testing and Proof of Concept (PoC) validation.[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://docker.com)

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org)

[![Architecture](https://img.shields.io/badge/Architecture-Microservices-blue)](./ARCHITECTURE.md)[![Express](https://img.shields.io/badge/Express-4.x-lightgrey.svg)](https://expressjs.com)

[![Tech Stack](https://img.shields.io/badge/Stack-Node.js%20%7C%20MongoDB%20%7C%20Redis%20%7C%20Kafka-green)]()[![License](https://img.shields.io/badge/License-ISC-yellow.svg)](LICENSE)

[![Load Tested](https://img.shields.io/badge/Load%20Tested-613%20req%2Fs-brightgreen)](./test/load-tests/STRESS_TEST_REPORT.md)

UIT-Go là một nền tảng chia sẻ chuyến đi được xây dựng với kiến trúc microservices, sử dụng Node.js, Express, Docker và các công nghệ hiện đại khác.

---

## 🏗️ Kiến trúc hệ thống

## 📋 Table of Contents

### Microservices Architecture với Traefik Reverse Proxy

- [Overview](#-overview)

- [Key Features](#-key-features)```

- [Architecture](#-architecture) ┌─────────────────┐

- [Tech Stack](#-tech-stack) │ Traefik │ ← Port 80/443 (HTTP/HTTPS)

- [Prerequisites](#-prerequisites) │ Reverse Proxy │ ← Port 8080 (Dashboard)

- [Getting Started - Local Development](#-getting-started---local-development) │ Load Balancer │

- [Getting Started - AWS Deployment](#-getting-started---aws-deployment) └─────────┬───────┘

- [API Documentation](#-api-documentation) │

- [Load Testing](#-load-testing) ┌─────────────┼─────────────┐

- [Project Structure](#-project-structure) │ │ │

- [Troubleshooting](#-troubleshooting) ┌───▼───┐ ┌───▼────┐ ┌───▼────┐

- [Contributing](#-contributing) │ User │ │ Driver │ │ Trip │

            │Service│     │Service │    │Service │

--- │:3000 │ │ :3000 │ │ :3000 │

            └───┬───┘     └────┬───┘    └────┬───┘

## 🎯 Overview │ │ │

            ┌───▼───┐     ┌────▼────┐   ┌────▼───┐

UIT-GO is a ride-hailing application that connects **passengers** with **drivers** through an intelligent matching algorithm. Built as a PoC to demonstrate: │MongoDB│ │ MongoDB │ │MongoDB │

            │Users  │     │ Drivers │   │ Trips  │

- **Real-time geospatial matching** using Redis GEORADIUS │:27017 │ │ :27018 │ │ :27019 │

- **Event-driven architecture** with Apache Kafka └───────┘ └─────────┘ └────────┘

- **Microservices scalability** with Docker and Kubernetes-ready setup │

- **High performance** handling 600+ requests/second with sub-200ms latency Docker Network

````

### Business Flows

### Services Overview

1. **Passenger**: Register → Request trip → Track driver → Complete trip → Rate driver

2. **Driver**: Register → Go online → Accept trip requests → Complete trips → Earn revenue| Service            | Internal Port | External Access | Database        | Chức năng                     |

| ------------------ | ------------- | --------------- | --------------- | ----------------------------- |

---| **Traefik Proxy**  | 80, 443, 8080 | ✓               | -               | Reverse Proxy & Load Balancer |

| **User Service**   | 3000          | via Traefik     | MongoDB Users   | Quản lý người dùng & xác thực |

## ✨ Key Features| **Driver Service** | 3000          | via Traefik     | MongoDB Drivers | Quản lý tài xế & vị trí       |

| **Trip Service**   | 3000          | via Traefik     | MongoDB Trips   | Quản lý chuyến đi & đặt xe    |

### For Passengers

- ✅ Account management (register, login)### Traefik Routing Configuration

- ✅ Request rides with pickup/drop-off locations

- ✅ Real-time driver tracking via WebSocket| Subdomain Pattern  | Target Service | Routes        | Middleware Applied         |

- ✅ Trip cancellation before pickup| ------------------ | -------------- | ------------- | -------------------------- |

- ✅ Driver rating system (1-5 stars)| `user.localhost`   | user-service   | `/auth/*`     | CORS, Security, Rate Limit |

| `user.localhost`   | user-service   | `/users/*`    | CORS, Security, Rate Limit |

### For Drivers| `driver.localhost` | driver-service | `/drivers/*`  | CORS, Security, Rate Limit |

- ✅ Driver profile and vehicle registration| `driver.localhost` | driver-service | `/location/*` | CORS, Security, Rate Limit |

- ✅ Online/offline status management| `trip.localhost`   | trip-service   | `/trips/*`    | CORS, Security, Rate Limit |

- ✅ Receive trip requests (15s acceptance window)| `trip.localhost`   | trip-service   | `/booking/*`  | CORS, Security, Rate Limit |

- ✅ Real-time location updates (GPS tracking)

- ✅ Trip completion and earnings tracking### Database Architecture



### Technical Highlights| Database Container  | Port  | Database Name | Chức năng                   |

- 🚀 **Sub-10ms geospatial queries** using Redis| ------------------- | ----- | ------------- | --------------------------- |

- 📡 **Real-time notifications** via WebSocket| **mongodb-users**   | 27017 | uitgo_users   | User data & authentication  |

- 🔄 **Event sourcing** with Kafka for auditability| **mongodb-drivers** | 27018 | uitgo_drivers | Driver data & geolocation   |

- 📊 **Load tested** up to 500 concurrent users| **mongodb-trips**   | 27019 | uitgo_trips   | Trip data & booking history |

- 🔐 **JWT authentication** for secure API access

- 🌐 **API Gateway** with Traefik for routing and load balancing### Database Models & Schemas



---#### User Model (uitgo_users)



## 🏗 Architecture```javascript

{

```  _id: ObjectId,

┌─────────────┐         ┌──────────────┐  email: String (unique, required),

│  Passenger  │         │    Driver    │  password: String (hashed, required),

│  (Mobile)   │         │   (Mobile)   │  profile: {

└──────┬──────┘         └──────┬───────┘    firstName: String (required),

       │                       │    lastName: String (required),

       └───────────┬───────────┘    phone: String (unique, required),

                   │    avatar: String,

            ┌──────▼──────┐    dateOfBirth: Date

            │   Traefik   │ (API Gateway + Load Balancer)  },

            │   Port 81   │  role: String (enum: ['passenger', 'driver', 'admin'], default: 'passenger'),

            └──────┬──────┘  status: String (enum: ['active', 'inactive', 'suspended'], default: 'active'),

                   │  preferences: {

       ┌───────────┼───────────┐    language: String (default: 'vi'),

       │           │           │    notifications: Boolean (default: true)

   ┌───▼───┐  ┌───▼────┐  ┌───▼────┐  },

   │ User  │  │ Driver │  │  Trip  │  createdAt: Date,

   │Service│  │Service │  │Service │  updatedAt: Date

   └───┬───┘  └───┬────┘  └───┬────┘}

       │          │            │```

   ┌───▼──────────▼────────────▼───┐

   │      Event Bus (Kafka)         │#### Driver Model (uitgo_drivers)

   │   - trip.requested             │

   │   - trip.accepted              │```javascript

   │   - trip.completed             │{

   └────────────────────────────────┘  _id: ObjectId,

                   │  userId: ObjectId (ref: 'User', required),

       ┌───────────┼───────────┐  driverInfo: {

       │           │           │    licenseNumber: String (unique, required),

   ┌───▼────┐  ┌──▼───┐  ┌────▼─────┐    licenseExpiry: Date (required),

   │MongoDB │  │Redis │  │WebSocket │    experience: Number,

   │ x3 DBs │  │Cache │  │Real-time │    rating: Number (default: 5.0),

   └────────┘  └──────┘  └──────────┘    totalTrips: Number (default: 0)

```  },

  vehicle: {

**See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture documentation.**    make: String (required),

    model: String (required),

---    year: Number (required),

    licensePlate: String (unique, required),

## 🛠 Tech Stack    color: String (required),

    type: String (enum: ['bike', 'car'], required)

| Category | Technology | Purpose |  },

|----------|-----------|---------|  location: {

| **Backend** | Node.js + Express.js | Non-blocking I/O for real-time apps |    type: String (default: 'Point'),

| **Databases** | MongoDB (3 instances) | Per-service database pattern |    coordinates: [Number] // [longitude, latitude]

| **Cache** | Redis Cluster | Geospatial queries (GEORADIUS) |  },

| **Message Queue** | Apache Kafka (KRaft) | Event streaming & fault tolerance |  status: String (enum: ['online', 'offline', 'busy'], default: 'offline'),

| **API Gateway** | Traefik v3 | Routing, load balancing, SSL |  documents: {

| **Real-time** | Socket.IO | WebSocket for live updates |    avatar: String,

| **Containerization** | Docker + Docker Compose | Consistent environments |    licensePhoto: String,

| **Orchestration** | Kubernetes (EKS for AWS) | Auto-scaling & self-healing |    vehiclePhoto: String

| **Load Testing** | k6 | Performance validation |  },

| **Authentication** | JWT | Stateless auth tokens |  createdAt: Date,

  updatedAt: Date

**See [ADR/](./ADR/) for technology decision records.**}

````

---

#### Trip Model (uitgo_trips)

## 📦 Prerequisites

````javascript

### For Local Development{

  _id: ObjectId,

- **Docker Desktop**: Version 20.10+ with Docker Compose V2  passengerId: ObjectId (ref: 'User', required),

  ```powershell  driverId: ObjectId (ref: 'Driver'),

  docker --version  # Should be 20.10+  pickup: {

  docker compose version  # Should be v2.x    address: String (required),

  ```    location: {

      type: String (default: 'Point'),

- **Node.js**: Version 18+ (for local testing scripts)      coordinates: [Number] // [longitude, latitude]

  ```powershell    }

  node --version  # Should be v18+  },

  npm --version  destination: {

  ```    address: String (required),

    location: {

- **Git**: For cloning the repository      type: String (default: 'Point'),

  ```powershell      coordinates: [Number]

  git --version    }

  ```  },

  status: String (enum: ['searching', 'accepted', 'ongoing', 'completed', 'cancelled']),

- **Optional - k6**: For load testing  pricing: {

  ```powershell    baseFare: Number,

  choco install k6  # Windows    distanceFare: Number,

  # or download from https://k6.io/docs/getting-started/installation/    timeFare: Number,

  ```    totalFare: Number,

    paymentMethod: String (enum: ['cash', 'card', 'wallet'])

### For AWS Deployment  },

  timeline: {

- **AWS Account** with appropriate permissions    requestedAt: Date (required),

- **AWS CLI**: Version 2+    acceptedAt: Date,

  ```powershell    startedAt: Date,

  aws --version    completedAt: Date

  aws configure  # Set credentials  },

  ```  route: {

    distance: Number, // in meters

- **Terraform**: Version 1.0+ (for Infrastructure as Code)    duration: Number, // in seconds

  ```powershell    polyline: String

  terraform --version  },

  ```  createdAt: Date,

  updatedAt: Date

- **kubectl**: For Kubernetes management}

  ```powershell```

  kubectl version --client

  ```## 🚀 Quick Start



### System Requirements### Prerequisites



| Requirement | Local Development | Production (AWS) |- [Docker](https://docker.com) & Docker Compose

|-------------|------------------|------------------|- [Node.js](https://nodejs.org) 18+ (for local development)

| **RAM** | 8GB minimum | 16GB+ recommended |- Git

| **CPU** | 4 cores | 8+ cores |

| **Disk** | 20GB free | 100GB+ |### Installation & Setup

| **OS** | Windows/macOS/Linux | Linux (EKS) |

1. **Clone repository**

---

```bash

## 🚀 Getting Started - Local Developmentgit clone <repository-url>

cd uit-go

### Step 1: Clone the Repository```



```powershell2. **Start với Docker Compose**

git clone https://github.com/nguyencongtu2004/uit-go.git

cd uit-go```bash

```# Build và start tất cả services

docker compose up --build

### Step 2: Configure Environment Variables

# Hoặc chạy background

The repository includes pre-configured `.env` files in the `env/` directory:docker compose up --build -d



```# Sử dụng management script (Windows)

env/.\manage.ps1 start

├── user-service.env

├── driver-service.env# Sử dụng management script (Linux/Mac)

└── trip-service.env./manage.sh start

````

**Default configuration works out of the box** for local development. To customize:### Verify installation

`powershell`bash

# Example: Edit user service configuration# Check Traefik dashboard

notepad env\user-service.envcurl http://localhost:8080/ping

````

# Check API endpoints via subdomain routing

**Key variables to review:**curl http://user.localhost/users

curl http://user.localhost/auth

```bashcurl http://driver.localhost/drivers

# Database (MongoDB)curl http://driver.localhost/location

DB_URI=mongodb://admin:uitgo123@mongodb-users:27017/uitgo_users?authSource=admincurl http://trip.localhost/trips

curl http://trip.localhost/booking

# Cache (Redis)```

REDIS_HOST=redis

REDIS_PORT=6379### Access Points

REDIS_PASSWORD=redis123

- **Main API**:

# Message Queue (Kafka)  - User Service: http://user.localhost (via Traefik)

KAFKA_BROKERS=kafka:9092  - Driver Service: http://driver.localhost (via Traefik)

  - Trip Service: http://trip.localhost (via Traefik)

# JWT Authentication- **Traefik Dashboard**: http://localhost:8080

JWT_SECRET=your-secret-key-change-in-production- **MongoDB Users**: localhost:27017

JWT_EXPIRES_IN=7d- **MongoDB Drivers**: localhost:27018

```- **MongoDB Trips**: localhost:27019



### Step 3: Start Services### Environment Variables



```powershellProject sử dụng environment files cho từng service:

# Start all services in detached mode

docker compose up -d```

env/

# View logs├── traefik.env          # Traefik configuration

docker compose logs -f├── user-service.env     # User service config

├── driver-service.env   # Driver service config

# Check service health└── trip-service.env     # Trip service config

docker compose ps```

````

## 📋 API Documentation

**Expected output:**

### Access via Traefik Subdomain Routing

````

NAME                      STATUS    PORTSAll API endpoints are now accessible through Traefik reverse proxy using subdomain patterns. Each service has its own subdomain and simplified routing:

uit-go-mongodb-users      Up        0.0.0.0:27017->27017/tcp

uit-go-mongodb-drivers    Up        0.0.0.0:27018->27017/tcp- **User Service**: `http://user.localhost` - User management & authentication

uit-go-mongodb-trips      Up        0.0.0.0:27019->27017/tcp- **Driver Service**: `http://driver.localhost` - Driver management & location services

uit-go-redis              Up        0.0.0.0:6379->6379/tcp- **Trip Service**: `http://trip.localhost` - Trip management & booking services

kafka                     Up        0.0.0.0:9092,9093,9094->9092,9093,9094/tcp

uit-go-user-service       Up#### Traefik Dashboard

uit-go-driver-service     Up

uit-go-trip-service       Up```http

uit-go-traefik            Up        0.0.0.0:80->80/tcp, 0.0.0.0:81->81/tcpGET http://localhost:8080

````

### Step 4: Initialize Kafka TopicsAccess the Traefik dashboard to monitor services, routes, and health status.

````powershell#### Health Check

# Run topic setup script

node scripts/setup-kafka-topics.js```http

```GET http://localhost:8080/ping

````

**Expected topics created:**

- `trip.requested`### User Service

- `trip.accepted`

- `trip.completed`Base URL: `http://user.localhost`

- `trip.cancelled`

- `driver.location.updated`#### Get Users

### Step 5: Verify Services```http

GET http://user.localhost/users

`powershell`

# Check Traefik dashboard

start http://localhost:8080/dashboard/**Response:**

# Test health endpoints```json

curl http://user.localhost:81/health{

curl http://driver.localhost:81/health "message": "User Service - Users endpoint",

curl http://trip.localhost:81/health "service": "user-service",

````"database": "uitgo_users",

  "count": 0,

**Note:** If `.localhost` domains don't work, run the DNS fix:  "users": []

}

```powershell```

.\test\load-tests\fix-localhost-dns.ps1

```#### Authentication



### Step 6: Create Test Data```http

GET http://user.localhost/auth

```powershell```

# Create test users and drivers

.\test\create-test-users.ps1**Response:**



# Or run full demo setup```json

.\test\demo-test-data.ps1{

```  "message": "User Service - Auth endpoint",

  "service": "user-service",

This creates:  "endpoints": ["login", "register", "refresh"]

- 10 test passengers}

- 10 test drivers```

- Sample authentication tokens

### Driver Service

### Step 7: Test the System

Base URL: `http://driver.localhost`

**Option A: Use the Web Simulator**

#### Get Drivers

Open `test/uitgo-simulator.html` in a browser for an interactive UI.

```http

**Option B: Use cURL/Postman**GET http://driver.localhost/drivers

````

`````powershell

# 1. Register a passenger**Response:**

curl -X POST http://user.localhost:81/auth/register `

  -H "Content-Type: application/json" ````json

  -d '{{

    "email": "passenger@test.com",  "message": "Driver Service - Drivers endpoint",

    "password": "Test1234",  "service": "driver-service",

    "name": "John Doe",  "database": "uitgo_drivers",

    "phone": "0901234567",  "count": 0,

    "role": "passenger"  "drivers": []

  }'}

`````

# 2. Login to get token

curl -X POST http://user.localhost:81/auth/login `#### Location Services

-H "Content-Type: application/json" `

-d '{```http

    "email": "passenger@test.com",GET http://driver.localhost/location

    "password": "Test1234"```

}'

**Response:**

# 3. Request a trip (use token from login)

curl -X POST http://trip.localhost:81/trips ````json

-H "Content-Type: application/json" `{

-H "Authorization: Bearer YOUR_TOKEN_HERE" ` "message": "Driver Service - Location endpoint",

-d '{ "service": "driver-service",

    "pickup": {  "endpoints": ["update", "track", "nearby"]

      "latitude": 10.762622,}

      "longitude": 106.660172,```

      "address": "UIT, Thu Duc, HCMC"

    },### Trip Service

    "dropoff": {

      "latitude": 10.772622,Base URL: `http://trip.localhost`

      "longitude": 106.670172,

      "address": "District 1, HCMC"#### Get Trips

    }

}'```http

```GET http://trip.localhost/trips

```

**See [API_GUIDE.md](./services/user-service/API_GUIDE.md) for complete API documentation.**

**Response:**

---

````json

## ☁️ Getting Started - AWS Deployment{

  "message": "Trip Service - Trips endpoint",

### Architecture Overview (AWS)  "service": "trip-service",

  "trips": [

```    {

┌─────────────────────────────────────────┐      "id": 1,

│          Amazon Route 53                │      "passenger": "User 1",

│      (DNS & Health Checks)              │      "driver": "Driver 1",

└──────────────┬──────────────────────────┘      "status": "completed"

               │    },

┌──────────────▼──────────────────────────┐    {

│    Application Load Balancer (ALB)      │      "id": 2,

│    - SSL Termination                    │      "passenger": "User 2",

│    - Path-based Routing                 │      "driver": "Driver 2",

└──────────────┬──────────────────────────┘      "status": "ongoing"

               │    }

┌──────────────▼──────────────────────────┐  ]

│      Amazon EKS Cluster                 │}

│  ┌─────────────────────────────────┐   │```

│  │  Traefik Ingress Controller     │   │

│  └───────┬─────────────────────────┘   │#### Booking Services

│          │                              │

│  ┌───────┼─────────────────────────┐   │```http

│  │ User  │ Driver │ Trip  │ Pods   │   │GET http://trip.localhost/booking

│  │Service│ Service│Service│ (Auto  │   │```

│  │       │        │       │Scaling)│   │

│  └───────┴────────┴───────┴────────┘   │**Response:**

└─────────────────────────────────────────┘

          │              │```json

┌─────────▼───┐  ┌──────▼──────┐{

│  Amazon     │  │   Amazon    │  "message": "Trip Service - Booking endpoint",

│  ElastiCache│  │   MSK       │  "service": "trip-service",

│  (Redis)    │  │   (Kafka)   │  "endpoints": ["create", "cancel", "status"]

└─────────────┘  └─────────────┘}

          │```

┌─────────▼───────┐

│   Amazon        │## 🛠️ Development

│   DocumentDB    │

│   (MongoDB API) │### Traefik Management

└─────────────────┘

```Project này đã được tích hợp với Traefik reverse proxy sử dụng subdomain routing pattern thay vì path-based routing truyền thống. Traefik cung cấp:



### Step 1: Prepare AWS Infrastructure- **Subdomain Routing**: Mỗi service có subdomain riêng (user.localhost, driver.localhost, trip.localhost)

- **Automatic Service Discovery**: Tự động phát hiện services qua Docker labels

```powershell- **Load Balancing**: Phân tải tự động cho multiple instances

cd infrastructure/terraform- **SSL Termination**: Hỗ trợ HTTPS với Let's Encrypt

- **Dashboard**: Web UI để monitoring và debugging

# Initialize Terraform- **Centralized Middleware**: Rate limiting, CORS, security headers, compression tại proxy level

terraform init

#### Management Scripts

# Review planned changes

terraform plan**Windows (PowerShell):**



# Apply infrastructure```powershell

terraform apply# Start all services

```.\manage.ps1 start



**Resources created:**# Check health

- VPC with public/private subnets.\manage.ps1 health

- EKS cluster with managed node groups

- ElastiCache Redis cluster# View logs

- Amazon MSK (Kafka) cluster.\manage.ps1 logs traefik

- DocumentDB (MongoDB-compatible) cluster

- Application Load Balancer# Stop all services

- Security groups and IAM roles.\manage.ps1 stop

````

### Step 2: Configure kubectl

**Linux/Mac (Bash):**

````powershell

# Update kubeconfig for EKS```bash

aws eks update-kubeconfig --region us-east-1 --name uit-go-cluster# Start all services

./manage.sh start

# Verify connection

kubectl get nodes# Check health

```./manage.sh health



### Step 3: Deploy Secrets# View logs

./manage.sh logs traefik

```powershell

# Create namespace# Stop all services

kubectl create namespace uit-go./manage.sh stop

````

# Create secrets from env files

kubectl create secret generic user-service-secrets `#### Traefik Dashboard

--from-env-file=env/user-service.env `

-n uit-goAccess Traefik dashboard at: http://localhost:8080

kubectl create secret generic driver-service-secrets `The dashboard provides:

--from-env-file=env/driver-service.env `

-n uit-go- Real-time service status

- Request metrics

kubectl create secret generic trip-service-secrets `- Route configuration

--from-env-file=env/trip-service.env `- Health checks

-n uit-go- Error tracking

```

### Folder Structure

### Step 4: Deploy Applications

```

````powershelluit-go/

# Deploy all services├── docker-compose.yaml          # Container orchestration với Traefik

kubectl apply -f infrastructure/k8s/├── traefik.yml                  # Traefik main configuration

├── dynamic.yml                  # Traefik dynamic routing rules

# Check deployment status├── traefik.prod.yml            # Production Traefik config

kubectl get deployments -n uit-go├── docker-compose.healthcheck.yml # Health check utilities

kubectl get pods -n uit-go├── manage.ps1                  # Windows management script

kubectl get services -n uit-go├── manage.sh                   # Linux/Mac management script

```├── package.json                # Root package file

├── README.md                   # This file

### Step 5: Configure Domain & SSL├── .gitignore                  # Git ignore rules

├── env/                        # Environment configurations

```powershell│   ├── traefik.env            # Traefik environment variables

# Get ALB DNS name│   ├── user-service.env

kubectl get ingress -n uit-go│   ├── driver-service.env

│   └── trip-service.env

# Create Route 53 alias record pointing to ALB├── services/                   # Microservices

# Example: api.uitgo.com -> ALB DNS name│   ├── user-service/

│   │   ├── Dockerfile

# SSL certificates are automatically provisioned via ACM│   │   ├── package.json

```│   │   └── src/

│   │       ├── index.js

### Step 6: Initialize Database & Kafka│   │       ├── config/

│   │       │   └── database.js

```powershell│   │       ├── models/

# Run initialization jobs│   │       │   └── User.js

kubectl apply -f infrastructure/k8s/jobs/init-kafka-topics.yaml│   │       ├── routes/

kubectl apply -f infrastructure/k8s/jobs/init-db-indexes.yaml│   │       └── controllers/

│   ├── driver-service/

# Check job status│   │   ├── Dockerfile

kubectl get jobs -n uit-go│   │   ├── package.json

```│   │   └── src/

│   │       ├── index.js

### Step 7: Verify Production Deployment│   │       ├── config/

│   │       │   └── database.js

```bash│   │       ├── models/

# Check API health│   │       │   └── Driver.js

curl https://api.uitgo.com/user-service/health│   │       ├── routes/

curl https://api.uitgo.com/driver-service/health│   │       └── controllers/

curl https://api.uitgo.com/trip-service/health│   └── trip-service/

│       ├── Dockerfile

# Monitor logs│       ├── package.json

kubectl logs -f deployment/user-service -n uit-go│       └── src/

```│           ├── index.js

│           ├── config/

### Step 8: Configure Auto-Scaling│           │   └── database.js

│           ├── models/

```powershell│           │   └── Trip.js

# Enable cluster autoscaler│           ├── routes/

kubectl apply -f infrastructure/k8s/autoscaling/cluster-autoscaler.yaml│           └── controllers/

├── common/                     # Shared utilities

# Configure HPA for services└── config/                    # Configuration files

kubectl apply -f infrastructure/k8s/autoscaling/hpa-user-service.yaml```

kubectl apply -f infrastructure/k8s/autoscaling/hpa-driver-service.yaml

kubectl apply -f infrastructure/k8s/autoscaling/hpa-trip-service.yaml### Local Development

````

#### Start individual service

**Auto-scaling rules:**

- Scale up: CPU > 70% or Memory > 80%```bash

- Scale down: CPU < 30% and Memory < 50%# Start user service locally

- Min pods: 3 per servicecd services/user-service

- Max pods: 20 per servicenpm install

npm run dev

---

# Start gateway locally

## 📚 API Documentationcd gateway

npm install

### Service Endpointsnpm run dev

````

| Service | Local URL | AWS URL | Documentation |

|---------|-----------|---------|---------------|### Docker commands

| **User Service** | http://user.localhost:81 | https://api.uitgo.com/user-service | [API Guide](./services/user-service/API_GUIDE.md) |

| **Driver Service** | http://driver.localhost:81 | https://api.uitgo.com/driver-service | [API Guide](./services/driver-service/API_GUIDE.md) |```bash

| **Trip Service** | http://trip.localhost:81 | https://api.uitgo.com/trip-service | [API Guide](./services/trip-service/API_GUIDE.md) |# Xem logs của tất cả services

docker compose logs

### Quick API Examples

# Xem logs của service cụ thể

#### 1. User Registrationdocker compose logs traefik

docker compose logs user-service

```bash

POST /auth/register# Restart service

Content-Type: application/jsondocker compose restart user-service



{# Stop tất cả

  "email": "user@example.com",docker compose down

  "password": "SecurePass123",

  "name": "John Doe",# Rebuild service

  "phone": "0901234567",docker compose up --build user-service

  "role": "passenger"

}# Run health check

```docker compose -f docker-compose.healthcheck.yml up

````

#### 2. Driver Location Update

### Hot Reloading

````bash

POST /location/updateProject được cấu hình với volume mounting cho hot reloading:

Authorization: Bearer <driver_token>

Content-Type: application/json- Changes trong `src/` sẽ tự động restart service

- Không cần rebuild Docker image khi dev

{- Traefik tự động update routing khi services restart

  "latitude": 10.762622,

  "longitude": 106.660172## 🔧 Configuration

}

```### Traefik Configuration



#### 3. Trip Booking**Main Configuration (`traefik.yml`):**



```bash- Entry points (HTTP/HTTPS)

POST /trips- Docker provider for service discovery

Authorization: Bearer <passenger_token>- Dashboard and API settings

Content-Type: application/json- SSL certificate resolvers



{**Dynamic Configuration (`dynamic.yml`):**

  "pickup": {

    "latitude": 10.762622,- Middleware definitions (CORS, security, rate limiting)

    "longitude": 106.660172,- Static routes (if needed)

    "address": "UIT, HCMC"- Load balancing algorithms

  },

  "dropoff": {**Production Configuration (`traefik.prod.yml`):**

    "latitude": 10.772622,

    "longitude": 106.670172,- HTTPS redirects

    "address": "District 1, HCMC"- Let's Encrypt SSL certificates

  }- Enhanced security settings

}- Logging and monitoring

````

### Docker Compose

---

Services được cấu hình với:

## 🔥 Load Testing

- **Networks**: Internal communication qua `uit-go-network`

### Quick Load Test- **Volumes**: Code mounting cho development + Traefik config

- **Labels**: Traefik routing và middleware configuration

```powershell- **Dependencies**: Traefik depends on all microservices

# Run 2-minute stress test (200 concurrent users)

.\test\load-tests\run-stress-tests.ps1 -Quick### Security Features

```

Traefik cung cấp built-in security:

**Expected results:**

- ✅ Throughput: 600+ req/sec- **Automatic HTTPS**: Let's Encrypt integration

- ✅ P95 latency: < 200ms- **Security Headers**: HSTS, CSP, X-Frame-Options

- ✅ Success rate: > 95%- **Rate Limiting**: Request throttling per IP

- **CORS**: Cross-origin resource sharing

### Extended Load Test- **Load Balancing**: Health check và failover

````powershell### Performance

# Run 5-minute stress test (500 concurrent users)

.\test\load-tests\run-stress-tests.ps1 -Extended- **Compression**: Gzip compression middleware

```- **Health Checks**: Monitoring endpoints

- **Error Handling**: Centralized error management

### Custom Load Test

## 🐳 Production Deployment

```powershell

# Run specific test script### Traefik Production Setup

k6 run test/load-tests/k6-trip-booking.js

```bash

# With custom parameters# Use production configuration

k6 run --vus 100 --duration 3m test/load-tests/k6-driver-location.jsdocker compose up --build -d

````

# For production with SSL

**See [STRESS_TESTING_GUIDE.md](./test/load-tests/STRESS_TESTING_GUIDE.md) for comprehensive load testing documentation.**cp traefik.prod.yml traefik.yml

docker compose up --build -d

---```

## 📁 Project Structure### Environment Setup

````- Copy environment files và configure production values

uit-go/- Set appropriate `NODE_ENV=production` in service env files

├── common/                    # Shared libraries- Configure external databases (MongoDB)

│   └── shared/- Update `traefik.prod.yml` với your domain và email

│       ├── kafkaClient.js     # Kafka utilities

│       ├── redisManager.js    # Redis utilities### SSL/HTTPS Configuration

│       ├── logger.js          # Logging utilities

│       └── authMiddleware.js  # JWT authTraefik tự động handle SSL certificates:

│

├── services/                  # Microservices1. **Configure domain** trong `traefik.prod.yml`

│   ├── user-service/          # User & auth management2. **Set email** cho Let's Encrypt notifications

│   │   ├── src/3. **Enable HTTPS redirect** trong production config

│   │   │   ├── controllers/4. **Update service labels** với HTTPS entrypoints

│   │   │   ├── models/

│   │   │   ├── routes/```yaml

│   │   │   └── services/# Example production service labels

│   │   ├── Dockerfilelabels:

│   │   └── API_GUIDE.md  - "traefik.http.routers.user-service.rule=Host(`user.yourdomain.com`)"

│   │  - "traefik.http.routers.user-service.entrypoints=websecure"

│   ├── driver-service/        # Driver & location management  - "traefik.http.routers.user-service.tls.certresolver=letsencrypt"

│   │   ├── src/  - "traefik.http.routers.user-service.middlewares=api-middleware@file"

│   │   │   ├── services/```

│   │   │   │   └── locationService.js  # Redis GEORADIUS

│   │   └── API_GUIDE.md### Architecture Benefits

│   │

│   └── trip-service/          # Trip orchestration**Subdomain-based Architecture:**

│       ├── src/

│       │   ├── indexEventDriven.js     # Kafka integration- **Service Isolation**: Mỗi service có subdomain riêng biệt

│       │   ├── services/- **Simplified Routing**: Không cần `/api` prefix, routes trực tiếp

│       │   │   ├── driverMatchingService.js- **Better Organization**: Dễ dàng quản lý và phân quyền theo service

│       │   │   ├── tripEventProducer.js- **Scalability**: Dễ dàng scale từng service độc lập

│       │   │   └── tripEventConsumer.js- **Security**: Middleware được áp dụng tại proxy level thay vì từng service

│       └── WEBSOCKET_CONNECTION_FLOW.md

│**Middleware Centralization:**

├── config/                    # Configuration files

│   ├── traefik/               # API Gateway configs- **Performance**: Giảm overhead tại service level

│   └── redis/                 # Redis configs- **Consistency**: Đồng nhất security policy across services

│- **Maintainability**: Cấu hình tập trung tại Traefik

├── env/                       # Environment variables- **Flexibility**: Dễ dàng thay đổi middleware rules

│   ├── user-service.env

│   ├── driver-service.env### Infrastructure Services (Current)

│   └── trip-service.env

│Project hiện tại đã tích hợp:

├── test/                      # Testing suite

│   ├── load-tests/            # k6 load tests- **Traefik v3.0**: Modern reverse proxy với auto-discovery

│   │   ├── k6-stress-short.js- **MongoDB**: 3 separate databases per service

│   │   ├── k6-stress-extended.js  - `mongodb-users` (Port 27017): User authentication & profiles

│   │   └── STRESS_TESTING_GUIDE.md  - `mongodb-drivers` (Port 27018): Driver data & geolocation

│   └── uitgo-simulator.html   # Web UI for testing  - `mongodb-trips` (Port 27019): Trip history & booking

│- **Mongoose**: ODM for MongoDB with schema validation

├── scripts/                   # Utility scripts- **Docker Compose**: Container orchestration

│   ├── setup-kafka-topics.js

│   └── start-event-driven.ps1### Future Infrastructure

│

├── infrastructure/            # IaC for AWS (future)Project được chuẩn bị cho:

│   ├── terraform/             # Terraform configs

│   └── k8s/                   # Kubernetes manifests- **Redis**: Caching layer

│- **Kafka**: Message broker

├── docker-compose.yaml        # Local orchestration- **Elasticsearch**: Search & analytics

├── README.md                  # This file

├── ARCHITECTURE.md            # Architecture docs## 📊 Monitoring & Debugging

└── ADR/                       # Architectural decisions

```### Health Checks



---```bash

# Check Traefik status

## 🔧 Troubleshootingcurl http://localhost:8080/ping



### Common Issues# Check service discovery

curl http://localhost:8080/api/rawdata

#### 1. Services Won't Start

# Check API endpoints through subdomain routing

**Problem:** `docker compose up` fails with port conflictscurl http://user.localhost/users       # User service status

curl http://user.localhost/auth        # User auth endpoints

**Solution:**curl http://driver.localhost/drivers   # Driver service status

```powershellcurl http://driver.localhost/location  # Driver location endpoints

# Check which process is using the portcurl http://trip.localhost/trips       # Trip service status

netstat -ano | findstr :27017curl http://trip.localhost/booking     # Trip booking endpoints

netstat -ano | findstr :6379

# Check health endpoints

# Kill the process or stop conflicting servicescurl http://user.localhost/health

docker compose downcurl http://driver.localhost/health

docker compose up -dcurl http://trip.localhost/health

````

# Use management script

#### 2. Cannot Connect to `.localhost` Domains.\manage.ps1 health # Windows

./manage.sh health # Linux/Mac

**Problem:** `curl http://user.localhost:81` fails```

**Solution:**### Database Connection Status

````powershell

# Run DNS fix script```bash

.\test\load-tests\fix-localhost-dns.ps1# Check MongoDB containers

docker ps | grep mongodb

# Or manually add to C:\Windows\System32\drivers\etc\hosts:

127.0.0.1 user.localhost# Check database connections in logs

127.0.0.1 driver.localhostdocker compose logs user-service | grep MongoDB

127.0.0.1 trip.localhostdocker compose logs driver-service | grep MongoDB

```docker compose logs trip-service | grep MongoDB

````

#### 3. Kafka Topics Not Created

### Logs

**Problem:** Services log "Topic does not exist" errors

```````bash

**Solution:**# Real-time logs

```powershelldocker compose logs -f

# Manually create topics

node scripts/setup-kafka-topics.js# Service-specific logs

docker compose logs -f user-service

# Or check Kafka logs```

docker logs kafka

```### Container Status



#### 4. MongoDB Connection Refused```bash

# Check running containers

**Problem:** `MongoNetworkError: connect ECONNREFUSED`docker compose ps



**Solution:**# Check resource usage

```powershelldocker stats

# Wait for MongoDB health check to pass```

docker compose ps

## 🤝 Contributing

# Check MongoDB logs

docker logs uit-go-mongodb-users1. Fork the project

2. Create feature branch (`git checkout -b feature/AmazingFeature`)

# Restart MongoDB container3. Commit changes (`git commit -m 'Add some AmazingFeature'`)

docker compose restart mongodb-users4. Push to branch (`git push origin feature/AmazingFeature`)

```5. Open Pull Request



#### 5. Redis Authentication Failed### Development Guidelines



**Problem:** `ReplyError: NOAUTH Authentication required`- Follow RESTful API conventions

- Use middleware for cross-cutting concerns

**Solution:**- Implement proper error handling

```powershell- Add health checks to new services

# Verify REDIS_PASSWORD in env files- Update documentation for API changes

notepad env\user-service.env

### API Testing

# Should match redis.conf password

notepad config\redis\redis.conf### Using cURL



# Restart services```bash

docker compose restart# Test all endpoints via subdomain routing

```curl http://user.localhost/users

curl http://user.localhost/auth

#### 6. JWT Token Expiredcurl http://driver.localhost/drivers

curl http://driver.localhost/location

**Problem:** API returns `401 Unauthorized`curl http://trip.localhost/trips

curl http://trip.localhost/booking

**Solution:**

```powershell# Test health endpoints

# Login again to get fresh tokencurl http://user.localhost/health

curl -X POST http://user.localhost:81/auth/login `curl http://driver.localhost/health

  -H "Content-Type: application/json" `curl http://trip.localhost/health

  -d '{"email":"user@test.com","password":"Test1234"}'

```# Test Traefik dashboard

curl http://localhost:8080/ping

### Performance Issues```



#### High CPU Usage### Using Postman



```powershellImport collection với base URLs:

# Check container resource usage

docker stats- **User Service**: `http://user.localhost`

- **Driver Service**: `http://driver.localhost`

# Limit resources in docker-compose.yaml- **Trip Service**: `http://trip.localhost`

services:

  user-service:## 🐛 Troubleshooting

    deploy:

      resources:### Common Issues

        limits:

          cpus: '0.5'**Port already in use:**

          memory: 512M

``````bash

# Check port usage (Windows)

#### Slow Response Timesnetstat -ano | findstr :80

netstat -ano | findstr :8080

```powershell

# Check Redis connection# Kill process if needed

docker exec -it uit-go-redis redis-cli -a redis123 pingtaskkill /PID <PID> /F

```````

# Check MongoDB performance

docker exec -it uit-go-mongodb-users mongosh --eval "db.serverStatus()"**Container won't start:**

# Review service logs```bash

docker compose logs -f user-service# Check logs

````docker compose logs traefik

docker compose logs <service-name>

### Getting Help

# Rebuild container

1. **Check logs**: `docker compose logs -f [service-name]`docker compose up --build <service-name>

2. **Review documentation**: See service-specific `API_GUIDE.md` files```

3. **Load test results**: See `test/load-tests/STRESS_TEST_REPORT.md`

4. **Architecture decisions**: See `ADR/` directory**Traefik routing issues:**



---```bash

# Check Traefik dashboard

## 👥 Contributingcurl http://localhost:8080/api/rawdata



### Development Workflow# Verify service labels

docker inspect <container-name>

1. Fork the repository

2. Create a feature branch# Check service discovery

   ```bashdocker compose logs traefik | grep "Adding service"

   git checkout -b feature/your-feature-name```

````

3. Make changes and test locally**Network connectivity:**

   ````powershell

   docker compose up -d```bash

   # Run tests# Test internal connectivity

   ```docker exec uit-go-traefik curl http://user-service:3000

   ````

4. Commit with descriptive messagesdocker exec uit-go-traefik curl http://driver-service:3000

   ````bashdocker exec uit-go-traefik curl http://trip-service:3000

   git commit -m "feat: add driver rating system"

   ```# Test via Traefik subdomain routing

   ````

5. Push and create Pull Requestcurl http://user.localhost/users

   ```bashcurl http://driver.localhost/drivers

   git push origin feature/your-feature-namecurl http://trip.localhost/trips

   ```

# Test health endpoints

### Code Stylecurl http://user.localhost/health

curl http://driver.localhost/health

- **JavaScript**: Follow Airbnb style guidecurl http://trip.localhost/health

- **Commits**: Use conventional commits (feat, fix, docs, etc.)```

- **Documentation**: Update relevant docs with code changes

**Database connectivity issues:**

### Testing Requirements

````bash

- All new features must include load tests# Check MongoDB container status

- API changes must update `API_GUIDE.md`docker ps | grep mongodb

- Maintain 95%+ success rate in stress tests

# Check database logs

---docker compose logs mongodb-users

docker compose logs mongodb-drivers

## 📄 Licensedocker compose logs mongodb-trips



This project is licensed under the MIT License.# Test database connections

docker exec uit-go-mongodb-users mongosh --eval "db.adminCommand('ismaster')"

---docker exec uit-go-mongodb-drivers mongosh --eval "db.adminCommand('ismaster')"

docker exec uit-go-mongodb-trips mongosh --eval "db.adminCommand('ismaster')"

## 🙏 Acknowledgments```



- **UIT (University of Information Technology)** - Project sponsor## 📜 License

- **k6** - Load testing framework

- **Traefik** - Modern API GatewayThis project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

- **Apache Kafka** - Event streaming platform

## 📞 Contact

---

- Project: UIT-Go Ride Sharing Platform

## 📞 Contact- University: University of Information Technology (UIT)

- Version: 1.0.0

- **Project Lead**: Nguyen Cong Tu

- **GitHub**: [@nguyencongtu2004](https://github.com/nguyencongtu2004)---

- **Repository**: [uit-go](https://github.com/nguyencongtu2004/uit-go)

Made with ❤️ by UIT Students

---

**Built with ❤️ for high-performance ride-hailing at scale**
````
