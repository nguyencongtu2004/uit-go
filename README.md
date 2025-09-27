# UIT-Go - Ride Sharing Microservices Platform

[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://docker.com)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.x-lightgrey.svg)](https://expressjs.com)
[![License](https://img.shields.io/badge/License-ISC-yellow.svg)](LICENSE)

UIT-Go là một nền tảng chia sẻ chuyến đi được xây dựng với kiến trúc microservices, sử dụng Node.js, Express, Docker và các công nghệ hiện đại khác.

## 🏗️ Kiến trúc hệ thống

### Microservices Architecture với Traefik Reverse Proxy

```
                    ┌─────────────────┐
                    │   Traefik       │ ← Port 80/443 (HTTP/HTTPS)
                    │  Reverse Proxy  │ ← Port 8080 (Dashboard)
                    │  Load Balancer  │
                    └─────────┬───────┘
                              │
                ┌─────────────┼─────────────┐
                │             │             │
            ┌───▼───┐     ┌───▼────┐    ┌───▼────┐
            │ User  │     │ Driver │    │  Trip  │
            │Service│     │Service │    │Service │
            │:3000  │     │ :3000  │    │ :3000  │
            └───┬───┘     └────┬───┘    └────┬───┘
                │              │             │
            ┌───▼───┐     ┌────▼────┐   ┌────▼───┐
            │MongoDB│     │ MongoDB │   │MongoDB │
            │Users  │     │ Drivers │   │ Trips  │
            │:27017 │     │ :27018  │   │ :27019 │
            └───────┘     └─────────┘   └────────┘
                              │
                        Docker Network
```

### Services Overview

| Service            | Internal Port | External Access | Database        | Chức năng                     |
| ------------------ | ------------- | --------------- | --------------- | ----------------------------- |
| **Traefik Proxy**  | 80, 443, 8080 | ✓               | -               | Reverse Proxy & Load Balancer |
| **User Service**   | 3000          | via Traefik     | MongoDB Users   | Quản lý người dùng & xác thực |
| **Driver Service** | 3000          | via Traefik     | MongoDB Drivers | Quản lý tài xế & vị trí       |
| **Trip Service**   | 3000          | via Traefik     | MongoDB Trips   | Quản lý chuyến đi & đặt xe    |

### Traefik Routing Configuration

| Subdomain Pattern  | Target Service | Routes        | Middleware Applied         |
| ------------------ | -------------- | ------------- | -------------------------- |
| `user.localhost`   | user-service   | `/auth/*`     | CORS, Security, Rate Limit |
| `user.localhost`   | user-service   | `/users/*`    | CORS, Security, Rate Limit |
| `driver.localhost` | driver-service | `/drivers/*`  | CORS, Security, Rate Limit |
| `driver.localhost` | driver-service | `/location/*` | CORS, Security, Rate Limit |
| `trip.localhost`   | trip-service   | `/trips/*`    | CORS, Security, Rate Limit |
| `trip.localhost`   | trip-service   | `/booking/*`  | CORS, Security, Rate Limit |

### Database Architecture

| Database Container  | Port  | Database Name | Chức năng                   |
| ------------------- | ----- | ------------- | --------------------------- |
| **mongodb-users**   | 27017 | uitgo_users   | User data & authentication  |
| **mongodb-drivers** | 27018 | uitgo_drivers | Driver data & geolocation   |
| **mongodb-trips**   | 27019 | uitgo_trips   | Trip data & booking history |

### Database Models & Schemas

#### User Model (uitgo_users)

```javascript
{
  _id: ObjectId,
  email: String (unique, required),
  password: String (hashed, required),
  profile: {
    firstName: String (required),
    lastName: String (required),
    phone: String (unique, required),
    avatar: String,
    dateOfBirth: Date
  },
  role: String (enum: ['passenger', 'driver', 'admin'], default: 'passenger'),
  status: String (enum: ['active', 'inactive', 'suspended'], default: 'active'),
  preferences: {
    language: String (default: 'vi'),
    notifications: Boolean (default: true)
  },
  createdAt: Date,
  updatedAt: Date
}
```

#### Driver Model (uitgo_drivers)

```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: 'User', required),
  driverInfo: {
    licenseNumber: String (unique, required),
    licenseExpiry: Date (required),
    experience: Number,
    rating: Number (default: 5.0),
    totalTrips: Number (default: 0)
  },
  vehicle: {
    make: String (required),
    model: String (required),
    year: Number (required),
    licensePlate: String (unique, required),
    color: String (required),
    type: String (enum: ['bike', 'car'], required)
  },
  location: {
    type: String (default: 'Point'),
    coordinates: [Number] // [longitude, latitude]
  },
  status: String (enum: ['online', 'offline', 'busy'], default: 'offline'),
  documents: {
    avatar: String,
    licensePhoto: String,
    vehiclePhoto: String
  },
  createdAt: Date,
  updatedAt: Date
}
```

#### Trip Model (uitgo_trips)

```javascript
{
  _id: ObjectId,
  passengerId: ObjectId (ref: 'User', required),
  driverId: ObjectId (ref: 'Driver'),
  pickup: {
    address: String (required),
    location: {
      type: String (default: 'Point'),
      coordinates: [Number] // [longitude, latitude]
    }
  },
  destination: {
    address: String (required),
    location: {
      type: String (default: 'Point'),
      coordinates: [Number]
    }
  },
  status: String (enum: ['searching', 'accepted', 'ongoing', 'completed', 'cancelled']),
  pricing: {
    baseFare: Number,
    distanceFare: Number,
    timeFare: Number,
    totalFare: Number,
    paymentMethod: String (enum: ['cash', 'card', 'wallet'])
  },
  timeline: {
    requestedAt: Date (required),
    acceptedAt: Date,
    startedAt: Date,
    completedAt: Date
  },
  route: {
    distance: Number, // in meters
    duration: Number, // in seconds
    polyline: String
  },
  createdAt: Date,
  updatedAt: Date
}
```

## 🚀 Quick Start

### Prerequisites

- [Docker](https://docker.com) & Docker Compose
- [Node.js](https://nodejs.org) 18+ (for local development)
- Git

### Installation & Setup

1. **Clone repository**

```bash
git clone <repository-url>
cd uit-go
```

2. **Start với Docker Compose**

```bash
# Build và start tất cả services
docker compose up --build

# Hoặc chạy background
docker compose up --build -d

# Sử dụng management script (Windows)
.\manage.ps1 start

# Sử dụng management script (Linux/Mac)
./manage.sh start
```

### Verify installation

```bash
# Check Traefik dashboard
curl http://localhost:8080/ping

# Check API endpoints via subdomain routing
curl http://user.localhost/users
curl http://user.localhost/auth
curl http://driver.localhost/drivers
curl http://driver.localhost/location
curl http://trip.localhost/trips
curl http://trip.localhost/booking
```

### Access Points

- **Main API**:
  - User Service: http://user.localhost (via Traefik)
  - Driver Service: http://driver.localhost (via Traefik)
  - Trip Service: http://trip.localhost (via Traefik)
- **Traefik Dashboard**: http://localhost:8080
- **MongoDB Users**: localhost:27017
- **MongoDB Drivers**: localhost:27018
- **MongoDB Trips**: localhost:27019

### Environment Variables

Project sử dụng environment files cho từng service:

```
env/
├── traefik.env          # Traefik configuration
├── user-service.env     # User service config
├── driver-service.env   # Driver service config
└── trip-service.env     # Trip service config
```

## 📋 API Documentation

### Access via Traefik Subdomain Routing

All API endpoints are now accessible through Traefik reverse proxy using subdomain patterns. Each service has its own subdomain and simplified routing:

- **User Service**: `http://user.localhost` - User management & authentication
- **Driver Service**: `http://driver.localhost` - Driver management & location services
- **Trip Service**: `http://trip.localhost` - Trip management & booking services

#### Traefik Dashboard

```http
GET http://localhost:8080
```

Access the Traefik dashboard to monitor services, routes, and health status.

#### Health Check

```http
GET http://localhost:8080/ping
```

### User Service

Base URL: `http://user.localhost`

#### Get Users

```http
GET http://user.localhost/users
```

**Response:**

```json
{
  "message": "User Service - Users endpoint",
  "service": "user-service",
  "database": "uitgo_users",
  "count": 0,
  "users": []
}
```

#### Authentication

```http
GET http://user.localhost/auth
```

**Response:**

```json
{
  "message": "User Service - Auth endpoint",
  "service": "user-service",
  "endpoints": ["login", "register", "refresh"]
}
```

### Driver Service

Base URL: `http://driver.localhost`

#### Get Drivers

```http
GET http://driver.localhost/drivers
```

**Response:**

```json
{
  "message": "Driver Service - Drivers endpoint",
  "service": "driver-service",
  "database": "uitgo_drivers",
  "count": 0,
  "drivers": []
}
```

#### Location Services

```http
GET http://driver.localhost/location
```

**Response:**

```json
{
  "message": "Driver Service - Location endpoint",
  "service": "driver-service",
  "endpoints": ["update", "track", "nearby"]
}
```

### Trip Service

Base URL: `http://trip.localhost`

#### Get Trips

```http
GET http://trip.localhost/trips
```

**Response:**

```json
{
  "message": "Trip Service - Trips endpoint",
  "service": "trip-service",
  "trips": [
    {
      "id": 1,
      "passenger": "User 1",
      "driver": "Driver 1",
      "status": "completed"
    },
    {
      "id": 2,
      "passenger": "User 2",
      "driver": "Driver 2",
      "status": "ongoing"
    }
  ]
}
```

#### Booking Services

```http
GET http://trip.localhost/booking
```

**Response:**

```json
{
  "message": "Trip Service - Booking endpoint",
  "service": "trip-service",
  "endpoints": ["create", "cancel", "status"]
}
```

## 🛠️ Development

### Traefik Management

Project này đã được tích hợp với Traefik reverse proxy sử dụng subdomain routing pattern thay vì path-based routing truyền thống. Traefik cung cấp:

- **Subdomain Routing**: Mỗi service có subdomain riêng (user.localhost, driver.localhost, trip.localhost)
- **Automatic Service Discovery**: Tự động phát hiện services qua Docker labels
- **Load Balancing**: Phân tải tự động cho multiple instances
- **SSL Termination**: Hỗ trợ HTTPS với Let's Encrypt
- **Dashboard**: Web UI để monitoring và debugging
- **Centralized Middleware**: Rate limiting, CORS, security headers, compression tại proxy level

#### Management Scripts

**Windows (PowerShell):**

```powershell
# Start all services
.\manage.ps1 start

# Check health
.\manage.ps1 health

# View logs
.\manage.ps1 logs traefik

# Stop all services
.\manage.ps1 stop
```

**Linux/Mac (Bash):**

```bash
# Start all services
./manage.sh start

# Check health
./manage.sh health

# View logs
./manage.sh logs traefik

# Stop all services
./manage.sh stop
```

#### Traefik Dashboard

Access Traefik dashboard at: http://localhost:8080

The dashboard provides:

- Real-time service status
- Request metrics
- Route configuration
- Health checks
- Error tracking

### Folder Structure

```
uit-go/
├── docker-compose.yaml          # Container orchestration với Traefik
├── traefik.yml                  # Traefik main configuration
├── dynamic.yml                  # Traefik dynamic routing rules
├── traefik.prod.yml            # Production Traefik config
├── docker-compose.healthcheck.yml # Health check utilities
├── manage.ps1                  # Windows management script
├── manage.sh                   # Linux/Mac management script
├── package.json                # Root package file
├── README.md                   # This file
├── .gitignore                  # Git ignore rules
├── env/                        # Environment configurations
│   ├── traefik.env            # Traefik environment variables
│   ├── user-service.env
│   ├── driver-service.env
│   └── trip-service.env
├── services/                   # Microservices
│   ├── user-service/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.js
│   │       ├── config/
│   │       │   └── database.js
│   │       ├── models/
│   │       │   └── User.js
│   │       ├── routes/
│   │       └── controllers/
│   ├── driver-service/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.js
│   │       ├── config/
│   │       │   └── database.js
│   │       ├── models/
│   │       │   └── Driver.js
│   │       ├── routes/
│   │       └── controllers/
│   └── trip-service/
│       ├── Dockerfile
│       ├── package.json
│       └── src/
│           ├── index.js
│           ├── config/
│           │   └── database.js
│           ├── models/
│           │   └── Trip.js
│           ├── routes/
│           └── controllers/
├── common/                     # Shared utilities
└── config/                    # Configuration files
```

### Local Development

#### Start individual service

```bash
# Start user service locally
cd services/user-service
npm install
npm run dev

# Start gateway locally
cd gateway
npm install
npm run dev
```

### Docker commands

```bash
# Xem logs của tất cả services
docker compose logs

# Xem logs của service cụ thể
docker compose logs traefik
docker compose logs user-service

# Restart service
docker compose restart user-service

# Stop tất cả
docker compose down

# Rebuild service
docker compose up --build user-service

# Run health check
docker compose -f docker-compose.healthcheck.yml up
```

### Hot Reloading

Project được cấu hình với volume mounting cho hot reloading:

- Changes trong `src/` sẽ tự động restart service
- Không cần rebuild Docker image khi dev
- Traefik tự động update routing khi services restart

## 🔧 Configuration

### Traefik Configuration

**Main Configuration (`traefik.yml`):**

- Entry points (HTTP/HTTPS)
- Docker provider for service discovery
- Dashboard and API settings
- SSL certificate resolvers

**Dynamic Configuration (`dynamic.yml`):**

- Middleware definitions (CORS, security, rate limiting)
- Static routes (if needed)
- Load balancing algorithms

**Production Configuration (`traefik.prod.yml`):**

- HTTPS redirects
- Let's Encrypt SSL certificates
- Enhanced security settings
- Logging and monitoring

### Docker Compose

Services được cấu hình với:

- **Networks**: Internal communication qua `uit-go-network`
- **Volumes**: Code mounting cho development + Traefik config
- **Labels**: Traefik routing và middleware configuration
- **Dependencies**: Traefik depends on all microservices

### Security Features

Traefik cung cấp built-in security:

- **Automatic HTTPS**: Let's Encrypt integration
- **Security Headers**: HSTS, CSP, X-Frame-Options
- **Rate Limiting**: Request throttling per IP
- **CORS**: Cross-origin resource sharing
- **Load Balancing**: Health check và failover

### Performance

- **Compression**: Gzip compression middleware
- **Health Checks**: Monitoring endpoints
- **Error Handling**: Centralized error management

## 🐳 Production Deployment

### Traefik Production Setup

```bash
# Use production configuration
docker compose up --build -d

# For production with SSL
cp traefik.prod.yml traefik.yml
docker compose up --build -d
```

### Environment Setup

- Copy environment files và configure production values
- Set appropriate `NODE_ENV=production` in service env files
- Configure external databases (MongoDB)
- Update `traefik.prod.yml` với your domain và email

### SSL/HTTPS Configuration

Traefik tự động handle SSL certificates:

1. **Configure domain** trong `traefik.prod.yml`
2. **Set email** cho Let's Encrypt notifications
3. **Enable HTTPS redirect** trong production config
4. **Update service labels** với HTTPS entrypoints

```yaml
# Example production service labels
labels:
  - "traefik.http.routers.user-service.rule=Host(`user.yourdomain.com`)"
  - "traefik.http.routers.user-service.entrypoints=websecure"
  - "traefik.http.routers.user-service.tls.certresolver=letsencrypt"
  - "traefik.http.routers.user-service.middlewares=api-middleware@file"
```

### Architecture Benefits

**Subdomain-based Architecture:**

- **Service Isolation**: Mỗi service có subdomain riêng biệt
- **Simplified Routing**: Không cần `/api` prefix, routes trực tiếp
- **Better Organization**: Dễ dàng quản lý và phân quyền theo service
- **Scalability**: Dễ dàng scale từng service độc lập
- **Security**: Middleware được áp dụng tại proxy level thay vì từng service

**Middleware Centralization:**

- **Performance**: Giảm overhead tại service level
- **Consistency**: Đồng nhất security policy across services
- **Maintainability**: Cấu hình tập trung tại Traefik
- **Flexibility**: Dễ dàng thay đổi middleware rules

### Infrastructure Services (Current)

Project hiện tại đã tích hợp:

- **Traefik v3.0**: Modern reverse proxy với auto-discovery
- **MongoDB**: 3 separate databases per service
  - `mongodb-users` (Port 27017): User authentication & profiles
  - `mongodb-drivers` (Port 27018): Driver data & geolocation
  - `mongodb-trips` (Port 27019): Trip history & booking
- **Mongoose**: ODM for MongoDB with schema validation
- **Docker Compose**: Container orchestration

### Future Infrastructure

Project được chuẩn bị cho:

- **Redis**: Caching layer
- **Kafka**: Message broker
- **Elasticsearch**: Search & analytics

## 📊 Monitoring & Debugging

### Health Checks

```bash
# Check Traefik status
curl http://localhost:8080/ping

# Check service discovery
curl http://localhost:8080/api/rawdata

# Check API endpoints through subdomain routing
curl http://user.localhost/users       # User service status
curl http://user.localhost/auth        # User auth endpoints
curl http://driver.localhost/drivers   # Driver service status
curl http://driver.localhost/location  # Driver location endpoints
curl http://trip.localhost/trips       # Trip service status
curl http://trip.localhost/booking     # Trip booking endpoints

# Check health endpoints
curl http://user.localhost/health
curl http://driver.localhost/health
curl http://trip.localhost/health

# Use management script
.\manage.ps1 health  # Windows
./manage.sh health   # Linux/Mac
```

### Database Connection Status

```bash
# Check MongoDB containers
docker ps | grep mongodb

# Check database connections in logs
docker compose logs user-service | grep MongoDB
docker compose logs driver-service | grep MongoDB
docker compose logs trip-service | grep MongoDB
```

### Logs

```bash
# Real-time logs
docker compose logs -f

# Service-specific logs
docker compose logs -f user-service
```

### Container Status

```bash
# Check running containers
docker compose ps

# Check resource usage
docker stats
```

## 🤝 Contributing

1. Fork the project
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

### Development Guidelines

- Follow RESTful API conventions
- Use middleware for cross-cutting concerns
- Implement proper error handling
- Add health checks to new services
- Update documentation for API changes

### API Testing

### Using cURL

```bash
# Test all endpoints via subdomain routing
curl http://user.localhost/users
curl http://user.localhost/auth
curl http://driver.localhost/drivers
curl http://driver.localhost/location
curl http://trip.localhost/trips
curl http://trip.localhost/booking

# Test health endpoints
curl http://user.localhost/health
curl http://driver.localhost/health
curl http://trip.localhost/health

# Test Traefik dashboard
curl http://localhost:8080/ping
```

### Using Postman

Import collection với base URLs:

- **User Service**: `http://user.localhost`
- **Driver Service**: `http://driver.localhost`
- **Trip Service**: `http://trip.localhost`

## 🐛 Troubleshooting

### Common Issues

**Port already in use:**

```bash
# Check port usage (Windows)
netstat -ano | findstr :80
netstat -ano | findstr :8080

# Kill process if needed
taskkill /PID <PID> /F
```

**Container won't start:**

```bash
# Check logs
docker compose logs traefik
docker compose logs <service-name>

# Rebuild container
docker compose up --build <service-name>
```

**Traefik routing issues:**

```bash
# Check Traefik dashboard
curl http://localhost:8080/api/rawdata

# Verify service labels
docker inspect <container-name>

# Check service discovery
docker compose logs traefik | grep "Adding service"
```

**Network connectivity:**

```bash
# Test internal connectivity
docker exec uit-go-traefik curl http://user-service:3000
docker exec uit-go-traefik curl http://driver-service:3000
docker exec uit-go-traefik curl http://trip-service:3000

# Test via Traefik subdomain routing
curl http://user.localhost/users
curl http://driver.localhost/drivers
curl http://trip.localhost/trips

# Test health endpoints
curl http://user.localhost/health
curl http://driver.localhost/health
curl http://trip.localhost/health
```

**Database connectivity issues:**

```bash
# Check MongoDB container status
docker ps | grep mongodb

# Check database logs
docker compose logs mongodb-users
docker compose logs mongodb-drivers
docker compose logs mongodb-trips

# Test database connections
docker exec uit-go-mongodb-users mongosh --eval "db.adminCommand('ismaster')"
docker exec uit-go-mongodb-drivers mongosh --eval "db.adminCommand('ismaster')"
docker exec uit-go-mongodb-trips mongosh --eval "db.adminCommand('ismaster')"
```

## 📜 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 📞 Contact

- Project: UIT-Go Ride Sharing Platform
- University: University of Information Technology (UIT)
- Version: 1.0.0

---

Made with ❤️ by UIT Students
