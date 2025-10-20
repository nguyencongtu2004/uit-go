# 🚀 UIT-GO Load Testing Suite

**Status**: ✅ READY | **Last Test**: 73,668 requests @ 613 req/s | 97.59% success

---

## ⚡ Quick Start

### 1️⃣ Cài đặt k6 (lần đầu)
```powershell
choco install k6
# hoặc lên trang chủ k6 tải về
```

### 2️⃣ Sửa DNS (lần đầu)
```powershell
.\test\load-tests\fix-localhost-dns.ps1
```

### 3️⃣ Khởi động services
```powershell
docker compose up -d
```

### 4️⃣ Chạy stress test

**Test nhanh (2 phút, 200 users) - RECOMMENDED ⭐**
```powershell
.\test\load-tests\run-stress-tests.ps1 -Quick
```

**Test mạnh (5 phút, 500 users)**
```powershell
.\test\load-tests\run-stress-tests.ps1 -Extended
```

**Chạy tất cả tests**
```powershell
.\test\load-tests\run-stress-tests.ps1 -All
```

---

## 📊 Các File Test Có Sẵn

### ✅ Tests Không Cần Authentication (Chạy ngay được)

| File | Mục đích | Thời gian | Số users | Trạng thái |
|------|----------|-----------|----------|------------|
| **k6-simple-test.js** | Test cơ bản | 10s | 10 | ✅ Ready |
| **k6-stress-short.js** | Test vừa phải | 2 phút | 200 | ✅ **Passed** |
| **k6-stress-extended.js** | Test mạnh | 5 phút | 500 | ✅ Ready |

**Cách chạy trực tiếp:**
```powershell
# Test đơn giản nhất
k6 run test\load-tests\k6-simple-test.js

# Test 2 phút (đã test thành công)
k6 run test\load-tests\k6-stress-short.js

# Test 5 phút (nặng hơn)
k6 run test\load-tests\k6-stress-extended.js
```

### � Tests Cần Authentication (Cần tạo user trước)

| File | Mục đích | Ghi chú |
|------|----------|---------|
| **k6-driver-location.js** | Test cập nhật vị trí tài xế | Cần 1000 driver tokens |
| **k6-trip-booking.js** | Test đặt chuyến xe | Cần passenger + driver tokens |
| **k6-full-scenario.js** | Test tổng hợp | Cần cả passenger + driver tokens |

---

## 🎯 Kết Quả Test Gần Nhất

**Test 2 phút (k6-stress-short.js):**
```
✅ Total Requests: 73,668
✅ Throughput: 613 req/sec (target: 500)
✅ Success Rate: 97.59% (target: >95%)
✅ p95 Latency: 176.87ms (target: <200ms)
✅ Error Rate: 0%
✅ ALL THRESHOLDS PASSED
```

**Kết luận**: Hệ thống PASS ở mức 200 concurrent users! 🎉

---

## �️ Troubleshooting

### Services không chạy?
```powershell
docker compose up -d
curl http://user.localhost:81/health
```

### DNS không resolve?
```powershell
.\test\load-tests\fix-localhost-dns.ps1
ping user.localhost
```

### Xem logs
```powershell
docker compose logs user-service
docker compose logs driver-service
docker compose logs trip-service
```

---

## 📁 Kết Quả Test

Tất cả kết quả lưu tại: **`test/load-tests/results/`**

- `*.json` - Raw data (metrics chi tiết)
- `*.html` - Visual reports (chỉ extended test)
- `*-summary.txt` - Text summaries

---

## 📚 Documentation

- **PROJECT_COMPLETE.md** - Tổng kết đầy đủ nhất ⭐
- **STRESS_TESTING_GUIDE.md** - Hướng dẫn chi tiết
- **STRESS_TEST_REPORT.md** - Phân tích kết quả test

---

## 💡 Recommend

**Bắt đầu stress test? Chạy lệnh này:**
```powershell
.\test\load-tests\run-stress-tests.ps1 -Quick
```

Hoặc chạy trực tiếp:
```powershell
k6 run test\load-tests\k6-stress-short.js
```

---

**Made with ❤️ for UIT-GO | Powered by k6 v1.3.0**
