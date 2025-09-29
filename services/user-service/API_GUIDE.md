# UIT-Go User Service - API Testing Guide

## Overview

User Service cung cấp các API để đăng ký, đăng nhập và quản lý người dùng (passenger và driver) trong hệ thống UIT-Go.

Base URL: `http://localhost:3000`

## Service Information

### Get Service Info

```bash
GET /api/auth
GET /api/users
```

Trả về thông tin về service và danh sách các endpoints có sẵn.

## Authentication APIs

### 1. Register User

```bash
# Register Passenger
POST /api/auth/register
Content-Type: application/json

{
  "email": "passenger@example.com",
  "password": "Password123",
  "fullName": "John Doe",
  "phoneNumber": "0901234567",
  "role": "PASSENGER"
}

# Register Driver
POST /api/auth/register
Content-Type: application/json

{
  "email": "driver@example.com",
  "password": "Password123",
  "fullName": "Jane Driver",
  "phoneNumber": "0907654321",
  "role": "DRIVER",
  "driverInfo": {
    "vehicle": {
      "licensePlate": "51A-12345",
      "make": "Toyota",
      "model": "Camry",
      "year": 2022,
      "color": "White",
      "vehicleType": "CAR_4_SEAT"
    }
  }
}
```

### 2. Login User

```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "passenger@example.com",
  "password": "Password123"
}
```

### 3. Get Profile

```bash
GET /api/auth/profile
Authorization: Bearer YOUR_JWT_TOKEN
```

### 4. Logout

```bash
POST /api/auth/logout
Authorization: Bearer YOUR_JWT_TOKEN
```

### 5. Change Password

```bash
PUT /api/auth/change-password
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "currentPassword": "Password123",
  "newPassword": "NewPassword123"
}
```

### 6. Verify Token for Services

```bash
POST /api/auth/verify-service
Content-Type: application/json

{
  "token": "YOUR_JWT_TOKEN_HERE"
}
```

Endpoint dành cho service-to-service communication để verify JWT token.

### 7. Verify Token

```bash
GET /api/auth/verify
Authorization: Bearer YOUR_JWT_TOKEN
```

Verify JWT token và trả về user info.

## User Management APIs

### 1. Get All Users

```bash
GET /api/users?page=1&limit=10&role=DRIVER&isOnline=true&sortBy=createdAt&sortOrder=desc
Authorization: Bearer YOUR_JWT_TOKEN
```

Query parameters:

- `page`: Số trang (default: 1)
- `limit`: Số item mỗi trang (default: 10, max: 100)
- `role`: Filter theo role (`PASSENGER`, `DRIVER`)
- `isOnline`: Filter theo trạng thái online (`true`, `false`)
- `sortBy`: Sắp xếp theo field (`createdAt`, `rating`, `totalTrips`)
- `sortOrder`: Thứ tự sắp xếp (`asc`, `desc`)

### 2. Get User by ID

```bash
GET /api/users/{userId}
Authorization: Bearer YOUR_JWT_TOKEN
```

### 3. Get Available Drivers

```bash
GET /api/users/drivers/available?lat=10.762622&lng=106.660172&radius=5000&vehicleType=CAR_4_SEAT
Authorization: Bearer YOUR_JWT_TOKEN
```

Query parameters:

- `lat`: Latitude của vị trí tìm kiếm
- `lng`: Longitude của vị trí tìm kiếm
- `radius`: Bán kính tìm kiếm (meters), default: 5000
- `vehicleType`: Loại xe (`MOTORBIKE`, `CAR_4_SEAT`, `CAR_7_SEAT`)

### 4. Update User Profile

```bash
PUT /api/users/{userId}
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "fullName": "Updated Name",
  "phoneNumber": "0909999999",
  "driverInfo": {
    "vehicle": {
      "licensePlate": "51B-99999",
      "color": "Blue",
      "make": "Honda",
      "model": "City",
      "year": 2023,
      "vehicleType": "CAR_4_SEAT"
    }
  },
  "deviceInfo": {
    "fcmToken": "firebase-token-here",
    "deviceId": "device-id-123",
    "platform": "WEB"
  }
}
```

