# UIT-Go Trip Service - API Testing Guide

## Overview

Trip Service là service chính (core service) của hệ thống UIT-Go, chịu trách nhiệm điều phối toàn bộ luồng nghiệp vụ đặt xe. Service tích hợp với User Service và Driver Service để cung cấp chức năng booking xe hoàn chỉnh.

Base URL: `http://localhost:3002`

## Core Features

- **Trip Lifecycle Management**: Quản lý trạng thái chuyến đi từ yêu cầu đến hoàn thành
- **Real-time Driver Matching**: Tìm kiếm và thông báo drivers phù hợp
- **Smart Fare Calculation**: Tính toán giá cước với surge pricing
- **WebSocket Integration**: Real-time notifications cho tất cả participants
- **State Management**: Theo dõi trạng thái với timeout handling
- **Rating & Feedback**: Đánh giá chuyến đi sau khi hoàn thành

## Trip Management APIs

### 1. Create Trip Request

```bash
POST /trips
Content-Type: application/json
Authorization: Bearer JWT_TOKEN (Passenger only)

{
  "origin": {
    "address": "268 Lý Thường Kiệt, Phường 14, Quận 10, TPHCM",
    "latitude": 10.762622,
    "longitude": 106.660172
  },
  "destination": {
    "address": "Trường Đại học UIT, Linh Trung, Thủ Đức, TPHCM",
    "latitude": 10.870733,
    "longitude": 106.803337
  }
}
```

**Response includes:**

- Trip details với estimated fare
- Available drivers được notify
- Fare calculation breakdown
- Driver acceptance timeout info

### 2. Accept Trip (Driver)

```bash
PATCH /trips/{tripId}/accept
Content-Type: application/json
Authorization: Bearer JWT_TOKEN (Driver only)

{
  "estimatedArrivalTime": 10
}
```

Driver accept trip request. Chỉ drivers được notify mới có thể accept.

### 3. Update Trip Status

```bash
PATCH /trips/{tripId}/status
Content-Type: application/json
Authorization: Bearer JWT_TOKEN (Trip participants)

{
  "status": "DRIVER_ARRIVING",
  "location": {
    "latitude": 10.762622,
    "longitude": 106.660172
  }
}
```

**Valid status transitions:**

- `SEARCHING` → `ACCEPTED` (by driver)
- `ACCEPTED` → `DRIVER_ARRIVING` (by driver)
- `DRIVER_ARRIVING` → `PICKED_UP` (by driver)
- `PICKED_UP` → `IN_PROGRESS` (by driver)
- `IN_PROGRESS` → `COMPLETED` (by driver/passenger)
- Any status → `CANCELLED`

### 4. Get Trip Details

```bash
GET /trips/{tripId}
Authorization: Bearer JWT_TOKEN (Trip participants only)
```

Returns complete trip information including state và timeout details.

### 5. Get Trip History

```bash
GET /trips?page=1&limit=10&status=COMPLETED
Authorization: Bearer JWT_TOKEN
```

**Query Parameters:**

- `page`: Page number (default: 1)
- `limit`: Items per page (1-100, default: 10)
- `status`: Filter by trip status
- `startDate`: Filter trips from date
- `endDate`: Filter trips to date

### 6. Cancel Trip

```bash
DELETE /trips/{tripId}
# OR
PATCH /trips/{tripId}/cancel
Content-Type: application/json
Authorization: Bearer JWT_TOKEN (Trip participants)

{
  "reason": "Change of plans"
}
```

### 7. Rate Trip (Passenger)

```bash
PATCH /trips/{tripId}/rating
Content-Type: application/json
Authorization: Bearer JWT_TOKEN (Passenger only)

{
  "rating": 5,
  "comment": "Great driver, safe trip!"
}
```

Rating: 1-5 stars, chỉ có thể rate completed trips một lần.

## Booking & Estimation APIs

### 1. Get Fare Estimate

