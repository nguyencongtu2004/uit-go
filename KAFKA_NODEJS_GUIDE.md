# Hướng dẫn sử dụng Apache Kafka với Node.js

## 📖 Tổng quan

Tài liệu này tóm tắt cách sử dụng Apache Kafka trong Node.js thông qua thư viện **KafkaJS**, dựa trên ví dụ thực tế từ dự án Kafka Test Application.

## 🛠️ Cài đặt và thiết lập

### 1. Cài đặt dependencies

```bash
npm install kafkajs express cors
npm install -D nodemon
```

### 2. Cấu hình Kafka Client

```javascript
// kafka-config.js
const { Kafka } = require("kafkajs");

const kafka = new Kafka({
  clientId: "kafka-test-app",
  brokers: ["kafka:9092"], // Kafka broker addresses
  retry: {
    initialRetryTime: 100,
    retries: 8,
  },
});

module.exports = kafka;
```

**Các tham số quan trọng:**

- `clientId`: Định danh duy nhất cho client
- `brokers`: Danh sách Kafka brokers
- `retry`: Cấu hình retry khi kết nối thất bại

## 📨 Kafka Producer

### Tạo Producer class

```javascript
// producer.js
const kafka = require("./kafka-config");

class KafkaProducer {
  constructor() {
    this.producer = kafka.producer();
    this.isConnected = false;
  }

  async connect() {
    try {
      await this.producer.connect();
      this.isConnected = true;
      console.log("Kafka Producer connected successfully");
    } catch (error) {
      console.error("Failed to connect Kafka Producer:", error);
      throw error;
    }
  }

  async sendMessage(topic, messages) {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const result = await this.producer.send({
        topic,
        messages: Array.isArray(messages) ? messages : [messages],
      });

      console.log("Message sent successfully:", result);
      return result;
    } catch (error) {
      console.error("Failed to send message:", error);
      throw error;
    }
  }

  async sendBatchMessages(topic, messagesArray) {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const result = await this.producer.sendBatch({
        topicMessages: [
          {
            topic,
            messages: messagesArray,
          },
        ],
      });

      console.log("Batch messages sent successfully:", result);
      return result;
    } catch (error) {
      console.error("Failed to send batch messages:", error);
      throw error;
    }
  }

  async disconnect() {
    if (this.isConnected) {
      await this.producer.disconnect();
      this.isConnected = false;
      console.log("Kafka Producer disconnected");
    }
  }
}
```

### Sử dụng Producer

```javascript
const producer = new KafkaProducer();

// Gửi single message
await producer.sendMessage("test-topic", {
  key: "user-123",
  value: JSON.stringify({
    userId: 123,
    action: "login",
    timestamp: new Date().toISOString(),
  }),
});

// Gửi batch messages
await producer.sendBatchMessages("test-topic", [
  { key: "user-1", value: JSON.stringify({ data: "message 1" }) },
  { key: "user-2", value: JSON.stringify({ data: "message 2" }) },
]);
```

## 📥 Kafka Consumer

### Tạo Consumer class

```javascript
// consumer.js
const kafka = require("./kafka-config");

class KafkaConsumer {
  constructor(groupId = "default-consumer-group") {
    this.consumer = kafka.consumer({ groupId });
    this.isConnected = false;
    this.messageHandlers = new Map();
  }

  async connect() {
    try {
      await this.consumer.connect();
      this.isConnected = true;
      console.log("Kafka Consumer connected successfully");
    } catch (error) {
      console.error("Failed to connect Kafka Consumer:", error);
      throw error;
    }
  }

  async subscribe(topics) {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const topicArray = Array.isArray(topics) ? topics : [topics];

      for (const topic of topicArray) {
        await this.consumer.subscribe({ topic });
        console.log(`Subscribed to topic: ${topic}`);
      }
    } catch (error) {
      console.error("Failed to subscribe to topics:", error);
      throw error;
    }
  }

  setMessageHandler(topic, handler) {
    this.messageHandlers.set(topic, handler);
  }

  async startConsuming() {
    if (!this.isConnected) {
      throw new Error("Consumer is not connected");
    }

    try {
      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            const messageData = {
              topic,
              partition,
              offset: message.offset,
              key: message.key ? message.key.toString() : null,
              value: message.value ? message.value.toString() : null,
              timestamp: message.timestamp,
              headers: message.headers,
            };

            console.log(`Received message from topic ${topic}:`, messageData);

            // Gọi handler specific cho topic này
            const handler = this.messageHandlers.get(topic);
            if (handler) {
              await handler(messageData);
            }
          } catch (error) {
            console.error("Error processing message:", error);
          }
        },
      });

      console.log("Consumer started successfully");
    } catch (error) {
      console.error("Failed to start consumer:", error);
      throw error;
    }
  }

  async pause(topics) {
    const topicArray = Array.isArray(topics) ? topics : [topics];
    const topicPartitions = topicArray.map((topic) => ({ topic }));
    await this.consumer.pause(topicPartitions);
    console.log("Consumer paused for topics:", topicArray);
  }

  async resume(topics) {
    const topicArray = Array.isArray(topics) ? topics : [topics];
    const topicPartitions = topicArray.map((topic) => ({ topic }));
    await this.consumer.resume(topicPartitions);
    console.log("Consumer resumed for topics:", topicArray);
  }

  async disconnect() {
    if (this.isConnected) {
      await this.consumer.disconnect();
      this.isConnected = false;
      console.log("Kafka Consumer disconnected");
    }
  }
}
```

