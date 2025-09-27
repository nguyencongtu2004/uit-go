---
applyTo: '**'
---

## **1. Giới thiệu chung**

UIT-Go là một nền tảng ứng dụng gọi xe, hoạt động như một trung gian để kết nối hai đối tượng người dùng chính: **Hành khách** có nhu cầu di chuyển và **Tài xế** cung cấp dịch vụ vận chuyển. Tài liệu này mô tả tổng quan về các yêu cầu nghiệp vụ, những thách thức kỹ thuật, kiến trúc được lựa chọn và công nghệ dự kiến sử dụng để xây dựng hệ thống.

**Làm các chức năng tối thiểu để stress test thực hiện PoC. Các chức năng râu ria khác (vd: cập nhật profile khách hàng, xem lịch sử chuyến đi,… tạm thời chưa làm. Tập trung làm chức năng book xe và thuật toán tìm xe theo vị trí địa lý cho tối ưu)**

## **2. Yêu cầu Hệ thống**

### **2.1. Yêu cầu Chức năng (Functional Requirements)**

Hệ thống cần đáp ứng các luồng nghiệp vụ cốt lõi sau:

### **Dành cho Hành khách:**

- **Quản lý Tài khoản:** Đăng ký tài khoản mới bằng email, mật khẩu và đăng nhập vào hệ thống.
- **Yêu cầu Chuyến đi:** Nhập điểm đi, điểm đến, xem trước giá cước ước tính và xác nhận đặt xe.
- **Theo dõi Chuyến đi:** Xem vị trí của tài xế đang di chuyển đến điểm đón trên bản đồ theo thời gian thực.
- **Hủy chuyến:** Có khả năng hủy chuyến đi trước khi tài xế đến nơi.
- **Đánh giá & Phản hồi:** Đánh giá tài xế (1-5 sao) và để lại bình luận sau khi chuyến đi kết thúc.

### **Dành cho Tài xế:**

- **Quản lý Tài khoản & Hồ sơ:** Đăng ký thông tin cá nhân và phương tiện để được xét duyệt tham gia hệ thống.
- **Quản lý Trạng thái:** Chuyển đổi trạng thái hoạt động sang "Sẵn sàng" (Online) để bắt đầu nhận chuyến.
- **Nhận Yêu cầu:** Nhận thông báo về các yêu cầu chuyến đi ở gần và có một khoảng thời gian giới hạn (15 giây) để chấp nhận hoặc từ chối.
- **Cập nhật Vị trí:** Vị trí của tài xế được cập nhật liên tục về hệ thống trong suốt quá trình thực hiện chuyến đi.
- **Hoàn thành Chuyến đi:** Xác nhận kết thúc chuyến đi để hệ thống ghi nhận và tính toán doanh thu.

### **2.2. Yêu cầu Phi chức năng (Non-functional Requirements)**

- **Tính Mở rộng (Scalability):** Hệ thống phải có khả năng xử lý lượng lớn người dùng và yêu cầu đồng thời, đặc biệt trong các giờ cao điểm, và có thể mở rộng quy mô một cách linh hoạt khi cần thiết.
- **Hiệu năng (Performance):** Các tác vụ quan trọng như tìm kiếm tài xế và cập nhật vị trí phải có độ trễ cực thấp để đảm bảo trải nghiệm người dùng mượt mà và thông tin chính xác theo thời gian thực.
- **Độ Tin cậy & Sẵn sàng (Reliability & Availability):** Hệ thống phải hoạt động ổn định và có tính sẵn sàng cao (high availability), giảm thiểu thời gian chết. Sự cố ở một thành phần không được phép làm sập toàn bộ hệ thống.
- **Tính Bảo mật (Security):** Bảo vệ an toàn dữ liệu cá nhân của người dùng và tài xế, mã hóa thông tin nhạy cảm và đảm bảo giao tiếp an toàn giữa các thành phần.
- **Chi phí Hiệu quả (Cost-Effectiveness):** Tối ưu hóa việc sử dụng tài nguyên hạ tầng để cân bằng giữa hiệu năng và chi phí vận hành.

## **3. Phân tích và Thiết kế Kiến trúc**

### **3.1. Thách thức khi Thiết kế**

Việc xây dựng một hệ thống gọi xe đặt ra nhiều thách thức kỹ thuật, đòi hỏi phải có những đánh đổi (trade-offs) quan trọng:

- **Xử lý thời gian thực:** Việc cập nhật vị trí tài xế và tìm kiếm các tài xế gần nhất đòi hỏi hệ thống phải xử lý một lượng lớn dữ liệu ghi (write) và đọc (read) với độ trễ cực thấp.
- **Khả năng chịu tải đột biến:** Lượng yêu cầu đặt xe có thể tăng vọt trong giờ cao điểm hoặc khi có sự kiện. Kiến trúc phải đủ linh hoạt để chịu tải mà không bị quá tải.
- **Tính nhất quán và Sẵn sàng:** Cần cân bằng giữa việc đảm bảo dữ liệu luôn nhất quán (ví dụ: trạng thái chuyến đi) và việc hệ thống luôn sẵn sàng phục vụ người dùng, ngay cả khi một phần của hệ thống gặp sự cố.
- **Độ phức tạp trong giao tiếp:** Việc điều phối logic giữa các nghiệp vụ khác nhau (đặt xe, tìm tài xế, thanh toán) đòi hỏi một cơ chế giao tiếp hiệu quả và tin cậy.

