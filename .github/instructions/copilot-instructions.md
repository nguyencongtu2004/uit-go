I use Windows OS, so the path uses backslashes. Script files in ps1 format.

# UIT-Go Copilot Instructions

## Architecture Overview

UIT-Go is a **ride-sharing microservices platform** built with Node.js/Express, using **database-per-service pattern** and **Traefik reverse proxy**. Focus on building the MVP for **Proof of Concept (PoC)** stress testing rather than full features.

Project is in development, so implementations simplify or stub out non-essential features.
IMPORTANT: Always keep it simple for PoC.

### Service Architecture

Dựa trên file Docker Compose, đây là tóm tắt hệ thống UIT-GO:

## Hệ thống UIT-GO - Tóm tắt Architecture

**Loại hệ thống:** Microservices cho ứng dụng đặt xe (ride-sharing)

### Database Services

- **3 MongoDB containers** (MongoDB 7.0):
  - `mongodb-users` (port 27017) - quản lý dữ liệu người dùng
  - `mongodb-drivers` (port 27018) - quản lý dữ liệu tài xế
  - `mongodb-trips` (port 27019) - quản lý dữ liệu chuyến đi

### Infrastructure Services

- **Redis** (port 6379) - caching service với authentication
- **Kafka** (ports 9092, 9093) - message broker chạy KRaft mode, xử lý async communication
- **Traefik** (ports 81, 443, 8080) - reverse proxy, load balancer và API gateway

### Application Services

- **User Service** - xử lý authentication và quản lý người dùng (subdomain: `user.localhost`)
- **Driver Service** - quản lý tài xế và vị trí (subdomain: `driver.localhost`)
- **Trip Service** - xử lý booking và chuyến đi (subdomain: `trip.localhost`)

### Tính năng

- Rate limiting cho từng service
- Health checks cho tất cả services
- Persistent volumes cho data storage
- Centralized logging
- Service discovery qua Docker network

**Tech Stack:** Node.js, MongoDB, Redis, Kafka, Traefik, Docker

### Traefik Subdomain Routing

| Subdomain Pattern  | Target Service | Routes                      | Access URLs                                                             |
| ------------------ | -------------- | --------------------------- | ----------------------------------------------------------------------- |
| `user.localhost`   | user-service   | `/users/*`, `/auth/*`       | http://user.localhost:81/users, http://user.localhost:81/auth           |
| `driver.localhost` | driver-service | `/drivers/*`, `/location/*` | http://driver.localhost:81/drivers, http://driver.localhost:81/location |
| `trip.localhost`   | trip-service   | `/trips/*`, `/booking/*`    | http://trip.localhost:81/trips, http://trip.localhost:81/booking        |

**Note**: Traefik runs on port **81** (not 80) to avoid conflicts. Access services via `http://service.localhost:81`

### Traefik Configuration Structure

```
config/traefik/
├── traefik.yml              # Main configuration
└── dynamic/                 # Dynamic routing rules
    ├── user-service.yml     # User service routing
    ├── driver-service.yml   # Driver service routing
    ├── trip-service.yml     # Trip service routing
    ├── middlewares.yml      # Middleware definitions
    └── dashboard.yml        # Dashboard config
```

### Middleware Chain

All services use `api-middleware` chain that includes:

- **security-headers**: CORS, XSS protection, content security
- **api-cors**: Cross-origin resource sharing for APIs
- **rate-limit**: 100 requests/15min per IP, burst of 50
- **compression**: Gzip compression for responses
- **request-limit**: 10MB max request body size

### Key Patterns

- **Service Communication**: Hybrid approach - Kafka for events, gRPC for internal calls, REST for external APIs
- **Database Strategy**: MongoDB per service + Redis for geospatial caching + Kafka for messaging
- **Real-time**: WebSocket + Socket.io for driver location updates and trip notifications
- **Infrastructure**: Docker Compose with Traefik file-based configuration using subdomain routing (centralized config management)

## Development Workflow

### Starting Services

```bash
# Primary commands via management scripts
docker compose up --build -d
```

### Service Structure

Each service follows this pattern:

- `src/index.js` - Express app with health checks, rate limiting, CORS
- `src/config/database.js` - MongoDB connection with graceful shutdown
- `src/models/` - Mongoose schemas with indexes and validation
- `env/{service-name}.env` - Service-specific environment configuration

### Adding New Routes

Routes are configured via **file-based configuration** in `config/traefik/dynamic/`:

```yaml
# config/traefik/dynamic/user-service.yml
http:
  routers:
    user-service-main:
      rule: "Host(`user.localhost`)"
      entrypoints:
        - web
      service: user-service
      middlewares:
        - api-middleware@file
  services:
    user-service:
      loadBalancer:
        servers:
          - url: http://user-service:3000
```

## Critical Implementation Details

### Geospatial Features (Driver Service)

- Use **Redis GEORADIUS** commands for nearby driver search
- MongoDB geospatial indexes for driver location history
- **Real-time location streaming** via WebSocket + Socket.io
- Location updates optimized for **10,000+ ops/second**

### Trip State Machine (Trip Service)

States: `REQUESTED → SEARCHING → ACCEPTED → DRIVER_ARRIVING → PICKED_UP → IN_PROGRESS → COMPLETED → CANCELLED`

- **15-second timeout** for driver acceptance
- Event-driven state transitions via Kafka
- Cross-service communication for driver matching

### Performance Targets

- **API Response**: < 50ms (P95)
- **Location Updates**: < 10ms latency
- **Driver Matching**: < 3 seconds
- **Concurrent Users**: 10,000+

### Database Conventions

- Use **database-per-service**: `uitgo_users`, `uitgo_drivers`, `uitgo_trips`
- MongoDB connection strings in service env files
- Implement graceful shutdown in all services
- Add performance indexes for geospatial queries

### Error Handling Pattern

```javascript
// Standard health check pattern in all services
app.get("/health", async (req, res) => {
  const healthCheck = {
    service: "service-name",
    status: dbConnection.isConnected() ? "OK" : "DEGRADED",
    dependencies: { mongodb: "connected|disconnected" },
  };
  res.status(dbConnection.isConnected() ? 200 : 503).json(healthCheck);
});
```

## Load Testing Focus

Priority test scenarios:

1. **Driver Location Storm**: 1000+ concurrent location updates
2. **Rush Hour Booking**: Peak traffic simulation with concurrent trip requests
3. **Cross-Service Communication**: Inter-service call performance under load
4. **Database Stress**: High-frequency geospatial queries

Use **k6 + Artillery** for load testing with integration into CI/CD pipeline.

## Avoid These Patterns

- Don't implement full user profile management (focus on core booking flow)
- Skip payment processing (PoC focuses on trip matching performance)
- Don't build complex notification systems (basic WebSocket sufficient)
- Avoid modifying Traefik config directly (use file-based configuration in `config/traefik/dynamic/`)

Focus on **core trip booking flow** and **geospatial driver matching** for maximum PoC impact.