### Sử dụng Consumer

```javascript
const consumer = new KafkaConsumer("my-consumer-group");

// Thiết lập message handler
consumer.setMessageHandler("user-events", async (message) => {
  const userData = JSON.parse(message.value);
  console.log("Processing user event:", userData);

  // Xử lý business logic
  await processUserEvent(userData);
});

// Kết nối và bắt đầu consume
await consumer.connect();
await consumer.subscribe(["user-events", "system-events"]);
await consumer.startConsuming();
```

## ⚙️ Kafka Admin

### Tạo Admin class

```javascript
// admin.js
const kafka = require("./kafka-config");

class KafkaAdmin {
  constructor() {
    this.admin = kafka.admin();
    this.isConnected = false;
  }

  async connect() {
    try {
      await this.admin.connect();
      this.isConnected = true;
      console.log("Kafka Admin connected successfully");
    } catch (error) {
      console.error("Failed to connect Kafka Admin:", error);
      throw error;
    }
  }

  async createTopics(topics) {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const topicConfigs = topics.map((topic) => ({
        topic: typeof topic === "string" ? topic : topic.topic,
        numPartitions: typeof topic === "string" ? 1 : topic.numPartitions || 1,
        replicationFactor:
          typeof topic === "string" ? 1 : topic.replicationFactor || 1,
      }));

      const result = await this.admin.createTopics({
        topics: topicConfigs,
      });

      console.log("Topics created:", result);
      return result;
    } catch (error) {
      console.error("Failed to create topics:", error);
      throw error;
    }
  }

  async listTopics() {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const topics = await this.admin.listTopics();
      console.log("Available topics:", topics);
      return topics;
    } catch (error) {
      console.error("Failed to list topics:", error);
      throw error;
    }
  }

  async deleteTopics(topics) {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const result = await this.admin.deleteTopics({
        topics: Array.isArray(topics) ? topics : [topics],
      });

      console.log("Topics deleted:", result);
      return result;
    } catch (error) {
      console.error("Failed to delete topics:", error);
      throw error;
    }
  }

  async disconnect() {
    if (this.isConnected) {
      await this.admin.disconnect();
      this.isConnected = false;
      console.log("Kafka Admin disconnected");
    }
  }
}
```

### Sử dụng Admin

```javascript
const admin = new KafkaAdmin();

// Tạo topics
await admin.createTopics([
  "user-events",
  {
    topic: "high-volume-events",
    numPartitions: 3,
    replicationFactor: 1,
  },
]);

// Liệt kê topics
const topics = await admin.listTopics();
console.log("All topics:", topics);

// Xóa topic
await admin.deleteTopics(["old-topic"]);
```

## 🔄 Pattern sử dụng thực tế

### 1. Initialization Pattern

```javascript
// index.js
const express = require("express");
const KafkaProducer = require("./producer");
const KafkaConsumer = require("./consumer");
const KafkaAdmin = require("./admin");

const app = express();
const producer = new KafkaProducer();
const consumer = new KafkaConsumer("api-consumer");
const admin = new KafkaAdmin();

async function initializeKafka() {
  try {
    // 1. Kết nối Admin và tạo topics
    await admin.connect();
    await admin.createTopics(["events", "notifications"]);

    // 2. Kết nối Consumer và subscribe
    await consumer.connect();
    await consumer.subscribe(["events"]);

    // 3. Thiết lập message handlers
    consumer.setMessageHandler("events", handleEventMessage);

    // 4. Bắt đầu consuming
    await consumer.startConsuming();

    console.log("Kafka initialized successfully");
  } catch (error) {
    console.error("Failed to initialize Kafka:", error);
  }
}

async function handleEventMessage(message) {
  try {
    const event = JSON.parse(message.value);
    console.log("Processing event:", event);

    // Business logic processing
    await processBusinessEvent(event);
  } catch (error) {
    console.error("Error processing event:", error);
  }
}

// Khởi tạo khi start app
initializeKafka();
```

