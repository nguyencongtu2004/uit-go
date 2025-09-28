# UIT-Go Test Data Generation Scripts

Tập hợp các PowerShell scripts để tạo test data và authentication tokens cho load testing và development của hệ thống UIT-Go.

## 📋 Scripts Overview

### 1. `create-test-users.ps1` - Bulk User Creation & Token Generation

### 2. `demo-test-data.ps1` - Test Data Usage Demonstration

---

## 🚀 `create-test-users.ps1`

Script chính để tạo users hàng loạt và generate JWT authentication tokens.

### Usage

```powershell
# Tạo với số lượng mặc định (50 passengers, 100 drivers)
.\create-test-users.ps1

# Tùy chỉnh số lượng users
.\create-test-users.ps1 -PassengerCount 25 -DriverCount 50

# Chỉ định URL và thư mục output khác
.\create-test-users.ps1 -BaseUrl "http://user.localhost:81" -OutputDir "./my-test-data"
```

### Parameters

| Parameter        | Default                    | Description                          |
| ---------------- | -------------------------- | ------------------------------------ |
| `PassengerCount` | `50`                       | Số lượng passengers cần tạo          |
| `DriverCount`    | `100`                      | Số lượng drivers cần tạo             |
| `BaseUrl`        | `http://user.localhost:81` | URL của User Service                 |
| `OutputDir`      | `./test-data`              | Thư mục lưu output files             |
| `Password`       | `LoadTest123!`             | Password chung cho tất cả test users |

### What it does

1. **Kiểm tra kết nối** đến User Service
2. **Restart User Service** để enable test endpoints
3. **Tạo passengers** bằng bulk creation API
4. **Tạo drivers** với thông tin vehicle chi tiết
5. **Bulk login** để lấy JWT tokens cho tất cả users
6. **Organize data** theo scenarios (light/medium/heavy load)
7. **Save multiple files** cho các mục đích sử dụng khác nhau

### Output Files

#### `uitgo-test-data.json`

Complete dataset với cấu trúc:

```json
{
  "metadata": {
    "createdAt": "2025-09-28T...",
    "totalUsers": 135,
    "summary": { "passengers": {...}, "drivers": {...} }
  },
  "users": {
    "passengers": [...],
    "drivers": [...]
  },
  "quickAccess": {
    "allTokens": [...],
    "sampleUsers": {...}
  },
  "loadTesting": {
    "scenarios": {
      "lightLoad": {...},
      "mediumLoad": {...},
      "heavyLoad": {...}
    }
  }
}
```

#### `tokens-only.json`

Quick access file chỉ chứa tokens:

```json
{
  "allTokens": ["jwt1", "jwt2", ...],
  "passengerTokens": ["jwt1", ...],
  "driverTokens": ["jwt2", ...],
  "sampleUsers": {
    "samplePassenger": {...},
    "sampleDriver": {...}
  }
}
```

#### `load-test-config.json`

Configuration cho load testing tools (k6, Artillery):

```json
{
  "baseUrls": {
    "userService": "http://user.localhost:81",
    "driverService": "http://driver.localhost:81",
    "tripService": "http://trip.localhost:81"
  },
  "testUsers": {
    "light": { "passengers": 10, "drivers": 20 },
    "heavy": { "passengers": 45, "drivers": 90 }
  },
  "k6Config": {
    "scenarios": {...}
  }
}
```

### Example Output

```
=== UIT-Go Mass User & Token Generator ===
Creating 50 passengers and 100 drivers...

[OK] User Service is healthy: OK
STEP 1: Creating passengers...
  [OK] Created: 45, Skipped: 5, Errors: 0
STEP 2: Creating drivers...
  [OK] Created: 90, Skipped: 10, Errors: 0
STEP 4: Performing bulk login to retrieve tokens...
  [COMPLETE] Total tokens retrieved: 135

=== CREATION SUMMARY ===
  Total Users Created: 135
  Passengers: 45/50
  Drivers: 90/100
```

---

## 🎯 `demo-test-data.ps1`

Script demo để show cách sử dụng test data đã được tạo.

### Usage

```powershell
# Chạy demo với data directory mặc định
.\demo-test-data.ps1

# Chỉ định data directory khác
.\demo-test-data.ps1 -DataDir "./my-test-data"
```

### Parameters

| Parameter | Default       | Description                  |
| --------- | ------------- | ---------------------------- |
| `DataDir` | `./test-data` | Thư mục chứa test data files |

### What it demonstrates

