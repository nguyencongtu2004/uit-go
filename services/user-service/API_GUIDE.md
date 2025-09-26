# UIT-Go User Service - API Testing Guide

## Overview

User Service cung cấp các API để đăng ký, đăng nhập và quản lý người dùng (passenger và driver) trong hệ thống UIT-Go.

Base URL: `http://localhost:3000`

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

### 6. Verify Token

```bash
GET /api/auth/verify
Authorization: Bearer YOUR_JWT_TOKEN
```

## User Management APIs

### 1. Get All Users

```bash
GET /api/users?page=1&limit=10&role=DRIVER&isOnline=true
Authorization: Bearer YOUR_JWT_TOKEN
```

### 2. Get Available Drivers

```bash
GET /api/users/drivers/available?lat=10.762622&lng=106.660172&radius=5000&vehicleType=CAR_4_SEAT
Authorization: Bearer YOUR_JWT_TOKEN
```

### 3. Update User Profile

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
      "color": "Blue"
    }
  }
}
```

### 4. Update Location

```bash
PUT /api/users/{userId}/location
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "coordinates": [106.660172, 10.762622],
  "address": "268 Lý Thường Kiệt, Phường 14, Quận 10, Thành phố Hồ Chí Minh"
}
```

### 5. Update Driver Status

```bash
PUT /api/users/{userId}/driver-status
Authorization: Bearer YOUR_JWT_TOKEN (DRIVER role only)
Content-Type: application/json

{
  "driverStatus": "AVAILABLE"
}
```

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

## Status Codes

- `200`: Success
- `201`: Created successfully
- `400`: Bad request (validation error)
- `401`: Unauthorized (invalid token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not found
- `429`: Too many requests (rate limited)
- `500`: Internal server error

## Notes

- Tất cả API yêu cầu authentication (trừ register và login) phải có header: `Authorization: Bearer <JWT_TOKEN>`
- Driver chỉ có thể update driver-specific fields
- User chỉ có thể access/update profile của chính mình (trừ admin)
- Rate limiting được áp dụng cho auth endpoints
- Password phải có ít nhất 6 ký tự, bao gồm chữ hoa, chữ thường và số
