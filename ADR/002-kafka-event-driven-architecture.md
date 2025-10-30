# ADR 002: Kiến trúc Event-Driven với Apache Kafka

**Trạng thái**: Đã chấp nhận  
**Ngày**: 2025-10-16  
**Người quyết định**: Nhóm Kiến trúc Kỹ thuật  
**Tags**: `architecture`, `messaging`, `scalability`, `microservices`

---

## Bối cảnh và Vấn đề

Trong nền tảng gọi xe, nhiều dịch vụ cần phối hợp và phản ứng với các sự kiện nghiệp vụ (yêu cầu chuyến đi, chấp nhận chuyến đi, cập nhật vị trí tài xế, v.v.). Chúng ta cần một cơ chế giao tiếp đáng tin cậy để:

- **Tách rời các dịch vụ**: Các dịch vụ không nên phụ thuộc trực tiếp vào nhau
- **Xử lý throughput cao**: 1000+ sự kiện/giây trong giờ cao điểm
- **Đảm bảo gửi**: Các sự kiện quan trọng không được mất
- **Kích hoạt event sourcing**: Audit trail của tất cả các sự kiện nghiệp vụ
- **Mở rộng theo chiều ngang**: Có thể thêm nhiều consumer khi tải tăng

Chúng ta cần lựa chọn giữa:

1. **Apache Kafka** - Nền tảng event streaming phân tán
2. **Direct HTTP/REST calls** - Giao tiếp đồng bộ service-to-service
3. **AWS SQS/SNS** - Dịch vụ message queue được quản lý
4. **RabbitMQ** - Message broker truyền thống

---

## Yếu tố Quyết định

### Yêu cầu Chức năng

- **Event streaming**: Xuất bản các sự kiện nghiệp vụ cho nhiều consumer
- **Đảm bảo gửi**: Ngữ nghĩa gửi ít nhất một lần (at-least-once)
- **Thứ tự message**: Duy trì thứ tự cho mỗi partition key (ví dụ: tripId)
- **Phát lại sự kiện**: Khả năng xử lý lại các sự kiện lịch sử
- **Consumer groups**: Nhiều instance tiêu thụ song song

### Yêu cầu Phi chức năng

- **Throughput**: Xử lý 1000+ message/giây
- **Độ trễ**: <100ms gửi sự kiện end-to-end
- **Khả năng mở rộng**: Mở rộng theo chiều ngang cho producers và consumers
- **Khả năng chịu lỗi**: Vượt qua lỗi broker mà không mất dữ liệu
- **Độ phức tạp vận hành**: Quản lý được cho team nhỏ

---

## Các Phương án Đã Xem xét

### Phương án 1: Apache Kafka (Nền tảng Event Streaming)

**Mô tả**: Commit log phân tán được thiết kế cho event streaming thông lượng cao.

**Ưu điểm**:

- ✅ **Throughput cao**: Khả năng hàng triệu message/giây
- ✅ **Event sourcing**: Message được lưu trữ trong thời gian có thể cấu hình (chúng ta dùng 24h-7 ngày)
- ✅ **Mở rộng theo chiều ngang**: Thêm brokers và partitions khi cần
- ✅ **Consumer groups**: Xử lý song song với cân bằng tải tự động
- ✅ **Khả năng chịu lỗi**: Nhân bản giữa các brokers
- ✅ **Thứ tự message**: Đảm bảo trong partition
- ✅ **Exactly-once semantics**: Có sẵn (mặc dù chúng ta dùng at-least-once)
- ✅ **Đã được kiểm chứng**: Được sử dụng bởi Uber, LinkedIn, Netflix
- ✅ **KRaft mode**: Không phụ thuộc ZooKeeper trong các phiên bản hiện đại

**Nhược điểm**:

- ❌ **Độ phức tạp vận hành**: Phức tạp hơn SQS/SNS
- ❌ **Tốn tài nguyên**: Yêu cầu các broker instance riêng biệt
- ❌ **Learning curve**: Team cần học các khái niệm Kafka
- ❌ **Quá mức cho quy mô nhỏ**: Có thể quá nhiều cho <100 msg/s