### 2. API Integration Pattern

```javascript
// Express API endpoints
app.post("/api/events", async (req, res) => {
  try {
    const eventData = {
      id: generateId(),
      type: req.body.type,
      payload: req.body.payload,
      timestamp: new Date().toISOString(),
    };

    // Gửi event vào Kafka
    await producer.sendMessage("events", {
      key: eventData.id,
      value: JSON.stringify(eventData),
    });

    res.json({ success: true, eventId: eventData.id });
  } catch (error) {
    console.error("Error publishing event:", error);
    res.status(500).json({ error: "Failed to publish event" });
  }
});
```

### 3. Graceful Shutdown Pattern

```javascript
// Graceful shutdown handling
process.on("SIGTERM", async () => {
  console.log("Shutting down gracefully...");
  try {
    await consumer.disconnect();
    await producer.disconnect();
    await admin.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
});

process.on("SIGINT", async () => {
  console.log("Shutting down gracefully...");
  try {
    await consumer.disconnect();
    await producer.disconnect();
    await admin.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
});
```

## 🐳 Docker Integration

### Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

CMD ["npm", "start"]
```

### Docker Compose

```yaml
version: "3.8"

services:
  kafka-app:
    build: .
    container_name: kafka-app
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    depends_on:
      - kafka
    networks:
      - kafka-network
    restart: unless-stopped

  kafka:
    image: confluentinc/cp-kafka:8.0.0
    container_name: kafka
    ports:
      - "9092:9092"
    environment:
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_NODE_ID: 1
      KAFKA_BROKER_ID: 1
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@kafka:9093
      KAFKA_LISTENERS: PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_LOG_DIRS: /var/lib/kafka/data
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
      CLUSTER_ID: MkU3OEVBNTcwNTJENDM2Qk
    volumes:
      - kafka_data:/var/lib/kafka/data
    networks:
      - kafka-network

volumes:
  kafka_data:

networks:
  kafka-network:
    driver: bridge
```

## 🔧 Best Practices

### 1. Error Handling

```javascript
// Robust error handling với retry logic
class RobustKafkaProducer {
  async sendMessageWithRetry(topic, message, maxRetries = 3) {
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        return await this.sendMessage(topic, message);
      } catch (error) {
        attempt++;
        console.error(`Send attempt ${attempt} failed:`, error);

        if (attempt >= maxRetries) {
          throw new Error(
            `Failed to send message after ${maxRetries} attempts`
          );
        }

        // Exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        );
      }
    }
  }
}
```

### 2. Message Serialization

```javascript
// Consistent message format
class MessageSerializer {
  static serialize(type, payload, metadata = {}) {
    return JSON.stringify({
      id: generateUUID(),
      type,
      payload,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
        version: "1.0",
      },
    });
  }

  static deserialize(messageValue) {
    try {
      return JSON.parse(messageValue);
    } catch (error) {
      console.error("Failed to deserialize message:", error);
      throw new Error("Invalid message format");
    }
  }
}

// Sử dụng
await producer.sendMessage("events", {
  key: userId,
  value: MessageSerializer.serialize("USER_LOGIN", { userId, deviceId }),
});
```

### 3. Consumer Group Strategy

```javascript
// Multiple consumers cho high throughput
const consumers = [];

