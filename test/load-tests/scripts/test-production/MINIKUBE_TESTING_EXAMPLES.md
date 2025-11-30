# Ví dụ Kết Quả Test Minikube

Đây là ví dụ minh họa output khi chạy test thành công.

## Ví Dụ 1: Health Check Test

### Output Trong Console

```powershell
PS D:\uit-go\test\load-tests> .\run-minikube-tests.ps1 -Health

==============================================================
  UIT-GO Minikube Load Testing Suite
==============================================================

Checking k6 installation...
✅ k6 is installed: k6 v0.47.0

Checking port-forward connections...
  ✅ User Service (port 83)
  ✅ Trip Service (port 82)
  ✅ Traefik (port 8080)

==============================================================
  Running Minikube Health Check Test (2 minutes)
==============================================================

=== K6 Minikube Health Test Setup ===
Testing port-forwarded services:
  - User Service: http://localhost:83
  - Trip Service: http://localhost:82
  - Traefik: http://localhost:8080

User Service: ✅ OK (200)
Trip Service: ✅ OK (200)
Traefik Dashboard: ✅ OK (200)

          /\      |‾‾| /‾‾/   /‾‾/   
     /\  /  \     |  |/  /   /  /    
    /  \/    \    |     (   /   ‾‾\  
   /          \   |  |\  \ |  (‾)  | 
  / __________ \  |__| \__\ \_____/ .io

  execution: local
     script: .\k6-minikube-health.js
     output: -

  scenarios: (100.00%) 1 scenario, 50 max VUs, 2m30s max duration (incl. graceful stop):
           * default: Up to 50 looping VUs for 2m0s over 3 stages (gracefulRampDown: 30s, gracefulStop: 30s)


     ✓ status is 200
     ✓ response time < 300ms
     ✓ has response body

     checks.........................: 100.00% ✓ 8532      ✗ 0    
     data_received..................: 2.5 MB  21 kB/s
     data_sent......................: 1.2 MB  10 kB/s
     error_count....................: 0       0/s
     health_check_duration..........: avg=42.15ms  min=8.23ms   med=38.67ms  max=287.45ms p(90)=76.89ms  p(95)=98.12ms 
     http_req_blocked...............: avg=4.21µs   min=0s       med=0s       max=12.15ms  p(90)=0s       p(95)=0s      
     http_req_connecting............: avg=1.89µs   min=0s       med=0s       max=6.73ms   p(90)=0s       p(95)=0s      
     http_req_duration..............: avg=42.23ms  min=8.34ms   med=38.78ms  max=287.56ms p(90)=76.95ms  p(95)=98.23ms 
       { expected_response:true }...: avg=42.23ms  min=8.34ms   med=38.78ms  max=287.56ms p(90)=76.95ms  p(95)=98.23ms 
     http_req_failed................: 0.00%   ✓ 0         ✗ 8532 
     http_req_receiving.............: avg=189.34µs min=0s       med=0s       max=8.45ms   p(90)=501.2µs  p(95)=901.5µs 
     http_req_sending...............: avg=56.78µs  min=0s       med=0s       max=3.21ms   p(90)=0s       p(95)=234.6µs 
     http_req_tls_handshaking.......: avg=0s       min=0s       med=0s       max=0s       p(90)=0s       p(95)=0s      
     http_req_waiting...............: avg=41.98ms  min=8.12ms   med=38.56ms  max=286.34ms p(90)=76.67ms  p(95)=97.89ms 
     http_reqs......................: 8532    71.1/s
     iteration_duration.............: avg=1.12s    min=1.01s    med=1.11s    max=1.29s    p(90)=1.17s    p(95)=1.19s   
     iterations.....................: 2844    23.7/s
     success_rate...................: 100.00% ✓ 8532      ✗ 0    
     vus............................: 1       min=1       max=50 
     vus_max........................: 50      min=50      max=50 


=== K6 Minikube Health Test Teardown ===
Test completed

✅ Health check test completed successfully!

==============================================================
  📊 TEST RESULTS SUMMARY
==============================================================

📋 OVERVIEW
  Duration:        120.34s
  Total Requests:  8532
  Success Rate:    100%              (XANH LÁ - Tốt!)
  Failed Requests: 0
  Errors:          0

⚡ PERFORMANCE
  Avg Response:    42.23ms
  Min Response:    8.34ms
  Max Response:    287.56ms
  Median (p50):    38.78ms
  p95:             98.23ms           (XANH LÁ - Đạt < 300ms)
  p99:             156.78ms          (XANH LÁ - Đạt < 600ms)

🚀 THROUGHPUT
  Requests/sec:    71.1
  Data Received:   2456.78 KB
  Data Sent:       1234.56 KB

🎯 THRESHOLDS
  ✅ p95 < 300ms                      (PASS)
  ✅ p99 < 600ms                      (PASS)
  ✅ Success rate > 95%               (PASS)

📄 Full results: minikube-health-2025-11-30T14-25-45.json
==============================================================

==============================================================
  All tests completed!
==============================================================

Results saved in: .\results\
```

