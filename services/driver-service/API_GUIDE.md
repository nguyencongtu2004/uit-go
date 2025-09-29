# UIT-Go Driver Service - API Testing Guide

## Overview

Driver Service là service chuyên biệt để quản lý trạng thái và vị trí của drivers trong hệ thống UIT-Go. Service được tối ưu hóa cho hiệu năng cao với khả năng xử lý 10,000+ requests/second cho các operations location-based.

Base URL: `http://localhost:3001`

## Core Features

- **Real-time Location Tracking**: Cập nhật vị trí driver với độ trễ < 10ms
- **High-Performance Geospatial Search**: Tìm kiếm drivers gần nhất trong < 3s
- **Redis-based Caching**: Tối ưu hóa cho throughput cao
- **Load Testing Ready**: Hỗ trợ batch operations và optional authentication

## Driver Status Management APIs

### 1. Update Driver Location (High-Frequency)

```bash
PUT /drivers/{driverId}/location
Content-Type: application/json
Authorization: Bearer JWT_TOKEN (production only)

{
  "longitude": 106.660172,
  "latitude": 10.762622
}
```

**Optimization Notes:**

- Optimized for 10,000+ requests/second
- Uses Redis for real-time tracking
- MongoDB updates are asynchronous (eventual consistency)
- Optional auth in development mode for load testing

### 2. Set Driver Online

```bash
POST /drivers/{driverId}/online
Content-Type: application/json
Authorization: Bearer JWT_TOKEN (production only)

{
  "longitude": 106.660172,
  "latitude": 10.762622
}
```

Đặt driver online và cập nhật vị trí khởi tạo. Location là required để đi online.

### 3. Set Driver Offline

```bash
POST /drivers/{driverId}/offline
Authorization: Bearer JWT_TOKEN (production only)
```

Đặt driver offline và remove khỏi location tracking system.

### 4. Set Driver In Trip

```bash
POST /drivers/{driverId}/trip
Authorization: Bearer JWT_TOKEN (production only)
```

Đặt driver vào trạng thái IN_TRIP (busy, không available cho booking mới).

### 5. Get Driver Status

```bash
GET /drivers/{driverId}/status
```

Public endpoint để lấy trạng thái hiện tại của driver.

## Location & Search APIs

### 1. Find Nearby Drivers (Core Endpoint)

```bash
GET /location/nearby?longitude=106.660172&latitude=10.762622&radius=5&limit=10
```

**Query Parameters:**

- `longitude`: Longitude của vị trí tìm kiếm (required)
- `latitude`: Latitude của vị trí tìm kiếm (required)
- `radius`: Bán kính tìm kiếm trong km (default: 5, max: 50)
- `limit`: Số lượng drivers tối đa (default: 10, max: 100)

**Performance Notes:**

- Sub-3s response time target
- Uses Redis GEORADIUS for speed
- Returns only ONLINE drivers
- Optimized for real-time driver matching

### 2. Batch Nearby Search (Load Testing)

```bash
POST /location/batch-nearby
Content-Type: application/json

{
  "locations": [
    {
      "longitude": 106.660172,
      "latitude": 10.762622
    },
    {
      "longitude": 106.670000,
      "latitude": 10.770000
    }
  ],
  "radius": 5,
  "limit": 10
}
```

**Constraints:**

- Maximum 50 locations per batch
- Radius max: 50km
- Limit max: 50 drivers per location

### 3. Get System Statistics

```bash
GET /location/stats
```

Returns system-wide statistics for monitoring:

- Number of online drivers
- Total drivers in system
- Utilization rate

## Response Formats

### Successful Response

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response data here
  }
}
```

### Driver Status Response

```json
{
  "success": true,
  "driver": {
    "id": "driver123",
    "status": "ONLINE",
    "location": {
      "longitude": 106.660172,
      "latitude": 10.762622
    }
  }
}
```

### Nearby Drivers Response

```json
{
  "success": true,
  "location": {
    "longitude": 106.660172,
    "latitude": 10.762622,
    "searchRadius": 5
  },
  "drivers": [
    {
      "driverId": "driver123",
      "distance": 0.8,
      "location": {
        "longitude": 106.662,
        "latitude": 10.763
      }
    }
  ],
  "count": 1
}
```

### System Stats Response

```json
{
  "success": true,
  "stats": {
    "onlineDrivers": 150,
    "totalDrivers": 500,
    "utilizationRate": "30.00"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error type",
  "message": "Detailed error message"
}
```

## cURL Examples

### Update Driver Location

```bash
curl -X PUT http://localhost:3001/drivers/driver123/location \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "longitude": 106.660172,
    "latitude": 10.762622
  }'
```

### Set Driver Online

```bash
curl -X POST http://localhost:3001/drivers/driver123/online \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "longitude": 106.660172,
    "latitude": 10.762622
  }'
```

### Set Driver Offline

```bash
curl -X POST http://localhost:3001/drivers/driver123/offline \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Find Nearby Drivers

```bash
curl -X GET "http://localhost:3001/location/nearby?longitude=106.660172&latitude=10.762622&radius=5&limit=10"
```

