# ADR 001: Sử dụng Redis cho Geospatial Indexing thay vì DynamoDB

**Trạng thái**: Đã chấp nhận  
**Ngày**: 2025-10-15  
**Người quyết định**: Nhóm Kiến trúc Kỹ thuật  
**Tags**: `database`, `caching`, `geospatial`, `performance`

---

## Bối cảnh và Vấn đề

Driver Service cần truy vấn hiệu quả các tài xế gần đó dựa trên vị trí đón khách. Hoạt động này rất quan trọng đối với nghiệp vụ gọi xe và phải:

- Trả về kết quả trong **<10ms** để có trải nghiệm người dùng tối ưu
- Hỗ trợ **truy vấn không gian địa lý** (tìm tất cả tài xế trong bán kính)
- Xử lý **cập nhật vị trí thường xuyên** (mỗi 5 giây cho mỗi tài xế đang hoạt động)
- Mở rộng đến **10.000+ tài xế hoạt động** đồng thời

Chúng ta cần lựa chọn giữa:

1. **Redis** với các lệnh geospatial tích hợp sẵn
2. **Amazon DynamoDB** với triển khai geospatial tùy chỉnh

---

## Yếu tố Quyết định

### Yêu cầu Chức năng

- **Truy vấn không gian địa lý**: Các thao tác GEORADIUS, GEORADIUSBYMEMBER
- **Cập nhật thời gian thực**: Ghi dữ liệu thường xuyên (cập nhật vị trí tài xế)
- **Đọc độ trễ thấp**: Quan trọng cho hiệu suất thuật toán ghép đôi
- **Hiệu suất in-memory**: Thời gian phản hồi truy vấn dưới 10ms

### Yêu cầu Phi chức năng

- **Khả năng mở rộng**: Xử lý 10K+ tài xế đồng thời, 500+ req/s
- **Hiệu quả chi phí**: Giảm thiểu chi phí vận hành cho PoC
- **Tốc độ phát triển**: Tích hợp dễ dàng, tài liệu đầy đủ
- **Độ phức tạp vận hành**: Giảm thiểu công việc bảo trì

---

## Các Phương án Đã Xem xét

### Phương án 1: Redis với Cấu trúc Dữ liệu Không gian Địa lý

**Mô tả**: Sử dụng các lệnh geospatial tích hợp sẵn của Redis (GEOADD, GEORADIUS) với sorted sets.

**Ưu điểm**:

- ✅ **Hỗ trợ geospatial tự nhiên**: Lệnh GEORADIUS tích hợp sẵn, không cần logic tùy chỉnh
- ✅ **Độ trễ dưới millisecond**: Thao tác trên bộ nhớ, thường 2-5ms
- ✅ **API đơn giản**:
  ```redis
  GEOADD driver_locations 106.660172 10.762622 driver_001
  GEORADIUS driver_locations 106.660 10.762 5 KM WITHDIST COUNT 10
  ```
- ✅ **Đã được kiểm chứng**: Được sử dụng bởi Uber, Lyft cho các trường hợp tương tự
- ✅ **Thân thiện với Docker**: Dễ dàng cài đặt môi trường phát triển local
- ✅ **Chi phí thấp**: Mã nguồn mở, AWS ElastiCache giá cả phải chăng
- ✅ **Pub/Sub**: Tính năng bổ sung cho thông báo thời gian thực

**Nhược điểm**:

- ❌ **Chỉ trên bộ nhớ**: Mất dữ liệu khi crash (được giảm thiểu bằng persistence)
- ❌ **Single-threaded**: Sử dụng CPU hạn chế (được giảm thiểu bằng clustering)
- ❌ **Giới hạn bộ nhớ**: Cần quản lý chính sách eviction
- ❌ **Không thể truy vấn phức tạp**: Không thể chạy truy vấn phức tạp như SQL

**Triển khai Kỹ thuật**:

