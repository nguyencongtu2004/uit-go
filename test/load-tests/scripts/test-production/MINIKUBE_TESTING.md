# Hướng Dẫn Chạy Load Test Trên Minikube (Manual Mode)

Tài liệu này hướng dẫn cách chạy load test trực tiếp bằng công cụ **k6**, không thông qua script tự động, giúp bạn kiểm soát tốt hơn quá trình test.

## 📋 Mục Lục
1. [Yêu Cầu Tiên Quyết](#1-yêu-cầu-tiên-quyết)
2. [Chuẩn Bị Môi Trường](#2-chuẩn-bị-môi-trường)
3. [Cấu Hình Port-Forward (Quan Trọng)](#3-cấu-hình-port-forward-quan-trọng)
4. [Thực Hiện Load Test](#4-thực-hiện-load-test)
5. [Đọc Kết Quả](#5-đọc-kết-quả)

---

## 1. Yêu Cầu Tiên Quyết

Đảm bảo bạn đã cài đặt các công cụ sau:
- **Minikube** & **kubectl**
- **k6**: [Hướng dẫn cài đặt](https://k6.io/docs/get-started/installation/)
  ```powershell
  choco install k6
  # Hoặc tải file cài đặt từ trang chủ
  ```

---

## 2. Chuẩn Bị Môi Trường

### Bước 1: Khởi động Minikube
```powershell
minikube start --driver=docker
```

### Bước 2: Build Docker Images (Nếu chưa làm)
Nếu bạn vừa sửa code, hãy build lại image trong môi trường Minikube:
```powershell
minikube docker-env | Invoke-Expression
docker build -t user-service:latest -f services/user/Dockerfile .
docker build -t trip-service:latest -f services/trip/Dockerfile .
```

### Bước 3: Deploy Services
```powershell
# Deploy database & infrastructure
kubectl apply -k k8s/mongodb/user
kubectl apply -k k8s/mongodb/trip
kubectl apply -k k8s/redis
kubectl apply -k k8s/kafka
kubectl apply -k k8s/traefik

# Deploy services
kubectl apply -k k8s/services/user
kubectl apply -k k8s/services/trip
```

### Bước 4: Kiểm tra Pods
Đảm bảo tất cả pods đều ở trạng thái **Running**:
```powershell
kubectl get pods
```

---

## 3. Cấu Hình Port-Forward (Quan Trọng)

Bạn cần mở **3 cửa sổ Terminal riêng biệt** để duy trì kết nối.

### ⚠️ Khắc Phục Lỗi Kết Nối (Connection Refused)
Nếu bạn gặp lỗi `lost connection` hoặc `connection refused` khi port-forward, hãy làm theo bước này **trước khi** chạy port-forward:

1. Restart lại deployment để refresh kết nối:
   ```powershell
   kubectl rollout restart deployment user-service
   kubectl rollout restart deployment trip-service
   ```
2. **Đợi khoảng 30-60 giây** cho đến khi pod mới chạy hoàn toàn (`kubectl get pods` thấy trạng thái Running và Age thấp).

### Terminal 1: User Service
```powershell
kubectl port-forward svc/user-service 83:3000
```

### Terminal 2: Trip Service
```powershell
kubectl port-forward svc/trip-service 82:3000
```

### Terminal 3: Traefik (API Gateway)
```powershell
kubectl port-forward svc/traefik 8080:8080 8000:80
```

---

## 4. Thực Hiện Load Test

Di chuyển vào thư mục chứa script test:
```powershell
cd test/load-tests
```

### ✅ Test 1: Health Check (Kiểm tra nhanh)
Chạy test này đầu tiên để đảm bảo hệ thống hoạt động.
- **Thời gian**: 2 phút
- **Mục tiêu**: Kiểm tra kết nối và phản hồi cơ bản.

```powershell
k6 run k6-minikube-health.js
```

### 🚀 Test 2: Load Test (Mô phỏng thực tế)
Test hiệu năng với tải ổn định.
- **Thời gian**: 10 phút
- **VUs (Virtual Users)**: 80 users duy trì liên tục.
- **Mục tiêu**: Đánh giá độ ổn định của hệ thống dưới tải bình thường.

```powershell
k6 run k6-minikube-load.js
```

### 🔥 Test 3: Stress Test (Kiểm tra chịu tải)
Test giới hạn của hệ thống.
- **Thời gian**: 5.5 phút
- **VUs**: Tăng dần lên 200 users.
- **Mục tiêu**: Tìm điểm gãy (breaking point) của hệ thống.

```powershell
k6 run k6-minikube-stress.js
```

---

## 5. Đọc Kết Quả

Sau khi k6 chạy xong, bạn sẽ thấy bảng báo cáo trong terminal. Các chỉ số quan trọng cần quan tâm:

### 1. http_req_duration (Thời gian phản hồi)
Đây là thời gian từ lúc gửi request đến khi nhận response.
- `avg`: Trung bình (nên < 100ms)
- `p(95)`: 95% request nhanh hơn mức này (quan trọng nhất, nên < 300ms)

Ví dụ output tốt:
```
✓ http_req_duration..............: avg=45.32ms  min=12.10ms  med=38.90ms  max=456.78ms  p(90)=89.45ms  p(95)=125.67ms
```

### 2. success_rate (Tỷ lệ thành công)
Tỷ lệ request trả về status 200 OK.
- **Yêu cầu**: > 95% (Health/Load), > 90% (Stress)

Ví dụ:
```
✓ success_rate...................: 98.50% ✓ 8306 ✗ 126
```
Nếu thấy dấu `✗` màu đỏ, nghĩa là test thất bại (không đạt threshold).

### 3. http_reqs (Thông lượng)
Số request xử lý được trên giây.
```
http_reqs......................: 8432   70.12345/s
```

### 4. Checks & Thresholds
k6 sẽ hiển thị dấu tích xanh `✓` nếu đạt yêu cầu và dấu chéo đỏ `✗` nếu trượt.

```
✓ p95 < 300ms
✗ p99 < 600ms  <-- Cần tối ưu hóa
✓ Success rate > 95%
```
