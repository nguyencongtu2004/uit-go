# Kafka Testing Guide - UIT-Go Event-Driven Architecture

## 📋 Tổng quan

Thư mục này chứa các script test cho Kafka Event-Driven Architecture của UIT-Go. Các script này giúp verify và test khả năng load của hệ thống với target **1000 drivers** và **100 concurrent trips**.

## 🗂️ Cấu trúc Files

```
test/test-kafka/
├── package.json                 # Dependencies for Kafka testing
├── test-kafka-docker.js         # Test từ trong Docker network
├── test-event-flow.js           # Test event flow từ host machine
├── test-producer-consumer.js    # Test producer-consumer pattern
├── direct-setup-topics.js       # Setup Kafka topics directly
└── README.md                    # Hướng dẫn này
```

## 🚀 Cách sử dụng

### 1. Prerequisite Setup

**Đảm bảo Kafka đang chạy:**

```powershell
# Start infrastructure
docker compose up -d kafka redis mongodb-users mongodb-drivers mongodb-trips

# Check Kafka health
docker compose ps kafka
```

**Install dependencies:**

```powershell
cd test/test-kafka
npm install kafkajs
```

### 2. Các Scripts Test

#### 🔧 **test-kafka-docker.js** - Test từ Docker Network

```powershell
# Chạy test từ trong Docker network (recommended)
cd test/test-kafka
docker run --rm --network uit-go_uit-go-network -v ${PWD}:/workspace -w /workspace node:18-alpine sh -c "npm install kafkajs && node test-kafka-docker.js"
```

**Mục đích:** Test kết nối Kafka từ bên trong Docker network để verify internal communication.

#### 📤 **test-event-flow.js** - Test Event Flow từ Host

```powershell
cd test/test-kafka
node test-event-flow.js
```

**Mục đích:** Test end-to-end event flow từ host machine qua external port `localhost:9094`.

#### 🔄 **test-producer-consumer.js** - Test Producer-Consumer Pattern

```powershell
cd test/test-kafka
node test-producer-consumer.js
```

**Mục đích:** Test producer-consumer flow với message consumption verification.

#### ⚙️ **direct-setup-topics.js** - Direct Topic Setup

```powershell
cd test/test-kafka
node direct-setup-topics.js
```

**Mục đích:** Tạo Kafka topics trực tiếp nếu cần thiết.

### 3. Scripts trong thư mục chính

#### 📋 **scripts/setup-kafka-topics.js** - Official Topic Setup

```powershell
# Từ root directory
node scripts/setup-kafka-topics.js
```

**Mục đích:** Script chính thức để setup topics sử dụng Event Schemas.

#### 🔍 **scripts/test-event-flow.js** - Load Test Script

```powershell
# Từ root directory
node scripts/test-event-flow.js
```

**Mục đích:** Script load testing hoàn chỉnh với target 1000 drivers + 100 trips.

## 🎯 Load Testing Scenarios

### Scenario 1: Basic Connectivity Test

```powershell
# 1. Test Docker network connectivity
cd test/test-kafka
docker run --rm --network uit-go_uit-go-network -v ${PWD}:/workspace -w /workspace node:18-alpine sh -c "npm install kafkajs && node test-kafka-docker.js"

# 2. Test host machine connectivity
node test-event-flow.js
```

### Scenario 2: Producer-Consumer Verification

```powershell
cd test/test-kafka
node test-producer-consumer.js
```

### Scenario 3: Full Load Test

```powershell
# Từ root directory
node scripts/test-event-flow.js
```

## 📊 Expected Results

### ✅ Successful Test Output:

```
🚀 Testing Event-Driven Architecture...
✅ Producer connected to localhost:9094
📤 Sending realistic UIT-Go events...
✅ Sent TRIP_REQUESTED to trip-events
✅ Sent LOCATION_UPDATE to location-updates
✅ Sent DRIVER_FOUND to user-notifications

🎉 Event-Driven Architecture test completed successfully!
📊 Test Results:
  - ✅ Kafka connection: Working (localhost:9094)
  - ✅ Event production: Working
  - ✅ All topics: Ready
  - ✅ Trip workflow: Simulated

🚀 Ready for stress testing with:
  - 1000 drivers updating location every 5 seconds
  - 100 concurrent trips
  - Real-time event processing
```