```bash
POST /booking/estimate
Content-Type: application/json
Authorization: Bearer JWT_TOKEN (optional - better rates for logged users)

{
  "origin": {
    "address": "268 Lý Thường Kiệt, Phường 14, Quận 10, TPHCM",
    "latitude": 10.762622,
    "longitude": 106.660172
  },
  "destination": {
    "address": "Trường Đại học UIT, Linh Trung, Thủ Đức, TPHCM",
    "latitude": 10.870733,
    "longitude": 106.803337
  }
}
```

**Returns:**

- Fare estimate with breakdown
- Fare range (min-max)
- Driver availability in area
- Estimated wait time
- Route information

### 2. Check Driver Availability

```bash
GET /booking/availability?latitude=10.762622&longitude=106.660172&radius=5
Authorization: Bearer JWT_TOKEN (optional)
```

**Query Parameters:**

- `latitude`: Search center latitude (required)
- `longitude`: Search center longitude (required)
- `radius`: Search radius in km (default: 5)

**Returns:**

- Number of available drivers
- Estimated wait time
- Average wait time
- Demand level (low/medium/high/very_high)
- Surge pricing info
- Driver distribution (without personal info)

### 3. Get Active Bookings

```bash
GET /booking/active
Authorization: Bearer JWT_TOKEN
```

Returns user's active trips (for both passengers and drivers).

### 4. Get Surge Pricing Info

```bash
GET /booking/surge?latitude=10.762622&longitude=106.660172
```

**Returns:**

- Current surge multiplier
- Whether surge is active
- Explanation of pricing
- Location-specific surge info

### 5. Create Booking Request

```bash
POST /booking/request
Content-Type: application/json
Authorization: Bearer JWT_TOKEN (Passenger only)

{
  "origin": {
    "address": "268 Lý Thường Kiệt, Phường 14, Quận 10, TPHCM",
    "latitude": 10.762622,
    "longitude": 106.660172
  },
  "destination": {
    "address": "Trường Đại học UIT, Linh Trung, Thủ Đức, TPHCM",
    "latitude": 10.870733,
    "longitude": 106.803337
  }
}
```

Alternative endpoint to `POST /trips` với booking-specific logic.

## Internal Service APIs

### 1. Sync Driver Location

```bash
POST /drivers/location/sync
Content-Type: application/json

{
  "driverId": "driver123",
  "latitude": 10.762622,
  "longitude": 106.660172,
  "status": "AVAILABLE"
}
```

Internal endpoint called by User Service khi driver update status.

### 2. Sync All Available Drivers

```bash
POST /drivers/sync-all
```

Sync tất cả available drivers từ User Service vào Redis cache.

### 3. Find Nearby Drivers (Internal)

```bash
GET /drivers/nearby?latitude=10.762622&longitude=106.660172&radius=5&limit=10
```

Internal endpoint for testing driver matching algorithm.

## Response Formats

### Trip Response

```json
{
  "success": true,
  "data": {
    "trip": {
      "id": "65f123456789abcdef012345",
      "passengerId": "passenger123",
      "driverId": "driver456",
      "origin": {
        "address": "268 Lý Thường Kiệt, Phường 14, Quận 10, TPHCM",
        "latitude": 10.762622,
        "longitude": 106.660172
      },
      "destination": {
        "address": "Trường Đại học UIT, Linh Trung, Thủ Đức, TPHCM",
        "latitude": 10.870733,
        "longitude": 106.803337
      },
      "status": "IN_PROGRESS",
      "estimatedFare": 95000,
      "actualFare": 98000,
      "rating": 5,
      "comment": "Great trip!",
      "requestedAt": "2024-01-15T10:30:00.000Z",
      "acceptedAt": "2024-01-15T10:31:00.000Z",
      "pickedUpAt": "2024-01-15T10:45:00.000Z",
      "completedAt": "2024-01-15T11:15:00.000Z",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T11:15:00.000Z"
    },
    "fareDetails": {
      "success": true,
      "distance": 12.5,
      "estimatedDuration": 25,
      "baseFare": 85000,
      "surgeMultiplier": 1.2,
      "estimatedFare": 102000,
      "breakdown": {
        "basePrice": 5000,
        "distanceFare": 80000,
        "surgeFare": 17000
      }
    }
  },
  "message": "Trip created successfully"
}
```