**Kiến trúc**:

```
┌─────────────┐  produce   ┌──────────────┐
│   Service   ├───────────►│    Kafka     │
│  (Producer) │            │    Topic     │
└─────────────┘            │ [Part 0]     │
                           │ [Part 1]     │
                           │ [Part 2]     │
                           └───────┬──────┘
                                   │ consume
                     ┌─────────────┼─────────────┐
                     │             │             │
              ┌──────▼────┐ ┌──────▼────┐ ┌──────▼────┐
              │Consumer 1 │ │Consumer 2 │ │Consumer 3 │
              │(Group A)  │ │(Group A)  │ │(Group A)  │
              └───────────┘ └───────────┘ └───────────┘
```

**Chi phí** (AWS MSK):

- 3 brokers (m5.large): ~$500/tháng
- Storage (500GB): ~$50/tháng
- **Tổng**: ~$550/tháng

**Phát triển Local**:

- Docker image: confluentinc/cp-kafka
- KRaft mode (không cần ZooKeeper)
- Cài đặt dễ dàng với docker-compose

---

### Phương án 2: Direct HTTP/REST Calls

**Mô tả**: Các dịch vụ giao tiếp đồng bộ qua REST APIs.

**Ưu điểm**:

- ✅ **Đơn giản**: Không cần hạ tầng bổ sung
- ✅ **Phản hồi ngay lập tức**: Biết ngay nếu request thành công
- ✅ **Dễ debug**: Công cụ HTTP chuẩn (cURL, Postman)
- ✅ **Không cần học**: Team đã biết REST

**Nhược điểm**:

- ❌ **Coupling chặt**: Các dịch vụ phụ thuộc vào sự sẵn sàng của nhau
- ❌ **Cascading failures**: Nếu Trip Service down, Driver Service không thể thông báo
- ❌ **Không có cơ chế retry**: Caller phải tự triển khai retries
- ❌ **Không có lịch sử sự kiện**: Không thể phát lại events
- ❌ **Đồng bộ blocking**: Dịch vụ downstream chậm chặn upstream
- ❌ **Cần circuit breaker**: Xử lý lỗi phức tạp

**Ví dụ Vấn đề**:

```
Yêu cầu chuyến đi → Gọi Driver Service → Gọi Notification Service
                      ↓ (thất bại)           ↓
                   Retry?              Request mất
```

**Lý do bị từ chối**:

- Tạo coupling chặt giữa các dịch vụ
- Không thể scale độc lập
- Không có fault tolerance tích hợp

---

### Phương án 3: AWS SQS/SNS

**Mô tả**: Dịch vụ message queue được quản lý (SQS) và pub/sub (SNS).

**Ưu điểm**:

- ✅ **Fully managed**: Không cần quản lý server
- ✅ **Khả năng mở rộng**: Tự động scale
- ✅ **Đáng tin cậy**: 99.9% availability SLA
- ✅ **Đơn giản**: API dễ dàng, cài đặt nhanh
- ✅ **Pay-per-use**: Hiệu quả chi phí ở khối lượng thấp

**Nhược điểm**:

- ❌ **Không có thứ tự message**: Chỉ FIFO queues (throughput hạn chế)
- ❌ **Không phát lại sự kiện**: Message bị xóa sau khi consume
- ❌ **Retention hạn chế**: Tối đa 14 ngày (so với Kafka có thể cấu hình)
- ❌ **Vendor lock-in**: Đặc thù AWS, khó migrate
- ❌ **Giới hạn kích thước message**: Tối đa 256KB (Kafka: 1MB mặc định)
- ❌ **Eventual consistency**: Có thể có message trùng lặp
- ❌ **Không có partitioning**: Không thể đảm bảo thứ tự cho các entity cụ thể

**Chi phí** (AWS):