### 5. Update Location

```bash
PUT /api/users/{userId}/location
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "coordinates": [106.660172, 10.762622],
  "address": "268 Lý Thường Kiệt, Phường 14, Quận 10, Thành phố Hồ Chí Minh"
}
```

Location coordinates format: `[longitude, latitude]`

### 4. Update Driver Status

```bash
PUT /api/users/{userId}/driver-status
Authorization: Bearer YOUR_JWT_TOKEN (DRIVER role only)
Content-Type: application/json

{
  "driverStatus": "AVAILABLE"
}
```

Driver status values: `OFFLINE`, `AVAILABLE`, `BUSY`, `IN_TRIP`

### 5. Delete User (Soft Delete)

```bash
DELETE /api/users/{userId}
Authorization: Bearer YOUR_JWT_TOKEN
```

Vô hiệu hóa tài khoản người dùng (soft delete). Chỉ user có thể delete chính tài khoản của mình.

## Testing & Development APIs

### 1. Bulk Create Users

```bash
POST /api/test/bulk-create-users
Content-Type: application/json

{
  "users": [
    {
      "email": "test1@example.com",
      "password": "Password123",
      "fullName": "Test User 1",
      "phoneNumber": "0901111111",
      "role": "PASSENGER"
    },
    {
      "email": "test2@example.com",
      "password": "Password123",
      "fullName": "Test Driver 1",
      "phoneNumber": "0902222222",
      "role": "DRIVER",
      "driverInfo": {
        "vehicle": {
          "licensePlate": "51A-11111",
          "make": "Toyota",
          "model": "Camry",
          "year": 2023,
          "color": "White",
          "vehicleType": "CAR_4_SEAT"
        }
      }
    }
  ],
  "skipExisting": true
}
```

### 2. Bulk Login Users

```bash
POST /api/test/bulk-login
Content-Type: application/json

{
  "credentials": [
    {
      "email": "test1@example.com",
      "password": "Password123"
    },
    {
      "email": "test2@example.com",
      "password": "Password123"
    }
  ]
}
```

### 3. Generate Test Data

```bash
POST /api/test/generate-test-data
Content-Type: application/json

{
  "passengerCount": 50,
  "driverCount": 100
}
```

Tự động tạo dữ liệu test với số lượng passengers và drivers được chỉ định.

### 4. Clean Test Data

```bash
DELETE /api/test/clean-test-data
Content-Type: application/json

{
  "confirm": true
}
```

Xóa tất cả dữ liệu test (chỉ hoạt động trong development mode).

### 5. Get Test Statistics

```bash
GET /api/test/stats
```

Lấy thống kê về dữ liệu test đang có trong hệ thống.

## cURL Examples

## cURL Examples

### Register Driver

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testdriver@uitgo.com",
    "password": "TestPass123",
    "fullName": "Test Driver",
    "phoneNumber": "0901111111",
    "role": "DRIVER",
    "driverInfo": {
      "vehicle": {
        "licensePlate": "51A-99999",
        "make": "Honda",
        "model": "City",
        "year": 2023,
        "color": "Silver",
        "vehicleType": "CAR_4_SEAT"
      }
    }
  }'
```

### Register Passenger

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testpassenger@uitgo.com",
    "password": "TestPass123",
    "fullName": "Test Passenger",
    "phoneNumber": "0902222222",
    "role": "PASSENGER"
  }'
```

### Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testdriver@uitgo.com",
    "password": "TestPass123"
  }'
```

### Get Profile

```bash
curl -X GET http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

### Update Driver Status to AVAILABLE

```bash
curl -X PUT http://localhost:3000/api/users/{userId}/driver-status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "driverStatus": "AVAILABLE"
  }'
```

### Update Location

```bash
curl -X PUT http://localhost:3000/api/users/{userId}/location \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "coordinates": [106.660172, 10.762622],
    "address": "268 Lý Thường Kiệt, Quận 10, TPHCM"
  }'
```

### Get Available Drivers