for (let i = 0; i < 3; i++) {
  const consumer = new KafkaConsumer(`worker-group-${i}`);
  consumers.push(consumer);

  await consumer.connect();
  await consumer.subscribe(["high-volume-topic"]);
  await consumer.startConsuming();
}
```

### 4. Monitoring và Health Checks

```javascript
// Health check endpoint
app.get("/health", async (req, res) => {
  try {
    const health = {
      status: "OK",
      timestamp: new Date().toISOString(),
      kafka: {
        producer: producer.isConnected,
        consumer: consumer.isConnected,
        admin: admin.isConnected,
      },
    };

    // Test Kafka connectivity
    if (admin.isConnected) {
      await admin.listTopics();
    }

    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: "ERROR",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});
```

## 📊 Performance Tips

### 1. Batch Processing

```javascript
// Batch processing cho high throughput
class BatchProcessor {
  constructor(batchSize = 100, flushInterval = 5000) {
    this.batch = [];
    this.batchSize = batchSize;
    this.flushInterval = flushInterval;

    // Auto flush theo interval
    setInterval(() => this.flush(), flushInterval);
  }

  async addMessage(topic, message) {
    this.batch.push({ topic, message });

    if (this.batch.length >= this.batchSize) {
      await this.flush();
    }
  }

  async flush() {
    if (this.batch.length === 0) return;

    const messagesToSend = [...this.batch];
    this.batch = [];

    try {
      await producer.sendBatchMessages("batch-topic", messagesToSend);
      console.log(`Flushed ${messagesToSend.length} messages`);
    } catch (error) {
      console.error("Batch flush failed:", error);
      // Re-add to batch for retry
      this.batch.unshift(...messagesToSend);
    }
  }
}
```

### 2. Connection Pooling

```javascript
// Connection pool pattern
class KafkaConnectionPool {
  constructor(poolSize = 5) {
    this.producers = [];
    this.currentIndex = 0;

    for (let i = 0; i < poolSize; i++) {
      this.producers.push(new KafkaProducer());
    }
  }

  async getProducer() {
    const producer = this.producers[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.producers.length;

    if (!producer.isConnected) {
      await producer.connect();
    }

    return producer;
  }

  async sendMessage(topic, message) {
    const producer = await this.getProducer();
    return producer.sendMessage(topic, message);
  }
}
```

## 🚨 Common Issues và Solutions

### 1. Connection Issues

```javascript
// Retry connection với exponential backoff
async function connectWithRetry(component, maxRetries = 5) {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      await component.connect();
      return;
    } catch (error) {
      attempt++;
      console.error(`Connection attempt ${attempt} failed:`, error);

      if (attempt >= maxRetries) {
        throw new Error(`Failed to connect after ${maxRetries} attempts`);
      }

      await new Promise((resolve) =>
        setTimeout(resolve, Math.pow(2, attempt) * 1000)
      );
    }
  }
}
```

### 2. Message Ordering

```javascript
// Đảm bảo message ordering với key
await producer.sendMessage("ordered-topic", {
  key: "user-123", // Cùng key sẽ vào cùng partition
  value: JSON.stringify({
    sequence: 1,
    userId: 123,
    action: "step1",
  }),
});
```

### 3. Dead Letter Queue

```javascript
// Dead letter queue pattern
consumer.setMessageHandler("main-topic", async (message) => {
  try {
    await processMessage(message);
  } catch (error) {
    console.error("Failed to process message:", error);

    // Gửi vào dead letter queue
    await producer.sendMessage("dead-letter-queue", {
      key: message.key,
      value: JSON.stringify({
        originalMessage: message,
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
    });
  }
});
```

## 📝 Testing

### Unit Test Example

```javascript
// Jest test example
const KafkaProducer = require("./producer");

jest.mock("./kafka-config", () => ({
  producer: () => ({
    connect: jest.fn(),
    send: jest.fn(),
    disconnect: jest.fn(),
  }),
}));

describe("KafkaProducer", () => {
  let producer;

  beforeEach(() => {
    producer = new KafkaProducer();
  });

  test("should send message successfully", async () => {
    const mockResult = [{ topicName: "test", partition: 0 }];
    producer.producer.send.mockResolvedValue(mockResult);

    const result = await producer.sendMessage("test-topic", {
      value: "test message",
    });

    expect(result).toEqual(mockResult);
    expect(producer.producer.send).toHaveBeenCalledWith({
      topic: "test-topic",
      messages: [{ value: "test message" }],
    });
  });
});
```

## 🎯 Kết luận

Kafka với Node.js là một giải pháp mạnh mẽ cho:

- **Event-driven architecture**
- **Microservices communication**
- **Real-time data streaming**
- **Distributed systems**

### Key Takeaways:

1. **KafkaJS** là thư viện chính thức và mạnh mẽ nhất
2. **Connection management** quan trọng cho performance
3. **Error handling** và **retry logic** cần thiết
4. **Graceful shutdown** đảm bảo data integrity
5. **Docker** giúp deployment và scaling dễ dàng
6. **Monitoring** và **health checks** cần thiết cho production

### Bước tiếp theo:

- Implement **transaction support** cho ACID properties
- Thêm **metrics và monitoring** với Prometheus
- Setup **schema registry** cho data governance
- Implement **stream processing** với Kafka Streams equivalent

---

_Tài liệu này dựa trên ví dụ thực tế từ Kafka Test Application. Tham khảo thêm tại [KafkaJS Documentation](https://kafka.js.org/)_