- 1M requests: $0.40
- **Ước tính**: ~$100/tháng cho 10M events

**Lý do không chọn**:

- Không có thứ tự message (quan trọng cho các sự kiện vòng đời chuyến đi)
- Không thể phát lại events (cần cho debugging, analytics)
- Vendor lock-in vào AWS

---

### Phương án 4: RabbitMQ

**Mô tả**: Message broker truyền thống với khả năng routing mạnh mẽ.

**Ưu điểm**:

- ✅ **Routing linh hoạt**: Các loại exchange (direct, topic, fanout)
- ✅ **Trưởng thành**: Hơn 15 năm trong production
- ✅ **Management UI**: Dashboard admin tích hợp sẵn
- ✅ **Nhiều giao thức**: AMQP, MQTT, STOMP

**Nhược điểm**:

- ❌ **Throughput thấp hơn**: ~50K msg/s so với hàng triệu của Kafka
- ❌ **Xóa message**: Bị xóa sau khi consume (không phát lại được)
- ❌ **Mở rộng theo chiều dọc**: Khó scale theo chiều ngang
- ❌ **Memory bound**: Hiệu suất giảm với hàng đợi lớn
- ❌ **Single point of failure**: Cần HA setup để dự phòng

**Lý do không chọn**:

- Không thể phát lại events (không có event sourcing)
- Throughput thấp hơn Kafka
- Không được thiết kế cho event streaming use case

---

## Quyết định Cuối cùng

**Phương án được chọn: Phương án 1 - Apache Kafka**

### Lý do

1. **Event sourcing**: Có thể phát lại events cho debugging, analytics, consumers mới
2. **Throughput cao**: Xử lý 1000+ events/giây với khả năng tăng trưởng
3. **Mở rộng theo chiều ngang**: Thêm consumers mà không cần thay đổi producers
4. **Khả năng chịu lỗi**: Message được nhân bản, vượt qua lỗi broker
5. **Thứ tự message**: Quan trọng cho vòng đời chuyến đi (requested → accepted → started → completed)
6. **Tiêu chuẩn ngành**: Đã được chứng minh bởi Uber, Lyft trong gọi xe

### Quyết định Kiến trúc

```
┌─────────────────────────────────────────────────────────────┐
│                    Thiết kế Kafka Topics                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Topic: trip.requested (3 partitions)                       │
│  Producer: Trip Service                                     │
│  Consumers: Driver Service (thông báo tài xế gần đó)        │
│  Retention: 24 giờ                                          │
│  Key: tripId (đảm bảo thứ tự cho mỗi chuyến đi)             │
│                                                              │
│  Topic: trip.accepted (3 partitions)                        │
│  Producer: Driver Service                                   │
│  Consumers: Trip Service (cập nhật trạng thái chuyến đi)    │
│  Retention: 24 giờ                                          │
│                                                              │
│  Topic: driver.location.updated (6 partitions)              │
│  Producer: Driver Service                                   │
│  Consumers: Trip Service (theo dõi thời gian thực)          │
│  Retention: 1 giờ (khối lượng cao, tồn tại ngắn)            │
│  Key: driverId                                              │
│                                                              │
│  Topic: trip.completed (3 partitions)                       │
│  Producer: Driver Service                                   │
│  Consumers: Trip Service, Billing Service                   │
│  Retention: 7 ngày (cho đối soát thanh toán)                │
└─────────────────────────────────────────────────────────────┘
```

### Đánh đổi Được chấp nhận

**Độ phức tạp Tăng lên**:

- **Chấp nhận**: Team đầu tư thời gian học các khái niệm Kafka
- **Giảm thiểu**: Tài liệu toàn diện, thư viện Kafka client được chia sẻ

**Overhead Vận hành**:

- **Chấp nhận**: Cần giám sát Kafka brokers, consumer lag
- **Giảm thiểu**: Sử dụng AWS MSK (managed Kafka) trong production, cài đặt Docker đơn giản ở local

