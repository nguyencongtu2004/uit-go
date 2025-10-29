# 🎯 UIT-Go Event-Driven Architecture Testing Guide

Hướng dẫn đầy đủ để test và sử dụng Event-Driven Architecture cho hệ thống UIT-Go.

## 📁 Cấu trúc Testing

```
scripts/
├── test-kafka.js           # Script tích hợp chính
├── setup-kafka-topics.js   # Setup topics chính thức
└── test-event-flow.js       # Load test simulation

test/test-kafka/
├── package.json             # Dependencies cho testing
├── README.md               # Chi tiết kỹ thuật
├── test-kafka-docker.js    # Test Docker network
├── test-event-flow.js      # Test từ host machine
├── test-producer-consumer.js # Test flow cơ bản
└── direct-setup-topics.js  # Setup topics trực tiếp
```

## 🚀 Hướng dẫn Sử dụng Nhanh

### 1. Khởi động hệ thống

```bash
# Khởi động toàn bộ hệ thống
docker compose up -d

# Chờ Kafka khởi động hoàn toàn (~30-60 giây)
docker compose logs -f kafka
```

### 2. Chạy test suite đầy đủ

```bash
# Test cơ bản
node scripts/test-kafka.js

# Test đầy đủ bao gồm load test
node scripts/test-kafka.js --load-test
```

### 3. Chạy test đơn lẻ

```bash
# Kiểm tra health
node scripts/test-kafka.js health

# Test kết nối Docker
node scripts/test-kafka.js docker

# Test kết nối host machine
node scripts/test-kafka.js host

# Test producer-consumer flow
node scripts/test-kafka.js producer-consumer

# Chạy load test
node scripts/test-kafka.js load
```

## 🎛️ Test Suite Chi tiết

### Test 1: Kafka Health Check

- Kiểm tra container Kafka running
- Test connectivity tới Kafka broker
- Verify topics có thể list được

### Test 2: Topic Setup

- Tạo topics với Event Schema
- Verify partitioning và replication
- Check topic configurations

### Test 3: Docker Network Test

- Test kết nối từ container khác
- Verify internal networking (kafka:9092)
- Test producer/consumer trong Docker

### Test 4: Host Connectivity Test

- Test kết nối từ host machine
- Verify external listener (localhost:9094)
- Test metadata fetch và connectivity

### Test 5: Producer-Consumer Flow

- Test cơ bản produce/consume messages
- Verify message ordering
- Test multiple partitions

### Test 6: Load Test Simulation

- **1000 drivers** update location mỗi 5 giây
- **100 concurrent trips** với state transitions
- **Real-time notifications** cho users
- Performance metrics và monitoring

## 🎯 Performance Targets

| Metric           | Target       | Notes                         |
| ---------------- | ------------ | ----------------------------- |
| Location Updates | 200 msg/sec  | 1000 drivers × 5 sec interval |
| Trip Events      | 50 msg/sec   | 100 concurrent trips          |
| Message Latency  | < 100ms      | Producer to consumer          |
| Throughput       | 1000 msg/sec | Peak capacity                 |
| Memory Usage     | < 2GB        | Kafka + test clients          |

## 🐛 Troubleshooting

### Kafka không khởi động

```bash
# Check logs
docker compose logs kafka

# Restart Kafka
docker compose restart kafka

# Recreate if needed
docker compose down && docker compose up -d
```

### Connection refused errors

```bash
# Verify port mapping
docker compose ps

# Check network
docker network ls
docker network inspect uit-go_uit-go-network

# Test connectivity
telnet localhost 9094
```

### Topics không tạo được

```bash
# Manual topic creation
docker exec kafka kafka-topics \
  --bootstrap-server localhost:9092 \
  --create --topic test-topic \
  --partitions 3 --replication-factor 1
```

### Performance issues

```bash
# Monitor resource usage
docker stats kafka

# Check partition distribution
docker exec kafka kafka-topics \
  --bootstrap-server localhost:9092 \
  --describe
```

## 🔧 Advanced Usage

### Chạy test riêng từ test directory

```bash
cd test/test-kafka

# Install dependencies
npm install

# Run specific tests
npm run test:docker
npm run test:producer-consumer
npm run setup:topics
```

### Customize test parameters

```bash
# Set environment variables
export KAFKA_BROKERS=localhost:9094
export TEST_DURATION=300000
export DRIVER_COUNT=2000

# Run with custom settings
node scripts/test-kafka.js --load-test
```

### Monitor real-time performance

```bash
# Monitor topics
docker exec kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic location-updates \
  --from-beginning

# Monitor trip events
docker exec kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic trip-events \
  --from-beginning
```

## 🏗️ Kiến trúc Event-Driven

### Core Events

- **location-updates**: Driver location theo thời gian thực
- **trip-events**: Trip lifecycle events
- **user-notifications**: Real-time notifications

### Event Flow

```
Driver App → location-updates → DriverService → Redis GeoHash
Passenger App → trip-events → TripService → Driver Matching
System → user-notifications → WebSocket → Client Apps
```

### Scaling Strategy

- **Horizontal Scaling**: Increase Kafka partitions
- **Consumer Groups**: Multiple service instances
- **Load Balancing**: Traefik auto-discovery
- **Caching**: Redis for hot data

## 📈 Production Readiness

### Monitoring

- **Kafka Metrics**: JMX endpoints
- **Application Metrics**: Prometheus/Grafana
- **Alerting**: CloudWatch/Slack integration
- **Performance**: k6 load testing

### Security

- **Network**: VPC và Security Groups
- **Authentication**: JWT tokens
- **Encryption**: TLS for Kafka
- **Secrets**: AWS Secrets Manager

### High Availability

- **Kafka**: Multi-AZ deployment
- **Database**: MongoDB Replica Sets
- **Cache**: Redis Cluster
- **Load Balancer**: Multiple AZ

## 🎉 Kết luận

Sau khi chạy thành công test suite, Event-Driven Architecture đã sẵn sàng cho:

- ✅ **Real-time location tracking**
- ✅ **Scalable trip management**
- ✅ **High-throughput event processing**
- ✅ **Fault-tolerant messaging**
- ✅ **Production-ready deployment**

**Tiếp theo**: Deploy lên AWS EKS với full monitoring và auto-scaling!