### Batch Search for Multiple Locations

```bash
curl -X POST http://localhost:3001/location/batch-nearby \
  -H "Content-Type: application/json" \
  -d '{
    "locations": [
      {"longitude": 106.660172, "latitude": 10.762622},
      {"longitude": 106.670000, "latitude": 10.770000},
      {"longitude": 106.680000, "latitude": 10.780000}
    ],
    "radius": 3,
    "limit": 5
  }'
```

### Get System Statistics

```bash
curl -X GET http://localhost:3001/location/stats
```

### Get Driver Status

```bash
curl -X GET http://localhost:3001/drivers/driver123/status
```

## Load Testing Guidelines

### High-Frequency Location Updates

```bash
# Test với 1000 concurrent updates
for i in {1..1000}; do
  curl -X PUT http://localhost:3001/drivers/driver$i/location \
    -H "Content-Type: application/json" \
    -d '{
      "longitude": '$(echo "106.6 + $RANDOM * 0.0001" | bc)',
      "latitude": '$(echo "10.7 + $RANDOM * 0.0001" | bc)'
    }' &
done
wait
```

### Batch Nearby Search Performance

```bash
# Test batch search với 50 locations
curl -X POST http://localhost:3001/location/batch-nearby \
  -H "Content-Type: application/json" \
  -d '{
    "locations": [
      // ... 50 locations
    ],
    "radius": 5,
    "limit": 20
  }' \
  -w "Time: %{time_total}s\n"
```

## Data Validation Rules

### Location Coordinates

- **Longitude**: -180 to 180 (decimal degrees)
- **Latitude**: -90 to 90 (decimal degrees)
- **Precision**: Up to 6 decimal places supported

### Search Parameters

- **Radius**: 0.1 to 50 km
- **Limit**: 1 to 100 drivers (nearby), 1 to 50 (batch)
- **Batch Locations**: Maximum 50 locations per request

### Driver Status

- Valid values: `OFFLINE`, `ONLINE`, `IN_TRIP`
- Status transitions:
  - `OFFLINE` → `ONLINE` (requires location)
  - `ONLINE` → `IN_TRIP`/`OFFLINE`
  - `IN_TRIP` → `OFFLINE`/`ONLINE`

## Performance Characteristics

### Response Time Targets

- **Location Update**: < 10ms (Redis-only operation)
- **Nearby Search**: < 3s (Redis GEORADIUS)
- **Driver Status**: < 50ms (Redis + fallback to MongoDB)
- **System Stats**: < 100ms

### Throughput Targets

- **Location Updates**: 10,000+ ops/second
- **Nearby Searches**: 1,000+ ops/second
- **Status Changes**: 5,000+ ops/second

### Redis Operations Used

- **GEOADD**: Store driver locations
- **GEORADIUS**: Find nearby drivers
- **GEOPOS**: Get driver position
- **SETEX**: Store driver status with TTL
- **PIPELINE**: Batch operations for performance

## Authentication & Authorization

### Production Mode

- All driver APIs require JWT token from User Service
- Token verification cached for 5 minutes
- Driver role validation for driver-specific operations

### Development/Testing Mode

- Optional authentication (set `NODE_ENV=development`)
- Enables high-throughput load testing
- No rate limiting in development mode

### Service-to-Service Communication

- Driver Service calls User Service for token verification
- 5-second timeout for auth requests
- Fallback handling for User Service unavailability

## Monitoring & Observability

### Health Check Endpoints

- Driver status endpoints can be used for health checking
- System stats provide real-time metrics
- Redis connectivity monitoring through location operations

### Key Metrics to Monitor

- Online driver count
- Average response time for nearby searches
- Location update frequency per driver
- Redis memory usage and performance
- MongoDB eventual consistency lag

## Environment Variables

```bash
# Service Configuration
NODE_ENV=development
PORT=3001

# Database
MONGODB_URI=mongodb://localhost:27017/uitgo_drivers
REDIS_URL=redis://localhost:6379

# Service URLs
USER_SERVICE_URL=http://user-service:3000

# Performance Tuning
LOCATION_EXPIRY=3600
TOKEN_CACHE_TTL=300000
```

## Important Notes

- **Dual Storage Strategy**: Redis for real-time operations, MongoDB for persistence
- **Eventual Consistency**: Location updates in MongoDB are asynchronous
- **High Availability**: Service can operate with Redis only if MongoDB is down
- **Load Testing Ready**: Optional auth and batch operations for performance testing
- **Geospatial Indexing**: MongoDB 2dsphere indexes for backup geospatial queries
- **Memory Efficiency**: TTL on Redis keys to prevent memory leaks
- **Production Security**: Full authentication required in production mode

## Status Codes

- `200`: Success
- `400`: Bad request (invalid coordinates/parameters)
- `401`: Unauthorized (invalid token)
- `403`: Forbidden (insufficient permissions)
- `404`: Driver not found
- `500`: Internal server error
- `503`: Service unavailable (User Service down)
- `504`: Request timeout (auth service timeout)