### Availability Response

```json
{
  "success": true,
  "data": {
    "location": {
      "latitude": 10.762622,
      "longitude": 106.660172,
      "searchRadius": 5
    },
    "driversAvailable": 8,
    "estimatedWaitTime": 3,
    "averageWaitTime": 5,
    "demand": "medium",
    "surge": {
      "isActive": true,
      "surgeMultiplier": 1.3,
      "reason": "high_demand"
    },
    "driverDistribution": [
      {
        "distance": 0.8,
        "estimatedArrival": 3,
        "rating": 4.8
      },
      {
        "distance": 1.2,
        "estimatedArrival": 4,
        "rating": 4.9
      }
    ]
  },
  "message": "8 drivers available in your area"
}
```

### Trip History Response

```json
{
  "success": true,
  "data": {
    "trips": [
      {
        "id": "65f123456789abcdef012345",
        "passengerId": "passenger123",
        "driverId": "driver456",
        "origin": {
          "address": "268 Lý Thường Kiệt, Phường 14, Quận 10, TPHCM",
          "latitude": 10.762622,
          "longitude": 106.660172
        },
        "destination": {
          "address": "Trường Đại học UIT, Linh Trung, Thủ Đức, TPHCM",
          "latitude": 10.870733,
          "longitude": 106.803337
        },
        "status": "COMPLETED",
        "estimatedFare": 95000,
        "actualFare": 98000,
        "rating": 5,
        "createdAt": "2024-01-15T10:30:00.000Z",
        "completedAt": "2024-01-15T11:15:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "pages": 3,
      "hasNext": true,
      "hasPrev": false
    },
    "statistics": {
      "COMPLETED": {
        "count": 20,
        "totalFare": 1850000
      },
      "CANCELLED": {
        "count": 5,
        "totalFare": 0
      }
    },
    "summary": {
      "totalTrips": 25,
      "totalEarnings": 1850000
    }
  },
  "message": "Trip history retrieved successfully"
}
```

## cURL Examples

### Create Trip Request

```bash
curl -X POST http://localhost:3002/trips \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "origin": {
      "address": "268 Lý Thường Kiệt, Phường 14, Quận 10, TPHCM",
      "latitude": 10.762622,
      "longitude": 106.660172
    },
    "destination": {
      "address": "Trường Đại học UIT, Linh Trung, Thủ Đức, TPHCM",
      "latitude": 10.870733,
      "longitude": 106.803337
    }
  }'
```

### Get Fare Estimate

```bash
curl -X POST http://localhost:3002/booking/estimate \
  -H "Content-Type: application/json" \
  -d '{
    "origin": {
      "address": "268 Lý Thường Kiệt, Phường 14, Quận 10, TPHCM",
      "latitude": 10.762622,
      "longitude": 106.660172
    },
    "destination": {
      "address": "Trường Đại học UIT, Linh Trung, Thủ Đức, TPHCM",
      "latitude": 10.870733,
      "longitude": 106.803337
    }
  }'
```

### Accept Trip (Driver)

```bash
curl -X PATCH http://localhost:3002/trips/65f123456789abcdef012345/accept \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer DRIVER_JWT_TOKEN" \
  -d '{
    "estimatedArrivalTime": 8
  }'
```

### Update Trip Status

```bash
curl -X PATCH http://localhost:3002/trips/65f123456789abcdef012345/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "status": "DRIVER_ARRIVING",
    "location": {
      "latitude": 10.762622,
      "longitude": 106.660172
    }
  }'
```

### Check Driver Availability

```bash
curl -X GET "http://localhost:3002/booking/availability?latitude=10.762622&longitude=106.660172&radius=3"
```

### Get Active Bookings