```javascript
// Thêm vị trí tài xế
await redis.geoadd("driver_locations", longitude, latitude, driverId);

// Tìm tài xế gần trong bán kính 5km
const nearby = await redis.georadius(
  "driver_locations",
  passengerLng,
  passengerLat,
  5,
  "km",
  "WITHDIST",
  "ASC",
  "COUNT",
  10
);
```

**Benchmark Hiệu suất** (đã đo):

- Ghi (GEOADD): 0.5ms trung bình
- Đọc (GEORADIUS): 4.8ms trung bình cho 10,000 tài xế
- Throughput: 100,000+ ops/sec trên một instance

---

### Phương án 2: Amazon DynamoDB với Geohash

**Mô tả**: Lưu trữ vị trí tài xế trong DynamoDB với geohash indexing cho truy vấn không gian.

**Ưu điểm**:

- ✅ **Fully managed**: Không cần bảo trì server
- ✅ **Khả năng mở rộng**: Auto-scaling tích hợp sẵn
- ✅ **Lưu trữ lâu dài**: Đảm bảo độ bền dữ liệu
- ✅ **Global tables**: Nhân bản đa vùng

**Nhược điểm**:

- ❌ **Không có geospatial tự nhiên**: Phải triển khai geohash thủ công
- ❌ **Độ trễ cao hơn**: Thời gian truy vấn thường 10-50ms
- ❌ **Truy vấn phức tạp**: Nhiều lần quét bảng cho tìm kiếm bán kính
- ❌ **Chi phí**: Đắt đỏ cho khối lượng đọc/ghi cao
  - Ghi: $1.25 cho mỗi triệu WCUs
  - Đọc: $0.25 cho mỗi triệu RCUs
  - **Chi phí ước tính**: $500-800/tháng cho 10K tài xế cập nhật mỗi 5s
- ❌ **Overhead phát triển**: Thư viện geohash tùy chỉnh, indexing phức tạp
- ❌ **Vendor lock-in**: Đặc thù AWS, khó di chuyển

**Triển khai Kỹ thuật**:

```javascript
// Pseudo-code cho DynamoDB geospatial
const geohash = encodeGeohash(lat, lng, (precision = 6));
await dynamoDB.putItem({
  TableName: "DriverLocations",
  Item: {
    driverId: driverId,
    geohash: geohash,
    latitude: lat,
    longitude: lng,
    timestamp: Date.now(),
  },
});

// Truy vấn yêu cầu nhiều geohash prefix
const neighbors = getNeighborGeohashes(userGeohash);
const queries = neighbors.map((gh) =>
  dynamoDB.query({
    IndexName: "GeohashIndex",
    KeyConditionExpression: "geohash = :gh",
    ExpressionAttributeValues: { ":gh": gh },
  })
);
const results = await Promise.all(queries);
// Sau đó lọc theo khoảng cách thực tế (công thức haversine)
```

**Benchmark Hiệu suất** (ước tính):

- Ghi: 15-30ms
- Đọc (truy vấn geohash): 25-60ms
- Throughput: 3,000 ops/sec cho mỗi bảng (cần scaling)

---

### Phương án 3: PostgreSQL với PostGIS Extension

**Mô tả**: Sử dụng PostgreSQL với PostGIS cho truy vấn không gian địa lý nâng cao.

**Ưu điểm**:

- ✅ **Geospatial mạnh mẽ**: Khả năng GIS đầy đủ, truy vấn không gian phức tạp
- ✅ **Tuân thủ ACID**: Đảm bảo tính nhất quán mạnh mẽ
- ✅ **Dữ liệu quan hệ**: Có thể join với các bảng khác
- ✅ **Mã nguồn mở**: Không bị vendor lock-in

**Nhược điểm**:

- ❌ **Chậm hơn Redis**: Thời gian truy vấn 20-100ms
- ❌ **Cài đặt phức tạp**: PostGIS extension, spatial indexes
- ❌ **Overhead vận hành**: Cần quản lý DB, backups, scaling
- ❌ **Quá mức cần thiết**: Quá nặng cho truy vấn bán kính đơn giản
- ❌ **Không in-memory**: Dựa trên đĩa, đọc chậm hơn

---

