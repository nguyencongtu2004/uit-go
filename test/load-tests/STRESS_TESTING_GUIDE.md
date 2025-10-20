# 🚀 UIT-GO Stress Testing Guide

Complete guide for load testing the UIT-GO microservices platform using k6.

## 📋 Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Available Tests](#available-tests)
- [Running Tests](#running-tests)
- [Understanding Results](#understanding-results)
- [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

This stress testing suite is designed to validate the performance and reliability of the UIT-GO platform under various load conditions. Tests range from simple infrastructure checks to extended high-load scenarios.

### Test Coverage

- **Health Endpoint Testing**: Verify all services respond correctly under load
- **Response Time Analysis**: Measure p50, p90, p95, p99 latencies
- **Throughput Testing**: Validate requests/second capabilities
- **Error Rate Monitoring**: Track failures across services

---

## ✅ Prerequisites

### 1. Install k6

**Windows (Chocolatey):**
```powershell
choco install k6
```

**Windows (Manual):**
Download from https://k6.io/docs/getting-started/installation/

Verify installation:
```powershell
k6 version
```

### 2. Ensure Services are Running

Start all UIT-GO services:
```powershell
docker compose up -d
```

Verify health:
```powershell
curl http://user.localhost:81/health
curl http://driver.localhost:81/health
curl http://trip.localhost:81/health
```

### 3. Fix DNS (First Time Only)

Run the DNS fix script:
```powershell
.\test\load-tests\fix-localhost-dns.ps1
```

This adds `.localhost` domain entries to your Windows hosts file.

---

## 🚀 Quick Start

### Option 1: Run Quick Test (2 minutes)

```powershell
.\test\load-tests\run-stress-tests.ps1 -Quick
```

### Option 2: Run Extended Test (5 minutes)

```powershell
.\test\load-tests\run-stress-tests.ps1 -Extended
```

### Option 3: Run Full Test Suite

```powershell
.\test\load-tests\run-stress-tests.ps1 -All
```

---

## 📊 Available Tests

### 1. Simple Infrastructure Test

**File**: `k6-simple-test.js`  
**Duration**: 10 seconds  
**Load**: 10 concurrent users  
**Purpose**: Basic connectivity and routing validation

```powershell
k6 run test\load-tests\k6-simple-test.js
```

**Expected Results:**
- ✅ All requests return 200 OK
- ✅ Response time < 50ms
- ✅ 0% error rate

---

### 2. Short Stress Test

**File**: `k6-stress-short.js`  
**Duration**: 2 minutes  
**Load**: 50 → 200 users  
**Purpose**: Moderate load testing of health endpoints

**Load Profile:**
```
0-20s:   Warm up to 50 users
20-60s:  Ramp to 200 users
60-100s: Hold at 200 users
100-120s: Cool down
```

```powershell
k6 run test\load-tests\k6-stress-short.js
```

**Performance Targets:**
- ✅ p95 < 200ms
- ✅ p99 < 500ms
- ✅ Success rate > 95%
- ✅ Error rate < 5%

**Recent Results:**
- **Total Requests**: 73,668
- **Throughput**: 613 req/sec
- **Success Rate**: 97.59%
- **p95 Response**: 176.87ms ✅

---

### 3. Extended Stress Test

**File**: `k6-stress-extended.js`  
**Duration**: 5 minutes  
**Load**: 100 → 500 users  
**Purpose**: High-load endurance testing

**Load Profile:**
```
0-30s:   Warm up to 100 users
30-90s:  Ramp to 300 users
90-210s: Aggressive ramp to 500 users
210-270s: Hold at 500 users (peak)
270-300s: Cool down
```

```powershell
k6 run test\load-tests\k6-stress-extended.js
```

**Performance Targets:**
- ✅ p95 < 300ms (relaxed for high load)
- ✅ p99 < 1000ms
- ✅ Success rate > 90%
- ✅ Error rate < 10%

**Output**: Generates both JSON and HTML reports

---

## 📈 Understanding Results

### Console Output

```
📊 TEST OVERVIEW
----------------------------------------------------------------------
Duration: 120.11s
Total Requests: 73,668
Success Rate: 97.59%
Failed Requests: 0
Errors: 1776

⚡ PERFORMANCE METRICS
----------------------------------------------------------------------
Avg Response Time: 43.79ms
Min Response Time: 1.07ms
Max Response Time: 4136.94ms
Median (p50): 16.60ms
p90: 130.22ms
p95: 176.87ms

🚀 THROUGHPUT
----------------------------------------------------------------------
Requests/sec: 613.33
Data Received: 51.91 MB
Data Sent: 5731.33 KB

🎯 THRESHOLD STATUS
----------------------------------------------------------------------
✅ p95 < 200ms
✅ p99 < 500ms
✅ Success rate > 95%
✅ Error rate < 5%
```

### Key Metrics Explained

| Metric | Description | Good Value |
|--------|-------------|------------|
| **Total Requests** | Total HTTP requests made | Higher is better |
| **Success Rate** | % of requests with status 200 | > 95% |
| **Throughput** | Requests per second | Depends on hardware |
| **p50 (Median)** | 50% of requests faster than this | < 50ms |
| **p95** | 95% of requests faster than this | < 200ms |
| **p99** | 99% of requests faster than this | < 500ms |

### Result Files

All test results are saved to `test/load-tests/results/`:

- **JSON Files**: Raw metrics data for analysis
- **HTML Reports**: Visual dashboards (extended test only)
- **Summary Files**: Text summaries of test runs

---

## 🔍 Service-Level Analysis

### Per-Service Breakdown

Each test measures performance for all three services:

#### User Service
- Handles authentication and user management
- Typically shows highest response times due to MongoDB queries
- Target: < 200ms p95

#### Driver Service
- Manages driver locations and status
- Heaviest load service (location updates)
- Target: < 100ms p95

#### Trip Service
- Orchestrates trip booking logic
- Moderate complexity
- Target: < 150ms p95

---

## 🛠️ Troubleshooting

### Issue: DNS Resolution Fails

**Symptom**: `Failed to resolve host` errors

**Solution**:
```powershell
.\test\load-tests\fix-localhost-dns.ps1
ping user.localhost  # Should resolve to 127.0.0.1
```

---

### Issue: Services Return 502 Bad Gateway

**Symptom**: All requests fail with 502 status

**Solution**:
1. Check if services are running:
   ```powershell
   docker compose ps
   ```

2. Restart services:
   ```powershell
   docker compose restart
   ```

3. Check service logs:
   ```powershell
   docker compose logs user-service
   docker compose logs driver-service
   docker compose logs trip-service
   ```

---

### Issue: High Response Times

**Symptom**: p95 > 500ms, many timeouts

**Possible Causes:**
1. **MongoDB overloaded**: Check `docker compose logs mongodb`
2. **Redis connection issues**: Check `docker compose logs redis`
3. **Insufficient resources**: Increase Docker CPU/memory limits

**Solutions:**
- Scale down test load (reduce VUs)
- Add more MongoDB replicas
- Increase Docker resource limits

---

### Issue: k6 Crashes or Hangs

**Symptom**: k6 process stops responding

**Solution**:
1. Reduce concurrent users (VUs)
2. Increase test duration (slower ramp-up)
3. Check system resources (Task Manager)

---

## 📊 Advanced Usage

### Custom Test Duration

Edit the `stages` array in any test file:

```javascript
export const options = {
  stages: [
    { duration: '1m', target: 100 },   // Your custom profile
    { duration: '5m', target: 500 },
    { duration: '1m', target: 0 },
  ],
};
```

### Custom Thresholds

Adjust pass/fail criteria:

```javascript
thresholds: {
  http_req_duration: ['p(95)<100', 'p(99)<300'],  // Stricter
  success_rate: ['rate>0.99'],                     // Higher bar
  http_req_failed: ['rate<0.01'],                  // Lower tolerance
},
```

### Running Specific Scenarios

Use k6 scenario selectors:

```powershell
k6 run --scenarios my_scenario test\load-tests\k6-stress-extended.js
```

---

## 📈 Performance Benchmarks

### Current Production Targets

| Metric | Target | Achieved (2min test) | Status |
|--------|--------|---------------------|--------|
| Throughput | 500 req/s | 613 req/s | ✅ PASS |
| p95 Latency | < 200ms | 176.87ms | ✅ PASS |
| Success Rate | > 95% | 97.59% | ✅ PASS |
| Concurrent Users | 200 | 200 | ✅ PASS |

### Stress Test Objectives

Based on UIT-GO requirements:

1. **Location Updates**: 1,000 drivers × 6 updates/min = 100 updates/sec
2. **Trip Bookings**: 100 concurrent trips/min
3. **System Availability**: 99.9% uptime (< 0.1% errors)

---

## 🎯 Next Steps

### Recommended Testing Progression

1. ✅ **Simple Test** - Verify infrastructure (COMPLETED)
2. ✅ **Short Stress Test** - Moderate load (COMPLETED)
3. ⏳ **Extended Stress Test** - High load (PENDING)
4. ⏳ **Authenticated Tests** - Real user flows (PENDING)
5. ⏳ **Location Update Test** - Driver GPS stress (PENDING)
6. ⏳ **Trip Booking Test** - End-to-end flow (PENDING)

### Future Enhancements

- [ ] Authenticated load testing with JWT tokens
- [ ] WebSocket stress testing for real-time updates
- [ ] Database connection pool tuning
- [ ] Kafka message queue stress testing
- [ ] Geographic location spread testing

---

## 📞 Support

For issues or questions:

1. Check `STRESS_TEST_REPORT.md` for detailed analysis
2. Review `test/load-tests/results/` for raw data
3. Check Docker logs: `docker compose logs`

---

## 📄 Related Documentation

- [Load Testing Implementation Summary](IMPLEMENTATION_SUMMARY.md)
- [Stress Test Report](STRESS_TEST_REPORT.md)
- [UIT-GO Architecture](../../.github/instructions/uit-go-overview.instructions.md)

---

*Last Updated: October 20, 2025*  
*k6 Version: 1.3.0*  
*Test Suite Version: 1.0.0*