### 🏗️ Architecture Verification:

```
🏗️  UIT-Go Event-Driven Architecture Status Check
============================================================
✅ Kafka Connection: Connected (localhost:9094)

📋 Topic Status:
  ✅ trip-events: Ready (10 partitions)
  ✅ location-updates: Ready (20 partitions)
  ✅ user-notifications: Ready (5 partitions)

🎉 Event-Driven Architecture: READY FOR LOAD TESTING!
```

## 🔧 Troubleshooting

### Problem 1: Connection Failed

```
❌ Error: getaddrinfo ENOTFOUND kafka
```

**Solution:**

```powershell
# 1. Check Kafka container
docker compose ps kafka

# 2. Use external port for host machine
# In scripts, use: brokers: ['localhost:9094']

# 3. For Docker network, use: brokers: ['kafka:9092']
```

### Problem 2: Topics Not Found

```
❌ Topic 'trip-events' does not exist
```

**Solution:**

```powershell
# Setup topics first
node scripts/setup-kafka-topics.js

# Or use direct setup
cd test/test-kafka
node direct-setup-topics.js
```

### Problem 3: Producer Timeout

```
❌ Connection timeout
```

**Solution:**

```powershell
# 1. Check Kafka health
docker compose ps kafka

# 2. Check port accessibility
Test-NetConnection -ComputerName localhost -Port 9094

# 3. Restart Kafka if needed
docker compose restart kafka
```

## 🌐 Port Configuration

### Internal Access (Containers):

- **kafka:9092** - For microservices communication
- Used in: Docker network tests, production services

### External Access (Host Machine):

- **localhost:9094** - For testing from host machine
- Used in: Development testing, load testing scripts

### Controller:

- **kafka:9093** - Kafka controller protocol
- Used internally by Kafka

## 📈 Performance Targets

### Load Testing Goals:

- ✅ **1000 drivers** × location updates every 5 seconds = **200 events/sec**
- ✅ **100 concurrent trips** with lifecycle events
- ✅ **Real-time notifications** for user experience
- ✅ **Message throughput** > 300 events/second
- ✅ **Latency** < 100ms for event processing

### Topic Configuration:

```javascript
{
  'trip-events': {
    partitions: 10,        // Parallel processing for trips
    retention: '24 hours'  // Trip lifecycle data
  },
  'location-updates': {
    partitions: 20,        // High throughput for driver locations
    retention: '1 hour'    // Recent position data only
  },
  'user-notifications': {
    partitions: 5,         // User alerts and updates
    retention: '7 days'    // Notification history
  }
}
```

## 🔄 Workflow Integration

### 1. Development Testing:

```powershell
# Quick connectivity test
cd test/test-kafka && node test-event-flow.js
```

### 2. CI/CD Pipeline:

```powershell
# Add to CI pipeline
npm run test:kafka
```

### 3. Load Testing:

```powershell
# Full load test
node scripts/test-event-flow.js
```

### 4. Monitoring:

```powershell
# Check architecture status
cd test/test-kafka && node check-kafka-architecture.js
```

## 💡 Best Practices

1. **Always test Docker network first** - Use `test-kafka-docker.js`
2. **Use external port for host testing** - `localhost:9094`
3. **Verify topic creation** before running load tests
4. **Monitor Kafka logs** during testing: `docker compose logs kafka -f`
5. **Check container health** regularly: `docker compose ps`

## 🎉 Completion Checklist

- [ ] ✅ Kafka containers running and healthy
- [ ] ✅ Topics created (trip-events, location-updates, user-notifications)
- [ ] ✅ Docker network connectivity verified
- [ ] ✅ Host machine connectivity verified
- [ ] ✅ Producer-Consumer flow working
- [ ] ✅ Event serialization/deserialization working
- [ ] ✅ Load test ready for 1000 drivers + 100 trips

---

**🚀 Event-Driven Architecture Status: READY FOR UIT-GO LOAD TESTING!**