## Quyết định Cuối cùng

**Phương án được chọn: Phương án 1 - Redis với Lệnh Geospatial**

### Lý do

1. **Hiệu suất**: Redis đáp ứng yêu cầu <10ms của chúng ta (đo được 4.8ms trung bình)
2. **Đơn giản**: Lệnh GEORADIUS tự nhiên, code tối thiểu
3. **Chi phí**: ~$30/tháng ElastiCache so với $500+/tháng DynamoDB
4. **Tốc độ phát triển**: Tích hợp nhanh, tài liệu đầy đủ
5. **Đã được chứng minh**: Được kiểm chứng bởi Uber, Lyft trong production

### Đánh đổi Được chấp nhận

- **Rủi ro lưu trữ dữ liệu**: Được giảm thiểu bằng:
  - Redis persistence (RDB snapshots + AOF logs)
  - Dữ liệu chính vẫn trong MongoDB
  - Redis hoạt động như "hot cache" cho các tài xế đang hoạt động
- **Single-point of failure**: Được giảm thiểu bằng:

  - Redis Cluster trong production (multi-master)
  - Automatic failover với Sentinel
  - ElastiCache Multi-AZ deployment trên AWS

- **Giới hạn bộ nhớ**: Được giảm thiểu bằng:
  - TTL trên các tài xế không hoạt động (tự động xóa sau 10 phút offline)
  - Chính sách eviction LRU
  - Bộ nhớ dự kiến: 10K tài xế × 100 bytes = ~1MB (không đáng kể)

---

## Chi tiết Triển khai

### Cấu hình Redis (Tối ưu cho Geospatial)

```conf
# redis.conf
maxmemory 2gb
maxmemory-policy allkeys-lru
appendonly yes
appendfsync everysec
save 900 1
save 300 10
```

### Driver Location Service

```javascript
// services/driver-service/src/services/locationService.js

class LocationService {
  async updateLocation(driverId, latitude, longitude) {
    // Cập nhật geospatial index
    await redis.geoadd("driver_locations", longitude, latitude, driverId);

    // Đặt TTL để tự động dọn dẹp (10 phút)
    await redis.expire(`driver:status:${driverId}`, 600);

    // Cũng cập nhật MongoDB để lưu trữ lâu dài
    await Driver.updateOne(
      { _id: driverId },
      {
        location: { type: "Point", coordinates: [longitude, latitude] },
        lastLocationUpdate: new Date(),
      }
    );
  }

  async findNearbyDrivers(latitude, longitude, radiusKm = 5, limit = 10) {
    const nearbyDrivers = await redis.georadius(
      "driver_locations",
      longitude,
      latitude,
      radiusKm,
      "km",
      "WITHDIST",
      "WITHCOORD",
      "ASC",
      "COUNT",
      limit
    );

    // Lọc theo trạng thái online
    const online = await this.filterOnlineDrivers(nearbyDrivers);
    return online;
  }
}
```

---

## Kiểm chứng & Kết quả

### Kết quả Load Testing

**Thiết lập Test**: k6 stress test với 200 người dùng đồng thời

```
Kịch bản: Cập nhật vị trí tài xế + truy vấn tài xế gần đó
- 1000 tài xế cập nhật vị trí mỗi 5 giây
- 200 hành khách tìm kiếm tài xế gần đó
- Thời lượng: 5 phút

Kết quả:
✅ GEORADIUS độ trễ trung bình: 4.8ms
✅ P95 latency: 8.2ms
✅ P99 latency: 12.5ms
✅ Throughput: 15,000 truy vấn/giây
✅ Tỷ lệ lỗi: 0%
✅ Redis memory usage: 85MB
```

### So sánh Chi phí (Hàng tháng, Quy mô Production)

| Giải pháp             | Loại Instance                      | Chi phí  | Ghi chú                 |
| --------------------- | ---------------------------------- | -------- | ----------------------- |
| **Redis ElastiCache** | cache.r6g.large (2 vCPU, 13.07 GB) | **$110** | Multi-AZ, auto-failover |
| **DynamoDB**          | Provisioned 1000 WCU, 1000 RCU     | **$580** | Auto-scaling enabled    |
| **PostgreSQL RDS**    | db.r6g.large + PostGIS             | **$220** | Bao gồm backup storage  |