```bash
curl -X GET "http://localhost:3000/api/users/drivers/available?lat=10.762622&lng=106.660172&radius=5000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

### Create Test Users in Bulk

```bash
curl -X POST http://localhost:3000/api/test/bulk-create-users \
  -H "Content-Type: application/json" \
  -d '{
    "users": [
      {
        "email": "driver1@test.uit-go.com",
        "password": "password123",
        "fullName": "Test Driver 1",
        "phoneNumber": "0901111111",
        "role": "DRIVER",
        "driverInfo": {
          "vehicle": {
            "licensePlate": "51A-11111",
            "make": "Toyota",
            "model": "Camry",
            "year": 2023,
            "color": "White",
            "vehicleType": "CAR_4_SEAT"
          }
        }
      },
      {
        "email": "passenger1@test.uit-go.com",
        "password": "password123",
        "fullName": "Test Passenger 1",
        "phoneNumber": "0902222222",
        "role": "PASSENGER"
      }
    ],
    "skipExisting": true
  }'
```

### Generate Test Data

```bash
curl -X POST http://localhost:3000/api/test/generate-test-data \
  -H "Content-Type: application/json" \
  -d '{
    "passengerCount": 50,
    "driverCount": 100
  }'
```

### Verify Token (Service-to-Service)

```bash
curl -X POST http://localhost:3000/api/auth/verify-service \
  -H "Content-Type: application/json" \
  -d '{
    "token": "YOUR_JWT_TOKEN_HERE"
  }'
```

## Response Format

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

### Error Response

```json
{
  "success": false,
  "error": "Error type",
  "message": "Detailed error message",
  "details": [
    // Additional error details if applicable
  ]
}
```

## Important Notes

- **Authentication**: Tất cả API (trừ register, login, service info) yêu cầu header: `Authorization: Bearer <JWT_TOKEN>`
- **Ownership**: User chỉ có thể access/update profile của chính mình (trừ admin)
- **Driver-only APIs**: Chỉ drivers mới có thể update driver status và vehicle info
- **Test APIs**: Các endpoint `/api/test/*` chỉ dành cho development và testing
- **Location Sync**: Driver location được đồng bộ với Trip Service khi update status
- **Geospatial Queries**: Sử dụng MongoDB's geospatial indexing cho location-based searches
- **Soft Delete**: Delete user chỉ vô hiệu hóa tài khoản, không xóa khỏi database

## Environment Variables

```bash
# JWT Configuration
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=24h

# Database
MONGODB_URI=mongodb://localhost:27017/uitgo
REDIS_URL=redis://localhost:6379

# Service URLs
TRIP_SERVICE_URL=http://trip-service:3000

# Node Environment
NODE_ENV=development
PORT=3000
```

## Data Validation Rules

### User Registration

- **Email**: Valid email format, unique
- **Password**: Minimum 6 characters, must contain lowercase, uppercase, and number
- **Full Name**: 2-100 characters
- **Phone Number**: Vietnamese format (`+84` or `0` prefix, 9-10 digits)
- **Role**: `PASSENGER` or `DRIVER`
- **Driver Info** (required for DRIVER):
  - **License Plate**: Required
  - **Vehicle Make/Model**: Required
  - **Year**: 1990 to current year
  - **Color**: Required
  - **Vehicle Type**: `MOTORBIKE`, `CAR_4_SEAT`, `CAR_7_SEAT`

### Location Update

- **Coordinates**: Array `[longitude, latitude]`
- **Longitude**: -180 to 180
- **Latitude**: -90 to 90
- **Address**: Optional, max 200 characters

### Driver Status

- Valid values: `OFFLINE`, `AVAILABLE`, `BUSY`, `IN_TRIP`

## Rate Limiting

- **Login**: 5 attempts per 15 minutes per IP
- **Registration**: 3 attempts per hour per IP

## Security Notes

- JWT tokens expire in 24 hours (configurable)
- Passwords are hashed using bcrypt
- Sensitive data excluded from API responses
- CORS enabled for cross-origin requests
- Input validation using Joi schemas