1. **Loading test data** từ JSON files
2. **Passenger authentication** testing
3. **Driver authentication** với Driver Service endpoints
4. **Batch API testing** với multiple locations
5. **Available load test scenarios**
6. **Configuration examples** for load testing

### Example Output

```
=== UIT-Go Test Data Usage Demo ===

Test data loaded successfully:
  Total Users: 135
  Passengers: 45
  Drivers: 90

=== DEMO 1: Testing Passenger Authentication ===
[OK] Passenger can access location stats: 0 drivers

=== DEMO 2: Testing Driver Authentication ===
[OK] Driver status retrieved: OFFLINE
[OK] Location stats retrieved: 0 online drivers

=== DEMO 3: Batch API Testing ===
[OK] Batch nearby search completed:
    Total queries: 3
    Results processed: 3
```

---

## 🔧 Prerequisites

### Services Required

- **User Service** running at `http://user.localhost:81`
- **Driver Service** running at `http://driver.localhost:81`
- **MongoDB** với appropriate databases
- **Traefik** configured với rate limiting disabled (for bulk operations)

### PowerShell Requirements

- PowerShell 5.1+ hoặc PowerShell Core
- `Invoke-RestMethod` cmdlet available
- JSON conversion cmdlets (`ConvertTo-Json`, `ConvertFrom-Json`)

---

## 📖 Usage Patterns

### 1. Quick Setup for Development

```powershell
# Tạo small dataset cho development
.\create-test-users.ps1 -PassengerCount 5 -DriverCount 10

# Test authentication
.\demo-test-data.ps1
```

### 2. Load Testing Preparation

```powershell
# Tạo large dataset
.\create-test-users.ps1 -PassengerCount 100 -DriverCount 200

# Load tokens cho testing
$tokens = Get-Content "./test-data/tokens-only.json" | ConvertFrom-Json
$driverToken = $tokens.driverTokens[0]

# Use trong API calls
Invoke-RestMethod -Uri "http://driver.localhost:81/location/stats" `
  -Headers @{Authorization="Bearer $driverToken"}
```

### 3. Integration Testing

```powershell
# Load complete dataset
$data = Get-Content "./test-data/uitgo-test-data.json" | ConvertFrom-Json

# Get specific scenario
$lightLoadDrivers = $data.loadTesting.scenarios.lightLoad.drivers
$heavyLoadPassengers = $data.loadTesting.scenarios.heavyLoad.passengers
```

---

## 🐛 Troubleshooting

### Common Issues

#### "User Service not healthy"

```
[ERROR] Cannot connect to User Service at http://user.localhost:81
```

**Solution:** Ensure User Service is running và accessible via Traefik

#### "Too many requests" errors

```
[ERROR] The remote server returned an error: (429) Too Many Requests
```

**Solution:** Rate limiting is enabled. Comment out rate-limit middleware in Traefik config

#### "No tokens were generated"

```
WARNING! No tokens were generated.
```

**Solutions:**

- Check User Service logs for authentication errors
- Verify bulk-login endpoint is available (development mode)
- Ensure users were created successfully in Step 1-2

#### PowerShell execution policy

```
cannot be loaded because running scripts is disabled on this system
```

**Solution:**

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## 💡 Tips & Best Practices

### Performance Optimization

- Start with **small numbers** (5-10 users) để test
- Scale up gradually để avoid overwhelming services
- Use **batch processing** built into scripts
- Monitor **MongoDB và Redis** resource usage

### Data Management

- **Clean old test data** trước khi tạo new dataset:
  ```powershell
  # Sử dụng User Service clean endpoint
  Invoke-RestMethod -Uri "http://user.localhost:81/test/clean-test-data" `
    -Method DELETE -Body '{"confirm": true}' -ContentType "application/json"
  ```

### Authentication Best Practices

- **Tokens expire** trong 24h (mặc định)
- **Regenerate tokens** khi cần cho long-running tests
- **Use different passwords** cho production vs test environments

---

## 🔗 Related Files

- `services/user-service/src/controllers/testController.js` - Bulk creation logic
- `services/user-service/src/routes/test.js` - Test endpoints
- `services/driver-service/src/middlewares/auth.js` - Authentication middleware
- `config/traefik/dynamic/middlewares.yml` - Rate limiting configuration

---

## 📝 Notes

- Scripts được designed cho **development và testing** purposes
- **Không sử dụng trong production** với real user data
- Test endpoints chỉ available khi `NODE_ENV !== 'production'`
- All test users có email domain `@uitgo-load.test` để dễ identify và cleanup