---

## Ví Dụ 2: Stress Test

### Output Trong Console (Trích đoạn)

```powershell
PS D:\uit-go\test\load-tests> .\run-minikube-tests.ps1 -Stress

==============================================================
  Running Minikube Stress Test (5 minutes)
==============================================================

⚠️  This will run for ~5.5 minutes with peak load of 200 users

=== K6 Minikube Stress Test Setup ===
Test configuration:
  - Duration: 5.5 minutes
  - Peak load: 200 concurrent users
  - Port-forwarded endpoints

Pre-flight health checks:
  User Service: ✅ (200)
  Trip Service: ✅ (200)
  Traefik: ✅ (200)

✅ All services healthy. Starting stress test...

[... k6 output ...]

✅ Stress test completed successfully!

==============================================================
  📊 TEST RESULTS SUMMARY
==============================================================

📋 OVERVIEW
  Duration:        330.12s
  Total Requests:  45678
  Success Rate:    97.8%             (VÀNG - Gần đạt)
  Failed Requests: 1004
  Errors:          1004

⚡ PERFORMANCE
  Avg Response:    156.34ms
  Min Response:    12.45ms
  Max Response:    1234.56ms
  Median (p50):    98.67ms
  p95:             345.78ms          (XANH LÁ - Đạt < 400ms)
  p99:             678.90ms          (XANH LÁ - Đạt < 800ms)

🚀 THROUGHPUT
  Requests/sec:    138.42
  Data Received:   12.45 MB
  Data Sent:       5.67 KB

🎯 THRESHOLDS
  ✅ p95 < 400ms                      (PASS)
  ✅ p99 < 800ms                      (PASS)
  ✅ Success rate > 90%               (PASS)
  ✅ User Service p95 < 350ms (298.45ms)   (PASS)
  ✅ Trip Service p95 < 350ms (312.67ms)   (PASS)

📄 Full results: minikube-stress-2025-11-30T14-35-20.json
==============================================================
```

---

## Ví Dụ 3: Test Fail (Để Minh Họa)

Khi test không đạt threshold, bạn sẽ thấy màu đỏ:

```
==============================================================
  📊 TEST RESULTS SUMMARY
==============================================================

📋 OVERVIEW
  Duration:        120.34s
  Total Requests:  8532
  Success Rate:    85.5%             (ĐỎ - Không đạt!)
  Failed Requests: 1237
  Errors:          1237

⚡ PERFORMANCE
  Avg Response:    234.56ms
  Min Response:    45.23ms
  Max Response:    2345.67ms
  Median (p50):    198.45ms
  p95:             456.78ms          (ĐỎ - Vượt 300ms)
  p99:             890.12ms          (ĐỎ - Vượt 600ms)

🚀 THROUGHPUT
  Requests/sec:    71.1
  Data Received:   2456.78 KB
  Data Sent:       1234.56 KB

🎯 THRESHOLDS
  ❌ p95 < 300ms                      (FAIL - 456.78ms)
  ❌ p99 < 600ms                      (FAIL - 890.12ms)
  ❌ Success rate > 95%               (FAIL - 85.5%)

📄 Full results: minikube-health-2025-11-30T14-25-45.json
==============================================================
```

**Khi thấy ❌ đỏ:**
1. Kiểm tra logs: `kubectl logs deployment/user-service`
2. Kiểm tra resources: `kubectl top pods`
3. Có thể cần tăng resources cho Minikube
4. Xem phần "Khắc Phục Sự Cố" trong tài liệu

---

## Giải Thích Màu Sắc

### 🟢 Màu Xanh Lá (Green)
- Success Rate >= 95% (health) hoặc >= 90% (stress)
- p95/p99 đạt threshold
- Metrics tốt, không có vấn đề

### 🟡 Màu Vàng (Yellow)
- Success Rate giữa 90-95% (health) hoặc 85-90% (stress)
- Failed Requests > 0 nhưng vẫn chấp nhận được
- Cảnh báo, cần theo dõi

### 🔴 Màu Đỏ (Red)
- Success Rate < 90%
- p95/p99 vượt threshold
- Có vấn đề nghiêm trọng cần khắc phục

---

## Cách Đọc File JSON (Tùy Chọn)

Nếu muốn xem chi tiết hơn, mở file JSON:

```powershell
# Mở bằng Visual Studio Code
code results\minikube-health-2025-11-30T14-25-45.json

# Hoặc xem trong PowerShell
Get-Content results\minikube-health-*.json | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

File JSON chứa:
- Tất cả metrics chi tiết
- Breakdown theo service groups
- Percentiles đầy đủ (p(50), p(75), p(90), p(95), p(99), p(99.9))
- State và thông tin về test run