**Sử dụng Tài nguyên**:

- **Chấp nhận**: Kafka yêu cầu tài nguyên riêng biệt (CPU, memory, disk)
- **Giảm thiểu**: Chi phí được biện minh bởi throughput và reliability

---

## Chi tiết Triển khai

### Cài đặt Kafka (KRaft Mode, Không cần ZooKeeper)

```yaml
# docker-compose.yaml
kafka:
  image: confluentinc/cp-kafka:8.0.0
  environment:
    KAFKA_PROCESS_ROLES: broker,controller
    KAFKA_NODE_ID: 1
    KAFKA_CONTROLLER_QUORUM_VOTERS: 1@kafka:9093
    KAFKA_LISTENERS: PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093
    KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
    KAFKA_LOG_RETENTION_MS: 86400000 # 24 giờ
    KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
```

### Thư viện Kafka Client Được chia sẻ

```javascript
// common/shared/kafkaClient.js
class KafkaClient {
  async initProducer(options = {}) {
    this.producer = this.kafka.producer({
      maxInFlightRequests: 5,
      idempotent: false, // Cho PoC, ưu tiên hiệu suất
      batch: {
        size: 100, // Batch tối đa 100 messages
        timeout: 50, // hoặc đợi tối đa 50ms
      },
      compression: "gzip",
      ...options,
    });
    await this.producer.connect();
  }

  async initConsumer(groupId, options = {}) {
    this.consumer = this.kafka.consumer({
      groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      maxBytesPerPartition: 1048576, // 1MB
      ...options,
    });
    await this.consumer.connect();
  }
}
```

### Chuẩn hóa Event Schema

```javascript
// common/shared/eventSchemas.js
const TripRequestedEvent = {
  eventId: "uuid",
  eventType: "trip.requested",
  eventVersion: "1.0",
  timestamp: "2025-10-29T10:00:00Z",
  data: {
    tripId: "trip_123",
    passengerId: "user_456",
    pickup: { lat: 10.762622, lng: 106.660172, address: "UIT" },
    dropoff: { lat: 10.772622, lng: 106.670172, address: "Quận 1" },
    estimatedFare: 50000,
    vehicleType: "sedan",
  },
  metadata: {
    producedBy: "trip-service",
    environment: "production",
  },
};
```

### Ví dụ Producer (Trip Service)

```javascript
// services/trip-service/src/services/tripEventProducer.js
class TripEventProducer {
  async publishTripRequested(tripData) {
    const event = {
      eventId: uuidv4(),
      eventType: "trip.requested",
      timestamp: new Date().toISOString(),
      data: tripData,
    };

    await kafkaClient.sendMessage("trip.requested", {
      key: tripData.tripId, // Partition theo tripId để đảm bảo thứ tự
      value: JSON.stringify(event),
      headers: {
        "event-type": "trip.requested",
        "event-version": "1.0",
      },
    });

    logger.info("Published trip.requested event", { tripId: tripData.tripId });
  }
}
```

### Ví dụ Consumer (Driver Service)

```javascript
// services/driver-service/src/services/tripEventConsumer.js
class TripEventConsumer {
  async start() {
    await kafkaClient.subscribe(["trip.requested"]);

    await kafkaClient.consume(async ({ topic, partition, message }) => {
      const event = JSON.parse(message.value.toString());

      try {
        if (event.eventType === "trip.requested") {
          await this.handleTripRequested(event.data);
        }
      } catch (error) {
        logger.error("Failed to process event", { error, event });
        // Message sẽ được retry hoặc gửi đến DLQ
        throw error;
      }
    });
  }

  async handleTripRequested(tripData) {
    // Tìm tài xế gần đó
    const drivers = await locationService.findNearbyDrivers(
      tripData.pickup.lat,
      tripData.pickup.lng,
      5 // bán kính 5km
    );

    // Thông báo cho tài xế qua WebSocket
    for (const driver of drivers) {
      await notificationService.sendTripRequest(driver.id, tripData);
    }
  }
}
```

