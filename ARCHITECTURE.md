# 🏗️ UIT-GO System Architecture

Kiến trúc hệ thống cho nền tảng ride-hailing UIT-GO với microservices, event-driven và real-time communication.

---

## 📋 Mục Lục

- [Tổng Quan](#-tổng-quan)
- [Kiến Trúc Tổng Thể](#-kiến-trúc-tổng-thể)
- [Microservices](#-microservices)
- [Kiến Trúc Dữ Liệu](#-kiến-trúc-dữ-liệu)
- [Event-Driven Architecture](#-event-driven-architecture)
- [Driver Matching Algorithm](#-driver-matching-algorithm)
- [Real-time Communication](#-real-time-communication)
- [Security Architecture](#-security-architecture)
- [Scalability & Performance](#-scalability--performance)

---

## 🎯 Tổng Quan

### Design Principles

1. **Microservices Independence** - Mỗi service sở hữu database riêng
2. **Event-Driven** - Asynchronous messaging qua Kafka
3. **Performance First** - Sub-10ms geospatial queries, <200ms latency
4. **Horizontal Scalability** - Scale từng service độc lập
5. **Fault Tolerance** - Graceful degradation

### Performance Metrics

| Metric | Target | Achieved |
|--------|--------|----------|
| Throughput | 500+ req/s | ✅ 613 req/s |
| Latency P95 | <200ms | ✅ 176.87ms |
| Availability | 99.9% | ✅ |
| Concurrent Users | 500+ | ✅ 500 |
| Geospatial Query | <10ms | ✅ ~5ms |

---

## 🏛 Kiến Trúc Tổng Thể

```
┌────────────────────────────────────────────────────┐
│              UIT-GO Platform                        │
├────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────┐              ┌──────────┐           │
│  │Passenger │              │  Driver  │           │
│  │  Mobile  │              │  Mobile  │           │
│  └────┬─────┘              └────┬─────┘           │
│       │                         │                  │
│       │    ┌────────────────┐   │                 │
│       └────►  API Gateway   ◄───┘                 │
│            │  (Traefik)     │                      │
│            └────────┬───────┘                      │
│                     │                              │
│       ┌─────────────┼─────────────┐               │
│       │             │             │               │
│  ┌────▼───┐   ┌────▼───┐   ┌────▼───┐           │
│  │  User  │   │ Driver │   │  Trip  │           │
│  │Service │   │Service │   │Service │           │
│  └────┬───┘   └────┬───┘   └────┬───┘           │
│       │            │            │               │
│  ┌────▼────────────▼────────────▼────┐          │
│  │     Event Bus (Kafka)             │          │
│  └────────────┬──────────────────────┘          │
│               │                                  │
│  ┌────────────┼──────────────┐                  │
│  │            │              │                  │
│  ▼            ▼              ▼                  │
│ MongoDB     Redis       WebSocket               │
│ (x3 DBs)   (Cache)      (Real-time)            │
└────────────────────────────────────────────────┘
```

---

## 🔧 Microservices

### Service Boundaries

```
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│   User Service      │  │  Driver Service     │  │   Trip Service      │
├─────────────────────┤  ├─────────────────────┤  ├─────────────────────┤
│ Responsibilities:   │  │ Responsibilities:   │  │ Responsibilities:   │
│ • Authentication    │  │ • Driver profiles   │  │ • Trip matching     │
│ • User management   │  │ • Location tracking │  │ • State management  │
│ • JWT tokens        │  │ • Geospatial query  │  │ • Notifications     │
│ • Profile updates   │  │ • Status management │  │ • Fare calculation  │
│                     │  │                     │  │ • Rating system     │
│ Database:           │  │ Database:           │  │ Database:           │
│ • uitgo_users       │  │ • uitgo_drivers     │  │ • uitgo_trips       │
│ • Port: 27017       │  │ • Port: 27018       │  │ • Port: 27019       │
│                     │  │                     │  │                     │
│ Cache (Redis DB):   │  │ Cache (Redis DB):   │  │ Cache (Redis DB):   │
│ • DB 0: Sessions    │  │ • DB 1: Locations   │  │ • DB 2: Active trips│
│ • JWT blacklist     │  │ • Geospatial index  │  │ • Trip states       │
│                     │  │                     │  │                     │
│ API Routes:         │  │ API Routes:         │  │ API Routes:         │
│ • /auth/*           │  │ • /drivers/*        │  │ • /trips/*          │
│ • /users/*          │  │ • /location/*       │  │ • /booking/*        │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
```

### Inter-Service Communication

**1. Synchronous (HTTP/REST)**
```
Trip Service → GET /drivers/nearby → Driver Service
```

**2. Asynchronous (Kafka Events)**
```
Trip Service → trip.requested → Kafka → Driver Service
```

**3. Real-time (WebSocket)**
```
Trip Service → location update → WebSocket → Passenger Client
```

### API Gateway (Traefik)

**Routing Pattern:**
```
user.localhost    → User Service
driver.localhost  → Driver Service
trip.localhost    → Trip Service
```

**Middlewares:**
- ✅ CORS headers
- ✅ Rate limiting (100 req/min per IP)
- ✅ Compression (gzip)
- ✅ Security headers
- ✅ Request logging

---

## 💾 Kiến Trúc Dữ Liệu

### Database Per Service Pattern

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  MongoDB Users   │  │ MongoDB Drivers  │  │  MongoDB Trips   │
│   Port: 27017    │  │   Port: 27018    │  │   Port: 27019    │
├──────────────────┤  ├──────────────────┤  ├──────────────────┤
│ Collections:     │  │ Collections:     │  │ Collections:     │
│ • users          │  │ • drivers        │  │ • trips          │
│                  │  │                  │  │ • ratings        │
│ Indexes:         │  │ Indexes:         │  │ Indexes:         │
│ • email (unique) │  │ • driverId       │  │ • tripId         │
│ • phone (unique) │  │ • status         │  │ • passengerId    │
│ • createdAt      │  │ • location (2d)  │  │ • driverId       │
│                  │  │ • isOnline       │  │ • status         │
│                  │  │                  │  │ • location (geo) │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

### Redis Cache Strategy

```
┌──────────────────────────────────────────────────┐
│         Redis Instance (Port 6379)               │
├──────────────────────────────────────────────────┤
│ DB 0 - User Service                              │
│ ├── auth:tokens:{userId}     TTL: 7 days        │
│ ├── user:profile:{userId}    TTL: 1 hour        │
│ └── session:{sessionId}      TTL: 24 hours      │
│                                                  │
│ DB 1 - Driver Service (CRITICAL)                 │
│ ├── driver_locations (GEOSPATIAL)               │
│ │   Commands: GEOADD, GEORADIUS, GEOPOS         │
│ ├── driver:status:{driverId} TTL: 5 min         │
│ └── driver:online            TTL: none          │
│                                                  │
│ DB 2 - Trip Service                              │
│ ├── trip:active:{tripId}     TTL: 2 hours       │
│ ├── trip:matching:{tripId}   TTL: 2 min         │
│ └── trip:fare:{tripId}       TTL: 30 min        │
│                                                  │
│ Performance:                                     │
│ • GEORADIUS query: ~5ms average                  │
│ • Cache hit rate: >90%                           │
│ • Memory usage: <2GB                             │
└──────────────────────────────────────────────────┘
```

### Data Consistency

**Strong Consistency (Within Service):**
- MongoDB = Primary source of truth
- Redis = Cache (stale allowed, TTL managed)

**Eventual Consistency (Cross-Service):**
```
Service A → MongoDB → Kafka Event → Service B
```

**Cache Invalidation:**
1. Write-through: Update DB → Invalidate cache
2. TTL-based: Auto-expire
3. Event-based: Kafka event → Clear keys

---

## 📡 Event-Driven Architecture

### Kafka Topics

| Topic | Producer | Consumers | Partitions | Retention |
|-------|----------|-----------|------------|-----------|
| **trip.requested** | Trip Service | Driver Service | 3 | 24h |
| **trip.accepted** | Driver Service | Trip Service | 3 | 24h |
| **trip.completed** | Driver Service | Trip Service | 3 | 7d |
| **trip.cancelled** | Trip/Driver | Trip Service | 3 | 7d |
| **driver.location.updated** | Driver Service | Trip Service | 6 | 1h |

### Event Schema

```json
{
  "eventId": "uuid",
  "eventType": "trip.requested",
  "timestamp": "2025-10-29T10:00:00Z",
  "data": {
    "tripId": "trip_123",
    "passengerId": "user_456",
    "pickup": { "lat": 10.762622, "lng": 106.660172 },
    "dropoff": { "lat": 10.772622, "lng": 106.670172 },
    "estimatedFare": 50000
  }
}
```

### Trip Lifecycle Flow

```
1. Trip Request
   Passenger → Trip Service → MongoDB → Kafka (trip.requested)
   → Driver Service → Find nearby → Notify drivers

2. Trip Acceptance
   Driver → Driver Service → Kafka (trip.accepted)
   → Trip Service → Update status → Notify passenger

3. Location Updates (Every 5s)
   Driver → Driver Service → Redis GEOADD
   → Kafka (location.updated) → WebSocket → Passenger

4. Trip Completion
   Driver → Driver Service → Kafka (trip.completed)
   → Trip Service → Calculate fare → Update DB → Rating
```

---

## 🎯 Driver Matching Algorithm

### Matching Flow

```
┌─────────────────────────────────────────────────────┐
│         Real-time Driver Matching                   │
└─────────────────────────────────────────────────────┘

Step 1: Trip Request
├── Passenger requests trip at (10.762, 106.660)
└── Trip Service validates & saves to MongoDB

Step 2: Redis GEORADIUS Query (~5ms)
├── GEORADIUS driver_locations 106.660 10.762 5 KM
├── WITHDIST WITHCOORD ASC COUNT 5
└── Returns:
    1. driver_001: 0.8km [106.661, 10.763]
    2. driver_042: 1.2km [106.665, 10.760]
    3. driver_099: 2.5km [106.670, 10.755]
    4. driver_127: 3.1km [106.655, 10.770]
    5. driver_088: 4.8km [106.680, 10.765]

Step 3: Filter Available Drivers
├── Check: isOnline = true
├── Check: status = "available"
├── Check: rating >= 4.0
└── Result: driver_001 ✓, driver_042 ✓, driver_127 ✓

Step 4: Prioritize by Score
├── Score = (1/distance)*0.6 + (rating/5)*0.4
├── driver_001: 1.142 🥇
├── driver_042: 0.876
└── driver_127: 0.553

Step 5: Send Notification
└── WebSocket → driver_001 (15s timeout)
    If rejected → driver_042
    If rejected → driver_127
```

### Performance Optimizations

1. **Redis Geospatial**: O(N+log(M)) ~ 5ms for 10K drivers
2. **Batch Status Check**: 3.3x faster than individual queries
3. **In-Memory Caching**: 80% less MongoDB queries
4. **Location Debouncing**: 60% less write load (update only if moved >50m)
5. **Pagination**: `COUNT 5` - 10x faster for dense areas

---

## 🔌 Real-time Communication

### WebSocket Architecture

```
┌──────────────┐              ┌──────────────┐
│  Passenger   │              │    Driver    │
│    Client    │              │    Client    │
└──────┬───────┘              └──────┬───────┘
       │                             │
       │ ws://trip.localhost         │
       └─────────┬───────────────────┘
                 │
          ┌──────▼──────┐
          │  Socket.IO  │
          │   Server    │
          └──────┬──────┘
                 │
   ┌─────────────┼─────────────┐
   │             │             │
┌──▼────┐  ┌─────▼─────┐  ┌───▼────┐
│Room:  │  │   Room:   │  │ Room:  │
│user_  │  │   trip_   │  │driver_ │
│{id}   │  │   {id}    │  │{id}    │
└───────┘  └───────────┘  └────────┘
```

### Connection Flow

```
1. Client connects → socket.on('connection')
2. Authenticate → socket.emit('authenticate', {userId})
3. Validate token → Join room: socket.join('user_123')
4. Confirm → socket.emit('authenticated', {success: true})
```

### Event Types

- `TRIP_REQUEST` → Sent to driver
- `TRIP_ACCEPTED` → Sent to passenger
- `DRIVER_LOCATION` → Sent to passenger (every 5s)
- `TRIP_STARTED` → Both
- `TRIP_COMPLETED` → Both
- `TRIP_CANCELLED` → Both

### Location Update Flow (Total: ~200-300ms)

```
Driver App → HTTP POST /location/update (50ms)
  ↓
Driver Service → Redis GEOADD (5ms)
  ↓
Kafka produce driver.location.updated (20ms)
  ↓
Trip Service consumes event (30ms)
  ↓
WebSocket emit to passenger room (10ms)
  ↓
Network to client (100ms)
  ↓
Passenger App updates map
```

---

## 🔒 Security Architecture

### JWT Authentication

```
┌──────────────────────────────────────────────────┐
│         JWT-based Authentication                 │
└──────────────────────────────────────────────────┘

1. Login:
   Client → POST /auth/login {email, password}
   User Service → Validate → Generate JWT
   Response: {token, user}

2. Token Structure:
   Header:    { alg: "HS256", typ: "JWT" }
   Payload:   { userId, role, email, exp, iat }
   Signature: HMAC-SHA256(header + payload, SECRET)

3. Protected Request:
   Client → GET /trips
   Header: Authorization: Bearer JWT
   Middleware → Validate JWT
     1. Extract token
     2. Verify signature
     3. Check expiration
     4. Check blacklist (Redis)
     5. Attach user to req.user
     6. next() or 401
```

### Network Security (AWS)

```
Layer 1: Internet → Route 53
├── DDoS Protection (AWS Shield)
└── DNS query logging

Layer 2: Route 53 → ALB
├── WAF (Web Application Firewall)
├── SQL injection protection
├── XSS protection
└── Rate limiting

Layer 3: ALB → EKS
└── Security Groups (HTTPS/443 only)

Layer 4: EKS → Services
└── Network Policies (Pod-to-pod restricted)

Layer 5: Services → Databases
├── MongoDB: Only from EKS nodes
├── Redis: Only from EKS nodes
└── Kafka: Only from EKS nodes

Layer 6: Data at Rest
├── EBS: Encrypted (KMS)
├── S3: AES-256
└── DocumentDB: Encryption enabled

Layer 7: Data in Transit
└── TLS 1.2+ for all communication
```

---

## 📈 Scalability & Performance

### Horizontal Pod Autoscaler

```
User Service:
├── Min Pods: 3, Max Pods: 20
├── Scale Up: CPU > 70% OR Memory > 80%
└── Scale Down: CPU < 30% AND Memory < 50%

Driver Service (CRITICAL):
├── Min Pods: 5, Max Pods: 30
├── Scale Up: CPU > 60% OR Memory > 75%
└── Scale Down: CPU < 20% AND Memory < 40%

Trip Service:
├── Min Pods: 4, Max Pods: 25
├── Scale Up: CPU > 65% OR Memory > 75%
└── Scale Down: CPU < 25% AND Memory < 45%
```

### Caching Strategy

```
Level 1: Application Memory
├── Config, JWT keys
├── Size: ~50MB per instance
└── TTL: Application lifetime

Level 2: Redis (Shared)
├── Sessions, locations, trip states
├── Size: 2-4GB
├── TTL: Variable (5min - 7days)
└── Hit rate: 90%+

Level 3: MongoDB
├── Persistent data
├── Size: 50GB+
└── Source of truth
```

### Performance Metrics

| Metric | Target | Warning | Critical | Current |
|--------|--------|---------|----------|---------|
| Request Rate | 500/s | 800/s | 1000/s | ✅ 613/s |
| Latency P50 | <50ms | 100ms | 200ms | ✅ 45ms |
| Latency P95 | <200ms | 300ms | 500ms | ✅ 176ms |
| Error Rate | <1% | 2% | 5% | ✅ 0.3% |
| CPU Usage | <60% | 75% | 90% | ✅ 58% |
| Memory Usage | <70% | 85% | 95% | ✅ 65% |

---

## 🚀 Deployment Architecture

### Local (Docker Compose)

```
Host Machine
├── Docker Engine
│   ├── MongoDB (27017, 27018, 27019)
│   ├── Redis (6379)
│   ├── Kafka (9092, 9094)
│   ├── User Service (3000)
│   ├── Driver Service (3000)
│   ├── Trip Service (3000)
│   └── Traefik (80, 81, 8080)
└── Network: uit-go-network (bridge)
```

### AWS Production

```
Route 53 (DNS)
  ↓
Application Load Balancer
  ↓
Amazon EKS Cluster
├── Control Plane (Managed)
├── Worker Nodes (Auto Scaling)
│   ├── User Service Pods (x3)
│   ├── Driver Service Pods (x3)
│   ├── Trip Service Pods (x3)
│   └── Traefik Ingress
└── Networking
    ├── VPC: 10.0.0.0/16
    ├── Public Subnets: ALB, NAT
    ├── Private Subnets: EKS, Services
    └── Database Subnets: RDS, ElastiCache

External Services:
├── ElastiCache (Redis) - Multi-AZ
├── Amazon MSK (Kafka) - 3 AZ
└── DocumentDB (MongoDB compatible)
```

### CI/CD Pipeline

```
1. Git Push → GitHub
2. GitHub Actions:
   ├── Build & Test (npm test)
   ├── Security Scan (Snyk, Trivy)
   ├── Build Docker Images
   ├── Push to ECR
   ├── Deploy to Staging
   ├── Run Smoke Tests
   └── Deploy to Production (manual approval)
3. Deployment Strategies:
   ├── Blue-Green: Zero downtime
   ├── Canary: 10% → 50% → 100%
   └── Rollback: Auto on health check fail
```

---

## 📊 Summary

### Architecture Highlights

✅ **High Performance**: Sub-200ms latency, 600+ req/s  
✅ **Scalability**: Horizontal scaling per service  
✅ **Resilience**: Event-driven with fault tolerance  
✅ **Maintainability**: Clean boundaries, monitoring  
✅ **Cost Efficiency**: Right-sized, caching strategies

### Next Steps

1. [API Documentation](./services/user-service/API_GUIDE.md)
2. [Load Testing Guide](./test/load-tests/STRESS_TESTING_GUIDE.md)
3. [Architecture Decisions (ADR)](./ADR/)

---

**Last Updated**: October 30, 2025  
**Version**: 2.0  
**Maintained by**: UIT-GO Development Team