### **3.2. Các Thành phần Hệ thống (Services)**

Giai đoạn đầu, hệ thống sẽ bao gồm 3 microservices cốt lõi:

1. **`UserService`:**
    - **Trách nhiệm:** Quản lý toàn bộ thông tin người dùng (hành khách và tài xế), xử lý các nghiệp vụ như đăng ký, đăng nhập, và quản lý hồ sơ.
2. **`DriverService`:**
    - **Trách nhiệm:** Quản lý trạng thái (online/offline) và vị trí của tài xế theo thời gian thực. Cung cấp API để tìm kiếm các tài xế phù hợp trong một bán kính nhất định.
3. **`TripService`:**
    - **Trách nhiệm:** Là dịch vụ trung tâm, điều phối logic của một chuyến đi. Nó quản lý các trạng thái của chuyến đi và giao tiếp với các service khác để hoàn thành một yêu cầu.
    - **Vòng đời trạng thái một chuyến đi:**
    - **Đang tìm tài xế (Searching):** Sau khi hành khách yêu cầu.
    - **Đã chấp nhận (Accepted):** Khi một tài xế nhận chuyến.
    - **Đang diễn ra (Ongoing):** Trong quá trình tài xế đón và chở khách.
    - **Hoàn thành (Completed):** Khi tài xế xác nhận kết thúc chuyến.
    - **Đã hủy (Cancelled):** Khi hành khách hoặc hệ thống hủy chuyến.

## **4. Công nghệ Dự kiến Sử dụng và Trade-offs Analysis**

| **Hạng mục** | **Công nghệ** | **Lý do chọn (Trade-offs Analysis)** |
| --- | --- | --- |
| **Ngôn ngữ Backend** | Node.js + ExpressJS | **✅** Non-blocking I/O phù hợp cho real-time applications. **✅** Ecosystem phong phú (npm). 
**❌** Single-threaded, cần clustering cho CPU-intensive tasks. |
| **Service Communication** | **Hybrid**: Kafka + gRPC + RESTful | **✅** Kafka: Event-driven, fault tolerance. 
**✅** gRPC: High performance cho internal calls. 
**✅** REST: Easy debugging cho external APIs. 
**❌** Increased complexity. |
| **Database Strategy** | **Per-Service**: MongoDB + Redis | **✅** Technology fit per use case.
**✅** Service independence. 
**❌** Cross-service queries complexity. 
**❌** Data consistency challenges. |
| **Primary Database** | MongoDB (Replica Sets) | **✅** Flexible schema cho rapid development. 
**✅** Geospatial queries cho location data. 
**✅** Horizontal scaling. 
**❌** Eventual consistency. |
| **High-Performance Cache** | Redis Cluster (ElastiCache) | **✅** Sub-millisecond latency. 
**✅** Geospatial commands (GEORADIUS). 
**✅** Pub/Sub cho real-time. 
**❌** Memory limitations, cost. |
| **Real-time Communication** | WebSocket | **✅** Bidirectional real-time communication.
**❌** Connection management overhead. |
| **Message Queue/Stream** | Apache Kafka (MSK) | **✅** High throughput (millions msg/sec). 
**✅** Event sourcing capability. 
**✅** Fault tolerance. 
**❌** Complex setup, higher latency than Redis. |
| **API Gateway & Load Balancer** | Traefik v3 | ✅ Container-native auto-discovery
✅ Built-in SSL automation (Let's Encrypt)
✅ Real-time config reload, zero downtime
✅ Unified solution (API Gateway + LB)
✅ Excellent observability & middleware
❌ Learning curve for advanced features
❌ Limited enterprise features vs Kong Enterprise |
| **Containerization** | Docker + Docker Compose | **✅** Consistent environments. 
**✅** Easy scaling. 
**❌** Container overhead, security concerns. |
| **Container Orchestration** | **Production**: EKS, **Local**: Docker Compose | **✅** Auto-scaling, self-healing. 
**✅** Service discovery. 
**❌** Learning curve, operational complexity. |
| **Infrastructure as Code** | Terraform + AWS CloudFormation | **✅** Version control, reproducible. 
**✅** Multi-cloud capability (Terraform). 
**❌** State management complexity. |
| **CI/CD Pipeline** | GitHub Actions + AWS CodePipeline | **✅** Automated testing, deployment. 
**✅** GitOps workflow. 
**❌** Pipeline complexity, longer deployment time. |
| **Load Testing** | k6 + Artillery | **✅** JavaScript-based scenarios. 
**✅** High performance testing. 
**✅** CI/CD integration. 
**❌** Learning curve for complex scenarios. |
| **Security** | **Auth**: JWT
**Secrets**: AWS Secrets Manager
**Network**: VPC, Security Groups | **✅** Industry standards. 
**✅** Centralized secret management. 
**❌** Token management complexity. |
| **Backup & Disaster Recovery** | **DB**: Automated backups + Point-in-time recovery
**Files**: S3 Cross-Region Replication | **✅** RTO < 1 hour, RPO < 15 minutes. 
**✅** Geographic redundancy. 
**❌** Storage costs, complexity. |