---

## Kiểm chứng & Kết quả

### Load Testing

**Kịch bản**: Mô phỏng 500 chuyến đi được yêu cầu đồng thời

```
Thiết lập:
- 500 người dùng ảo
- Mỗi người tạo một chuyến đi (produce event)
- Driver service consume events
- Thời lượng: 2 phút

Kết quả:
✅ Kafka produced: 500 events trong 2.3 giây (217 events/giây)
✅ Consumer lag: <100ms trung bình
✅ P95 end-to-end latency: 85ms
✅ Không mất message
✅ Consumer group rebalancing: <3 giây
✅ Broker CPU usage: 15%
✅ Broker memory usage: 450MB
```

### Trace Luồng Sự kiện

```
13:45:23.100 - Trip Service: Hành khách tạo chuyến đi
13:45:23.105 - Trip Service: Published trip.requested lên Kafka
13:45:23.125 - Kafka: Event được ghi vào partition 1
13:45:23.140 - Driver Service: Consumed trip.requested
13:45:23.142 - Driver Service: Query Redis tìm tài xế gần (5ms)
13:45:23.150 - Driver Service: Gửi thông báo đến 3 tài xế
13:45:23.180 - Driver App: Nhận yêu cầu chuyến đi (tổng: 80ms)
```

---

## Hậu quả

### Tích cực

- ✅ **Coupling lỏng**: Các dịch vụ không biết về nhau

  ```
  Trip Service → Kafka ← Driver Service
  (không phụ thuộc trực tiếp)
  ```

- ✅ **Mở rộng theo chiều ngang**: Thêm nhiều consumer instances

  ```
  Trước: 1 consumer, 100 events/giây
  Sau: 3 consumers, 300 events/giây (scaling tuyến tính)
  ```

- ✅ **Khả năng chịu lỗi**: Message không mất nếu consumer crash

  ```
  Consumer crashes → Message vẫn ở trong Kafka → Consumed bởi instance khác
  ```

- ✅ **Phát lại sự kiện**: Debug vấn đề production bằng cách replay events

  ```bash
  # Replay events giờ cuối
  kafka-consumer --topic trip.requested --from-beginning --max-messages 1000
  ```

- ✅ **Audit trail**: Tất cả sự kiện nghiệp vụ được log để tuân thủ

### Tiêu cực

- ⚠️ **Eventual consistency**: Events được xử lý bất đồng bộ

  - Chuyến đi được tạo trong Trip Service → Tài xế được thông báo 50-100ms sau
  - **Chấp nhận được**: Người dùng không nhận ra độ trễ <100ms

- ⚠️ **Độ phức tạp giám sát**: Cần theo dõi consumer lag, broker health

  - **Giảm thiểu**: Kafka Manager UI, CloudWatch metrics

- ⚠️ **Debug distributed flows**: Khó trace requests hơn
  - **Giảm thiểu**: Correlation IDs trong tất cả events, centralized logging

### Rủi ro & Giảm thiểu

| Rủi ro                               | Khả năng | Tác động | Giảm thiểu                                  |
| ------------------------------------ | -------- | -------- | ------------------------------------------- |
| **Consumer bị tụt lại phía sau**     | Trung    | Cao      | Giám sát consumer lag, auto-scale consumers |
| **Kafka broker failure**             | Thấp     | Cao      | Dùng 3 brokers với replication factor 2     |
| **Message trùng lặp**                | Trung    | Thấp     | Idempotent event handlers (dùng event IDs)  |
| **Thay đổi schema phá vỡ consumers** | Trung    | Trung    | Event versioning (trường eventVersion)      |

---

## Giám sát & Khả năng Quan sát

### Các Chỉ số Chính cần Giám sát