```bash
curl -X GET http://localhost:3002/booking/active \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Rate Completed Trip

```bash
curl -X PATCH http://localhost:3002/trips/65f123456789abcdef012345/rating \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer PASSENGER_JWT_TOKEN" \
  -d '{
    "rating": 5,
    "comment": "Excellent service, very professional driver!"
  }'
```

### Cancel Trip

```bash
curl -X DELETE http://localhost:3002/trips/65f123456789abcdef012345 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# OR with reason
curl -X PATCH http://localhost:3002/trips/65f123456789abcdef012345/cancel \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "reason": "Emergency came up"
  }'
```

### Get Trip History

```bash
curl -X GET "http://localhost:3002/trips?page=1&limit=5&status=COMPLETED" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get Surge Pricing Info

```bash
curl -X GET "http://localhost:3002/booking/surge?latitude=10.762622&longitude=106.660172"
```

## Trip State Lifecycle

```
REQUESTED → SEARCHING → ACCEPTED → DRIVER_ARRIVING → PICKED_UP → IN_PROGRESS → COMPLETED
     ↓           ↓          ↓             ↓              ↓            ↓
  CANCELLED  CANCELLED  CANCELLED    CANCELLED      CANCELLED    CANCELLED
```

### State Descriptions

- **REQUESTED**: Trip just created, initializing
- **SEARCHING**: Looking for available drivers
- **ACCEPTED**: Driver accepted the trip
- **DRIVER_ARRIVING**: Driver on the way to pickup location
- **PICKED_UP**: Driver arrived, passenger picked up
- **IN_PROGRESS**: Trip started, en route to destination
- **COMPLETED**: Trip finished successfully
- **CANCELLED**: Trip cancelled by passenger, driver, or system

## Fare Calculation Logic

### Base Fare Formula

```
Base Fare = BASE_PRICE + (distance_km × PRICE_PER_KM)
```

### Default Pricing (configurable)

- **Base Price**: 5,000 VND
- **Price per KM**: 12,000 VND
- **Minimum Fare**: 15,000 VND
- **Maximum Fare**: 500,000 VND

### Surge Pricing Rules

- **Peak Hours** (7-9 AM, 5-8 PM): 1.5x multiplier
- **Weekend Nights** (Fri-Sun, 6-11 PM): 1.3x multiplier
- **Late Night** (10 PM - 6 AM): 1.2x multiplier
- **High Demand Areas**: Dynamic multiplier based on supply/demand

## Real-time Features

### WebSocket Notifications

Trip Service sends real-time notifications for:

- **Trip Status Updates**: Status changes, driver location
- **Driver Matching**: When drivers are found and notified
- **Driver Acceptance**: When a driver accepts the trip
- **Location Updates**: Real-time driver location during trip
- **Trip Completion**: Fare calculation and rating request

### State Management

- **Automatic Timeouts**: Trips auto-cancel if no driver accepts
- **State Validation**: Prevents invalid state transitions
- **Recovery Logic**: Handles service failures gracefully
- **Event Logging**: All state changes logged for debugging

## Data Validation Rules

### Location Data

- **Address**: 5-500 characters, sanitized for XSS
- **Latitude**: -90 to 90 degrees
- **Longitude**: -180 to 180 degrees
- **Coordinates**: Up to 6 decimal places precision

### Trip Parameters

- **Rating**: 1-5 stars (integer)
- **Comment**: Max 500 characters, sanitized
- **Fare**: Non-negative numbers only
- **Trip ID**: Valid MongoDB ObjectId format

### Pagination

- **Page**: Minimum 1
- **Limit**: 1-100 items per page
- **Date Ranges**: End date must be after start date

## Authentication & Authorization

### Endpoint Access Control

**Passenger Only:**

- `POST /trips` (create trip)
- `POST /booking/request` (create booking)
- `PATCH /trips/:id/rating` (rate trip)

**Driver Only:**

- `PATCH /trips/:id/accept` (accept trip)

**Trip Participants Only:**