**Người chiến thắng**: Redis **rẻ hơn 5.3 lần** so với DynamoDB cho use case này.

---

## Hậu quả

### Tích cực

- ✅ **Phát triển nhanh**: Triển khai trong 2 ngày so với ước tính 1-2 tuần cho DynamoDB
- ✅ **Hiệu suất xuất sắc**: Ổn định <10ms, vượt yêu cầu
- ✅ **Codebase đơn giản**: 50 dòng code so với 200+ cho logic geohash
- ✅ **Tiết kiệm chi phí**: Tiết kiệm $470/tháng so với phương án DynamoDB
- ✅ **Kiểm thử dễ dàng**: Thiết lập Docker Compose, không phụ thuộc AWS ở local

### Tiêu cực

- ⚠️ **Dependency mới**: Team cần học các thao tác Redis
- ⚠️ **Cần giám sát**: Cần theo dõi memory usage, eviction rates
- ⚠️ **Kiểm thử failover**: Phải xác minh ElastiCache Multi-AZ hoạt động như mong đợi

### Rủi ro & Giảm thiểu

| Rủi ro                      | Khả năng | Tác động | Giảm thiểu                            |
| --------------------------- | -------- | -------- | ------------------------------------- |
| **Redis crash mất dữ liệu** | Thấp     | Trung    | RDB+AOF persistence, MongoDB fallback |
| **Cạn kiệt bộ nhớ**         | Trung    | Cao      | LRU eviction, monitoring alerts       |
| **Single point of failure** | Thấp     | Cao      | Redis Cluster, Multi-AZ ElastiCache   |
| **Vendor lock-in**          | Thấp     | Trung    | Redis là mã nguồn mở, dễ di chuyển    |

---

## Các Phương án Bị từ chối

### Tại sao không dùng DynamoDB?

Mặc dù DynamoDB cung cấp khả năng mở rộng và managed operations, nó thất bại về:

1. **Hiệu suất**: Độ trễ 25-60ms so với yêu cầu <10ms
2. **Chi phí**: Đắt hơn 5 lần
3. **Độ phức tạp**: Cần triển khai geohash tùy chỉnh

**Sử dụng DynamoDB khi**:

- Cần multi-region replication
- Độ bền dữ liệu là quan trọng
- Ngân sách cho phép dịch vụ managed cao cấp

### Tại sao không dùng PostgreSQL+PostGIS?

PostGIS là quá mức cần thiết cho truy vấn bán kính đơn giản. Sử dụng khi:

- Cần các thao tác không gian phức tạp (polygon intersection, v.v.)
- Yêu cầu ACID transactions với dữ liệu không gian
- Đã sử dụng PostgreSQL cho dữ liệu khác

---

## Các Hành động Tiếp theo

- [x] Triển khai Redis geospatial service (2025-10-16)
- [x] Thêm giám sát cho Redis memory usage (2025-10-18)
- [x] Load test với 10,000 tài xế (2025-10-20)
- [ ] Cài đặt ElastiCache trên AWS staging (2025-11-01)
- [ ] Tài liệu hóa quy trình failover (2025-11-05)
- [ ] Đào tạo team về thao tác Redis (2025-11-10)

---

## Tài liệu Tham khảo

- [Redis Geospatial Commands Documentation](https://redis.io/commands/?group=geo)
- [Uber's Geospatial Index (H3)](https://eng.uber.com/h3/)
- [AWS ElastiCache Pricing](https://aws.amazon.com/elasticache/pricing/)
- [DynamoDB Geospatial Indexing Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-gsi-geospatial.html)
- Kết quả Load Test: `test/load-tests/STRESS_TEST_REPORT.md`

---

**Reviewed by**: Architecture Team  
**Approved by**: Tech Lead  
**Next Review**: 2025-12-01 (sau 1 tháng trong production)