```
Producer Metrics:
- Tốc độ gửi record (mục tiêu: >100/giây)
- Tỷ lệ lỗi record (mục tiêu: <0.1%)
- Kích thước batch (mục tiêu: 50-100 records/batch)

Consumer Metrics:
- Consumer lag (mục tiêu: <100 messages)
- Tốc độ fetch (mục tiêu: >50/giây cho mỗi consumer)
- Thời gian xử lý (mục tiêu: <50ms cho mỗi event)

Broker Metrics:
- CPU usage (mục tiêu: <70%)
- Disk usage (mục tiêu: <80%)
- Network throughput (mục tiêu: <80% capacity)
```

### Quy tắc Cảnh báo

```yaml
# Cảnh báo consumer lag cao
- alert: ConsumerLagHigh
  expr: kafka_consumer_lag > 1000
  for: 5m
  annotations:
    summary: "Consumer {{ $labels.group }} đang bị tụt lại"

# Cảnh báo broker down
- alert: KafkaBrokerDown
  expr: up{job="kafka"} == 0
  for: 1m
  annotations:
    summary: "Kafka broker {{ $labels.instance }} đang down"
```

---

## Cải tiến Tương lai

### Giai đoạn 2: Stream Processing với Kafka Streams

```javascript
// Real-time analytics trên event stream
const stream = kafka
  .streams()
  .from("trip.completed")
  .map((trip) => ({
    hour: getHour(trip.completedAt),
    fare: trip.finalFare,
  }))
  .groupByKey("hour")
  .sum("fare")
  .to("analytics.hourly_revenue");
```

### Giai đoạn 3: CQRS với Event Sourcing

```javascript
// Rebuild trạng thái chuyến đi từ events
async function rebuildTripState(tripId) {
  const events = await kafka.readEvents("trip.*", { key: tripId });

  let state = { status: "requested" };
  for (const event of events) {
    state = applyEvent(state, event);
  }
  return state;
}
```

---

## Các Phương án thay thế cho Use Cases Cụ thể

### Khi nào dùng REST thay vì Kafka:

- **Cần phản hồi ngay lập tức**: Xử lý thanh toán, xác thực
- **Request-reply đơn giản**: Lấy profile người dùng, kiểm tra tài xế có sẵn
- **Độ trễ thấp quan trọng**: Yêu cầu <10ms

### Khi nào dùng SQS/SNS:

- **Khối lượng thấp**: <100 messages/giây
- **Không cần phát lại event**: Thông báo fire-and-forget
- **Ops tối thiểu**: Fully managed, không bảo trì

### Khi nào dùng RabbitMQ:

- **Routing phức tạp**: Topic exchanges, header-based routing
- **RPC patterns**: Request-reply với correlation IDs
- **Tích hợp legacy**: Yêu cầu giao thức AMQP

---

## Các Hành động Tiếp theo

- [x] Cài đặt Kafka trong docker-compose (2025-10-16)
- [x] Tạo thư viện Kafka client được chia sẻ (2025-10-17)
- [x] Triển khai trip lifecycle events (2025-10-18)
- [x] Thêm giám sát consumer lag (2025-10-19)
- [x] Load test event throughput (2025-10-20)
- [ ] Cài đặt AWS MSK trong staging (2025-11-01)
- [ ] Triển khai dead letter queue (2025-11-05)
- [ ] Tài liệu hóa event schemas trong wiki (2025-11-10)

---

## Tài liệu Tham khảo

- [Apache Kafka Documentation](https://kafka.apache.org/documentation/)
- [Kafka: The Definitive Guide](https://www.confluent.io/resources/kafka-the-definitive-guide/)
- [Uber's Event-Driven Architecture](https://eng.uber.com/microservice-architecture/)
- [AWS MSK Best Practices](https://docs.aws.amazon.com/msk/latest/developerguide/bestpractices.html)
- Kết quả Load Test: `test/load-tests/STRESS_TEST_REPORT.md`
- Event Schemas: `common/shared/eventSchemas.js`

---

**Reviewed by**: Architecture Team  
**Approved by**: Tech Lead  
**Next Review**: 2025-12-01 (sau 1 tháng trong production)