- `GET /trips/:id` (view trip details)
- `PATCH /trips/:id/status` (update status)
- `DELETE /trips/:id` (cancel trip)
- `PATCH /trips/:id/cancel` (cancel with reason)

**Public Endpoints:**

- `POST /booking/estimate` (fare estimate - optional auth)
- `GET /booking/availability` (driver availability - optional auth)
- `GET /booking/surge` (surge pricing info)

**Internal Service:**

- `POST /drivers/location/sync`
- `POST /drivers/sync-all`
- `GET /drivers/nearby`

### Token Requirements

- **JWT Token**: Required for authenticated endpoints
- **User Role Validation**: Enforced based on endpoint requirements
- **Trip Ownership**: Users can only access their own trips
- **Service-to-Service**: Internal endpoints called by other services

## Error Handling

### Common Error Codes

- `400`: Bad request (validation failed, invalid coordinates)
- `401`: Unauthorized (invalid/missing token)
- `403`: Forbidden (insufficient permissions, wrong user role)
- `404`: Not found (trip doesn't exist, no drivers available)
- `409`: Conflict (invalid state transition, trip already accepted)
- `500`: Internal server error

### Specific Error Scenarios

**No Drivers Available:**

```json
{
  "success": false,
  "error": "No drivers available",
  "message": "No drivers found in your area. Please try again later.",
  "tripId": "65f123456789abcdef012345",
  "searchRadius": 5
}
```

**Invalid State Transition:**

```json
{
  "success": false,
  "error": "Invalid status transition",
  "message": "Cannot transition from COMPLETED to IN_PROGRESS",
  "currentStatus": "COMPLETED",
  "validTransitions": ["CANCELLED"]
}
```

**Trip Already Accepted:**

```json
{
  "success": false,
  "error": "Trip already accepted",
  "message": "This trip has already been accepted by another driver"
}
```

## Performance Considerations

### Response Time Targets

- **Create Trip**: < 5s (includes driver matching)
- **Fare Estimate**: < 1s (calculation only)
- **Driver Availability**: < 2s (Redis geospatial query)
- **Status Updates**: < 500ms (Redis + WebSocket)
- **Trip History**: < 1s (paginated queries)

### Scalability Features

- **Redis Caching**: Driver locations cached for fast matching
- **Asynchronous Processing**: Driver notifications sent async
- **Database Indexing**: Optimized queries on trip status and user IDs
- **Connection Pooling**: Efficient database connections
- **Rate Limiting**: Prevent abuse of estimation APIs

## Environment Variables

```bash
# Service Configuration
NODE_ENV=development
PORT=3002

# Database
MONGODB_URI=mongodb://localhost:27017/uitgo_trips
REDIS_URL=redis://localhost:6379

# Service URLs
USER_SERVICE_URL=http://user-service:3000
DRIVER_SERVICE_URL=http://driver-service:3001

# Fare Calculation
BASE_PRICE=5000
PRICE_PER_KM=12000
MIN_FARE=15000
MAX_FARE=500000
SURGE_MULTIPLIER=1.0

# Trip Configuration
DRIVER_ACCEPTANCE_TIMEOUT=30000
DRIVER_SEARCH_RADIUS=5
MAX_DRIVERS_TO_NOTIFY=5

# WebSocket
WEBSOCKET_ENABLED=true
```

## Integration Notes

- **User Service Integration**: Authentication, user profile data
- **Driver Service Integration**: Real-time driver location updates
- **WebSocket Integration**: Real-time notifications to mobile apps
- **Redis Integration**: Fast geospatial queries and caching
- **MongoDB Integration**: Persistent trip data storage
- **Rate Limiting**: Built-in protection for public endpoints

## Status Codes

- `200`: Success
- `201`: Created successfully (new trip)
- `400`: Bad request (validation error, invalid coordinates)
- `401`: Unauthorized (invalid token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not found (trip/driver not found)
- `409`: Conflict (invalid state transition)
- `500`: Internal server error
