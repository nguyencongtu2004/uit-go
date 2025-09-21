# UIT-Go - Ride Sharing Microservices Platform

[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://docker.com)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.x-lightgrey.svg)](https://expressjs.com)
[![License](https://img.shields.io/badge/License-ISC-yellow.svg)](LICENSE)

UIT-Go là một nền tảng chia sẻ chuyến đi được xây dựng với kiến trúc microservices, sử dụng Node.js, Express, Docker và các công nghệ hiện đại khác.

## 🏗️ Kiến trúc hệ thống

### Microservices Architecture

```
┌─────────────────┐
│   API Gateway   │ ← Port 8080 (External)
│   (Port 3000)   │
└─────────┬───────┘
          │
    ┌─────┼─────┐
    │     │     │
┌───▼───┐ │ ┌───▼────┐ ┌────▼────┐
│ User  │ │ │ Driver │ │  Trip   │
│Service│ │ │Service │ │ Service │
└───────┘ │ └────────┘ └─────────┘
          │
    Docker Network
```

### Services Overview

| Service            | Port   | Chức năng                     | API Endpoints                   |
| ------------------ | ------ | ----------------------------- | ------------------------------- |
| **API Gateway**    | 8080   | Proxy & Load Balancing        | `/health`, `/`                  |
| **User Service**   | 3000\* | Quản lý người dùng & xác thực | `/api/users`, `/api/auth`       |
| **Driver Service** | 3000\* | Quản lý tài xế & vị trí       | `/api/drivers`, `/api/location` |
| **Trip Service**   | 3000\* | Quản lý chuyến đi & đặt xe    | `/api/trips`, `/api/booking`    |

\*Internal Docker network port

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
```

3. **Verify installation**

```bash
# Check API Gateway
curl http://localhost:8080/health

# Check available routes
curl http://localhost:8080/
```

### Environment Variables

Project sử dụng environment files cho từng service:

```
env/
├── gateway.env          # API Gateway config
├── user-service.env     # User service config
├── driver-service.env   # Driver service config
└── trip-service.env     # Trip service config
```

## 📋 API Documentation

### API Gateway (http://localhost:8080)

#### Health Check

```http
GET /health
```

#### Service Information

```http
GET /
```

### User Service

#### Get Users

```http
GET /api/users
```

**Response:**

```json
{
  "message": "User Service - Users endpoint",
  "service": "user-service",
  "users": [
    { "id": 1, "name": "Test User 1", "type": "passenger" },
    { "id": 2, "name": "Test Driver 1", "type": "driver" }
  ]
}
```

#### Authentication

```http
GET /api/auth
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

#### Get Drivers

```http
GET /api/drivers
```

**Response:**

```json
{
  "message": "Driver Service - Drivers endpoint",
  "service": "driver-service",
  "drivers": [
    {
      "id": 1,
      "name": "Driver 1",
      "status": "online",
      "lat": 10.762622,
      "lng": 106.660172
    },
    {
      "id": 2,
      "name": "Driver 2",
      "status": "offline",
      "lat": 10.776889,
      "lng": 106.695244
    }
  ]
}
```

#### Location Services

```http
GET /api/location
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

#### Get Trips

```http
GET /api/trips
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
GET /api/booking
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

### Folder Structure

```
uit-go/
├── docker-compose.yaml      # Container orchestration
├── package.json            # Root package file
├── README.md              # This file
├── .gitignore             # Git ignore rules
├── env/                   # Environment configurations
│   ├── gateway.env
│   ├── user-service.env
│   ├── driver-service.env
│   └── trip-service.env
├── gateway/               # API Gateway service
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       └── index.js
├── services/              # Microservices
│   ├── user-service/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.js
│   │       ├── routes/
│   │       ├── controllers/
│   │       └── models/
│   ├── driver-service/
│   │   └── ... (same structure)
│   └── trip-service/
│       └── ... (same structure)
├── common/                # Shared utilities
└── config/               # Configuration files
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

#### Docker commands

```bash
# Xem logs của tất cả services
docker compose logs

# Xem logs của service cụ thể
docker compose logs user-service

# Restart service
docker compose restart user-service

# Stop tất cả
docker compose down

# Rebuild service
docker compose up --build user-service
```

### Hot Reloading

Project được cấu hình với volume mounting cho hot reloading:

- Changes trong `src/` sẽ tự động restart service
- Không cần rebuild Docker image khi dev

## 🔧 Configuration

### Docker Compose

Services được cấu hình với:

- **Networks**: Internal communication qua `uit-go-network`
- **Volumes**: Code mounting cho development
- **Environment**: Separate env files cho mỗi service
- **Dependencies**: Gateway depends on all services

### Security Features

- **Helmet.js**: HTTP security headers
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: Request throttling
- **Input Validation**: JSON parsing limits

### Performance

- **Compression**: Gzip compression middleware
- **Health Checks**: Monitoring endpoints
- **Error Handling**: Centralized error management

## 🐳 Production Deployment

### Docker Production

```bash
# Production build
docker compose -f docker-compose.prod.yaml up --build -d
```

### Environment Setup

- Copy `.env.example` files và configure production values
- Set appropriate `NODE_ENV=production`
- Configure external databases (MongoDB, Redis, Kafka)

### Infrastructure Services (Future)

Project được chuẩn bị cho:

- **MongoDB**: Database storage
- **Redis**: Caching layer
- **Kafka**: Message broker
- **Elasticsearch**: Search & analytics

## 📊 Monitoring & Debugging

### Health Checks

```bash
# Check all services
curl http://localhost:8080/health

# Check individual service health
docker exec uit-go-user-service curl http://localhost:3000/health
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

## 📝 API Testing

### Using cURL

```bash
# Test all endpoints
curl http://localhost:8080/api/users
curl http://localhost:8080/api/drivers
curl http://localhost:8080/api/trips
curl http://localhost:8080/api/auth
curl http://localhost:8080/api/booking
curl http://localhost:8080/api/location
```

### Using Postman

Import collection với base URL: `http://localhost:8080`

## 🐛 Troubleshooting

### Common Issues

**Port already in use:**

```bash
# Check port usage
netstat -ano | findstr :8080
# Kill process if needed
taskkill /PID <PID> /F
```

**Container won't start:**

```bash
# Check logs
docker compose logs <service-name>
# Rebuild container
docker compose up --build <service-name>
```

**Network connectivity:**

```bash
# Test internal connectivity
docker exec uit-go-gateway curl http://user-service:3000/health
```

## 📜 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 📞 Contact

- Project: UIT-Go Ride Sharing Platform
- University: University of Information Technology (UIT)
- Version: 1.0.0

---

Made with ❤️ by UIT Students
