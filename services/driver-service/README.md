# Driver Service - Load Testing Optimized

Driver Service được tối ưu hóa cho **Proof of Concept (PoC) Load Testing** với focus vào core functionalities:

## 🎯 Core Features for Load Testing

### 1. **High-Performance Location Updates**

- **Endpoint**: `PUT /drivers/:driverId/location`
- **Target**: 10,000+ operations/second
- **Redis GEOADD** cho sub-10ms latency
- Eventual consistency với MongoDB

### 2. **Nearby Driver Search**

- **Endpoint**: `GET /location/nearby`
- **Target**: Sub-3 second response
- **Redis GEORADIUS** commands
- Critical endpoint cho trip matching

### 3. **Driver Status Management**

- **Online**: `POST /drivers/:driverId/online`
- **Offline**: `POST /drivers/:driverId/offline`
- **In Trip**: `POST /drivers/:driverId/trip`
- Redis-cached với MongoDB fallback

## 🚀 Quick Start

```bash
# Start service
docker compose up driver-service -d --build

# Health check
curl http://driver.localhost:81/health

# Set driver online
curl -X POST http://driver.localhost:81/drivers/test-1/online \
  -H "Content-Type: application/json" \
  -d '{"longitude": 106.6297, "latitude": 10.8231}'

# Find nearby drivers
curl "http://driver.localhost:81/location/nearby?longitude=106.6297&latitude=10.8231&radius=5"
```

## 📊 Load Testing Endpoints

### High-Frequency Operations (Target: 1000+ RPS)

1. **Location Updates**: `PUT /drivers/:id/location`
2. **Nearby Search**: `GET /location/nearby`
3. **Status Check**: `GET /drivers/:id/status`

### Medium-Frequency Operations (Target: 100+ RPS)

1. **Go Online**: `POST /drivers/:id/online`
2. **Go Offline**: `POST /drivers/:id/offline`
3. **System Stats**: `GET /location/stats`

### Batch Operations (For Testing)

1. **Batch Nearby**: `POST /location/batch-nearby`

## 🔧 Performance Optimizations

### Redis Geospatial

- **GEOADD**: Store driver locations
- **GEORADIUS**: Find nearby drivers (< 10ms)
- **Pipeline**: Batch operations
- **Expiry**: Auto-cleanup offline drivers

### MongoDB

- **Simplified Schema**: Only essential fields
- **Geospatial Indexes**: 2dsphere for location queries
- **Eventual Consistency**: Hot path uses Redis

### Express Optimizations

- Minimal middleware for PoC
- No authentication (load testing focus)
- Reduced request/response logging in production
- Optimized JSON parsing (1MB limit)

## 🧪 Load Testing Scenarios

### 1. Driver Location Storm

```bash
# k6 script example
import http from 'k6/http';

export let options = {
  vus: 1000, // 1000 concurrent users
  duration: '30s',
};

export default function() {
  const driverId = `driver-${__VU}-${__ITER}`;
  const longitude = 106.6297 + (Math.random() - 0.5) * 0.01;
  const latitude = 10.8231 + (Math.random() - 0.5) * 0.01;

  http.put(`http://driver.localhost:81/drivers/${driverId}/location`,
    JSON.stringify({ longitude, latitude }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}
```

### 2. Nearby Driver Search Rush

```bash
# Artillery script example
config:
  target: 'http://driver.localhost:81'
  phases:
    - duration: 60
      arrivalRate: 50 # 50 RPS

scenarios:
  - name: "Nearby Search"
    weight: 100
    flow:
      - get:
          url: "/location/nearby"
          qs:
            longitude: 106.6297
            latitude: 10.8231
            radius: 5
            limit: 10
```

## 📈 Performance Targets

| Operation         | Target RPS | Target Latency | Notes                |
| ----------------- | ---------- | -------------- | -------------------- |
| Location Update   | 10,000+    | < 10ms         | Redis hot path       |
| Nearby Search     | 1,000+     | < 50ms         | Critical for booking |
| Status Check      | 5,000+     | < 20ms         | Cached in Redis      |
| Go Online/Offline | 100+       | < 100ms        | MongoDB write        |

## 🔍 Monitoring Endpoints

- **Health**: `GET /health`
- **Stats**: `GET /location/stats`
- **Driver Status**: `GET /drivers/:id/status`

## ⚡ PoC Simplifications

- **No Authentication**: Focus on core performance
- **Auto-approved Drivers**: Skip approval workflow
- **Minimal Validation**: Essential checks only
- **Simplified Vehicle Info**: Just basic data
- **No Payment Integration**: Core booking flow only

## 🎯 Next Steps for Load Testing

1. **Setup k6/Artillery**: Install load testing tools
2. **Generate Test Data**: Create multiple test drivers
3. **Run Location Storm**: Test 10,000+ location updates/sec
4. **Test Nearby Search**: Simulate rush hour booking
5. **Cross-service Testing**: Integration with Trip Service

Ready for high-scale load testing! 🚀
