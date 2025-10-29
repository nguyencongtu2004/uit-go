# ADR 002: Event-Driven Architecture with Apache Kafka

**Status**: Accepted  
**Date**: 2025-10-16  
**Deciders**: Technical Architecture Team  
**Tags**: `architecture`, `messaging`, `scalability`, `microservices`

---

## Context and Problem Statement

In a ride-hailing platform, multiple services need to coordinate and react to business events (trip requested, trip accepted, driver location updated, etc.). We need a reliable communication mechanism that:

- **Decouples services**: Services shouldn't directly depend on each other
- **Handles high throughput**: 1000+ events/second during peak hours
- **Guarantees delivery**: Critical events must not be lost
- **Enables event sourcing**: Audit trail of all business events
- **Scales horizontally**: Can add more consumers as load increases

We needed to choose between:

1. **Apache Kafka** - Distributed event streaming platform
2. **Direct HTTP/REST calls** - Synchronous service-to-service communication
3. **AWS SQS/SNS** - Managed message queue service
4. **RabbitMQ** - Traditional message broker

---

## Decision Drivers

### Functional Requirements

- **Event streaming**: Publish business events to multiple consumers
- **Guaranteed delivery**: At-least-once delivery semantics
- **Message ordering**: Maintain order per partition key (e.g., tripId)
- **Event replay**: Ability to reprocess historical events
- **Consumer groups**: Multiple instances consuming in parallel

### Non-Functional Requirements

- **Throughput**: Handle 1000+ messages/second
- **Latency**: <100ms end-to-end event delivery
- **Scalability**: Horizontal scaling for producers and consumers
- **Fault tolerance**: Survive broker failures without data loss
- **Operational complexity**: Manageable for small team

---

## Considered Options

### Option 1: Apache Kafka (Event Streaming Platform)

**Description**: Distributed commit log designed for high-throughput event streaming.

**Pros**:

- ✅ **High throughput**: Millions of messages/second capability
- ✅ **Event sourcing**: Messages retained for configurable time (we use 24h-7days)
- ✅ **Horizontal scaling**: Add brokers and partitions as needed
- ✅ **Consumer groups**: Parallel processing with automatic load balancing
- ✅ **Fault tolerance**: Replication across brokers
- ✅ **Message ordering**: Guaranteed within partition
- ✅ **Exactly-once semantics**: Available (though we use at-least-once)
- ✅ **Battle-tested**: Used by Uber, LinkedIn, Netflix
- ✅ **KRaft mode**: No ZooKeeper dependency in modern versions

**Cons**:

- ❌ **Operational complexity**: More complex than SQS/SNS
- ❌ **Resource intensive**: Requires dedicated broker instances
- ❌ **Learning curve**: Team needs to learn Kafka concepts
- ❌ **Overkill for small scale**: May be too much for <100 msg/s

**Architecture**:

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

**Cost** (AWS MSK):

- 3 brokers (m5.large): ~$500/month
- Storage (500GB): ~$50/month
- **Total**: ~$550/month

**Local Development**:

- Docker image: confluentinc/cp-kafka
- KRaft mode (no ZooKeeper needed)
- Easy setup with docker-compose

---

### Option 2: Direct HTTP/REST Calls

**Description**: Services communicate synchronously via REST APIs.

**Pros**:

- ✅ **Simple**: No additional infrastructure
- ✅ **Immediate feedback**: Know if request succeeded
- ✅ **Easy debugging**: Standard HTTP tools (cURL, Postman)
- ✅ **No learning curve**: Team already knows REST

**Cons**:

- ❌ **Tight coupling**: Services depend on each other's availability
- ❌ **Cascading failures**: If Trip Service down, Driver Service can't notify
- ❌ **No retry mechanism**: Caller must implement retries
- ❌ **No event history**: Can't replay events
- ❌ **Synchronous blocking**: Slow downstream service blocks upstream
- ❌ **Circuit breaker needed**: Complex error handling

**Example Problem**:

```
Trip requested → Call Driver Service → Call Notification Service
                      ↓ (fails)              ↓
                   Retry?              Request lost
```

**Why rejected**:

- Creates tight coupling between services
- Can't scale independently
- No fault tolerance built-in

---

### Option 3: AWS SQS/SNS

**Description**: Managed message queue (SQS) and pub/sub (SNS) services.

**Pros**:

- ✅ **Fully managed**: No server management
- ✅ **Scalable**: Auto-scales automatically
- ✅ **Reliable**: 99.9% availability SLA
- ✅ **Simple**: Easy API, quick setup
- ✅ **Pay-per-use**: Cost-effective at low volumes

**Cons**:

- ❌ **No message ordering**: Only FIFO queues (limited throughput)
- ❌ **No event replay**: Messages deleted after consumption
- ❌ **Limited retention**: Max 14 days (vs Kafka's configurable)
- ❌ **Vendor lock-in**: AWS-specific, hard to migrate
- ❌ **Message size limit**: 256KB max (Kafka: 1MB default)
- ❌ **Eventual consistency**: Can have message duplication
- ❌ **No partitioning**: Can't guarantee order for specific entities

**Cost** (AWS):

- 1M requests: $0.40
- **Estimated**: ~$100/month for 10M events

**Why not chosen**:

- No message ordering (critical for trip lifecycle events)
- Can't replay events (needed for debugging, analytics)
- Vendor lock-in to AWS

---

### Option 4: RabbitMQ

**Description**: Traditional message broker with robust routing capabilities.

**Pros**:

- ✅ **Flexible routing**: Exchange types (direct, topic, fanout)
- ✅ **Mature**: 15+ years in production
- ✅ **Management UI**: Built-in admin dashboard
- ✅ **Multiple protocols**: AMQP, MQTT, STOMP

**Cons**:

- ❌ **Lower throughput**: ~50K msg/s vs Kafka's millions
- ❌ **Message deletion**: Removed after consumption (no replay)
- ❌ **Vertical scaling**: Hard to scale horizontally
- ❌ **Memory bound**: Performance degrades with large queues
- ❌ **Single point of failure**: Need HA setup for redundancy

**Why not chosen**:

- Can't replay events (no event sourcing)
- Lower throughput than Kafka
- Not designed for event streaming use case

---

## Decision Outcome

**Chosen option: Option 1 - Apache Kafka**

### Rationale

1. **Event sourcing**: Can replay events for debugging, analytics, new consumers
2. **High throughput**: Handles 1000+ events/sec with room to grow
3. **Horizontal scaling**: Add consumers without changing producers
4. **Fault tolerance**: Messages replicated, survive broker failures
5. **Message ordering**: Critical for trip lifecycle (requested → accepted → started → completed)
6. **Industry standard**: Proven by Uber, Lyft in ride-hailing

### Architecture Decision

```
┌─────────────────────────────────────────────────────────────┐
│                    Kafka Topics Design                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Topic: trip.requested (3 partitions)                       │
│  Producer: Trip Service                                     │
│  Consumers: Driver Service (notify nearby drivers)          │
│  Retention: 24 hours                                        │
│  Key: tripId (ensures order per trip)                       │
│                                                              │
│  Topic: trip.accepted (3 partitions)                        │
│  Producer: Driver Service                                   │
│  Consumers: Trip Service (update trip status)               │
│  Retention: 24 hours                                        │
│                                                              │
│  Topic: driver.location.updated (6 partitions)              │
│  Producer: Driver Service                                   │
│  Consumers: Trip Service (real-time tracking)               │
│  Retention: 1 hour (high volume, short-lived)               │
│  Key: driverId                                              │
│                                                              │
│  Topic: trip.completed (3 partitions)                       │
│  Producer: Driver Service                                   │
│  Consumers: Trip Service, Billing Service                   │
│  Retention: 7 days (for billing reconciliation)             │
└─────────────────────────────────────────────────────────────┘
```

### Trade-offs Accepted

**Increased Complexity**:

- **Accepted**: Team invests time learning Kafka concepts
- **Mitigation**: Comprehensive documentation, shared Kafka client library

**Operational Overhead**:

- **Accepted**: Need to monitor Kafka brokers, consumer lag
- **Mitigation**: Use AWS MSK (managed Kafka) in production, simple Docker setup locally

**Resource Usage**:

- **Accepted**: Kafka requires dedicated resources (CPU, memory, disk)
- **Mitigation**: Cost is justified by throughput and reliability gains

---

## Implementation Details

### Kafka Setup (KRaft Mode, No ZooKeeper)

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
    KAFKA_LOG_RETENTION_MS: 86400000 # 24 hours
    KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
```

### Shared Kafka Client Library

```javascript
// common/shared/kafkaClient.js
class KafkaClient {
  async initProducer(options = {}) {
    this.producer = this.kafka.producer({
      maxInFlightRequests: 5,
      idempotent: false, // For PoC, prioritize performance
      batch: {
        size: 100, // Batch up to 100 messages
        timeout: 50, // or wait max 50ms
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

### Event Schema Standardization

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
    dropoff: { lat: 10.772622, lng: 106.670172, address: "District 1" },
    estimatedFare: 50000,
    vehicleType: "sedan",
  },
  metadata: {
    producedBy: "trip-service",
    environment: "production",
  },
};
```

### Producer Example (Trip Service)

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
      key: tripData.tripId, // Partition by tripId for ordering
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

### Consumer Example (Driver Service)

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
        // Message will be retried or sent to DLQ
        throw error;
      }
    });
  }

  async handleTripRequested(tripData) {
    // Find nearby drivers
    const drivers = await locationService.findNearbyDrivers(
      tripData.pickup.lat,
      tripData.pickup.lng,
      5 // 5km radius
    );

    // Notify drivers via WebSocket
    for (const driver of drivers) {
      await notificationService.sendTripRequest(driver.id, tripData);
    }
  }
}
```

---

## Validation & Results

### Load Testing

**Scenario**: Simulate 500 trips being requested simultaneously

```
Setup:
- 500 virtual users
- Each creates a trip (produces event)
- Driver service consumes events
- Duration: 2 minutes

Results:
✅ Kafka produced: 500 events in 2.3 seconds (217 events/sec)
✅ Consumer lag: <100ms average
✅ P95 end-to-end latency: 85ms
✅ Zero message loss
✅ Consumer group rebalancing: <3 seconds
✅ Broker CPU usage: 15%
✅ Broker memory usage: 450MB
```

### Event Flow Trace

```
13:45:23.100 - Trip Service: Passenger creates trip
13:45:23.105 - Trip Service: Published trip.requested to Kafka
13:45:23.125 - Kafka: Event written to partition 1
13:45:23.140 - Driver Service: Consumed trip.requested
13:45:23.142 - Driver Service: Query Redis for nearby drivers (5ms)
13:45:23.150 - Driver Service: Send notifications to 3 drivers
13:45:23.180 - Driver App: Receives trip request (total: 80ms)
```

---

## Consequences

### Positive

- ✅ **Loose coupling**: Services don't know about each other

  ```
  Trip Service → Kafka ← Driver Service
  (no direct dependency)
  ```

- ✅ **Horizontal scaling**: Add more consumer instances

  ```
  Before: 1 consumer, 100 events/sec
  After: 3 consumers, 300 events/sec (linear scaling)
  ```

- ✅ **Fault tolerance**: Message not lost if consumer crashes

  ```
  Consumer crashes → Message stays in Kafka → Consumed by another instance
  ```

- ✅ **Event replay**: Debug production issues by replaying events

  ```bash
  # Replay last hour of events
  kafka-consumer --topic trip.requested --from-beginning --max-messages 1000
  ```

- ✅ **Audit trail**: All business events logged for compliance

### Negative

- ⚠️ **Eventual consistency**: Events processed asynchronously

  - Trip created in Trip Service → Driver notified 50-100ms later
  - **Acceptable**: User doesn't notice <100ms delay

- ⚠️ **Monitoring complexity**: Need to track consumer lag, broker health

  - **Mitigation**: Kafka Manager UI, CloudWatch metrics

- ⚠️ **Debugging distributed flows**: Harder to trace requests
  - **Mitigation**: Correlation IDs in all events, centralized logging

### Risks & Mitigation

| Risk                               | Likelihood | Impact | Mitigation                                 |
| ---------------------------------- | ---------- | ------ | ------------------------------------------ |
| **Consumer falls behind**          | Medium     | High   | Monitor consumer lag, auto-scale consumers |
| **Kafka broker failure**           | Low        | High   | Use 3 brokers with replication factor 2    |
| **Message duplication**            | Medium     | Low    | Idempotent event handlers (use event IDs)  |
| **Schema changes break consumers** | Medium     | Medium | Event versioning (eventVersion field)      |

---

## Monitoring & Observability

### Key Metrics to Monitor

```
Producer Metrics:
- Record send rate (target: >100/sec)
- Record error rate (target: <0.1%)
- Batch size (target: 50-100 records/batch)

Consumer Metrics:
- Consumer lag (target: <100 messages)
- Fetch rate (target: >50/sec per consumer)
- Processing time (target: <50ms per event)

Broker Metrics:
- CPU usage (target: <70%)
- Disk usage (target: <80%)
- Network throughput (target: <80% capacity)
```

### Alerting Rules

```yaml
# Consumer lag alert
- alert: ConsumerLagHigh
  expr: kafka_consumer_lag > 1000
  for: 5m
  annotations:
    summary: "Consumer {{ $labels.group }} is lagging"

# Broker down alert
- alert: KafkaBrokerDown
  expr: up{job="kafka"} == 0
  for: 1m
  annotations:
    summary: "Kafka broker {{ $labels.instance }} is down"
```

---

## Future Enhancements

### Phase 2: Stream Processing with Kafka Streams

```javascript
// Real-time analytics on event stream
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

### Phase 3: CQRS with Event Sourcing

```javascript
// Rebuild trip state from events
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

## Alternatives for Specific Use Cases

### When to use REST instead of Kafka:

- **Immediate response needed**: Payment processing, auth
- **Simple request-reply**: Get user profile, check driver availability
- **Low latency critical**: <10ms requirement

### When to use SQS/SNS:

- **Low volume**: <100 messages/sec
- **Don't need event replay**: Fire-and-forget notifications
- **Minimal ops**: Fully managed, no maintenance

### When to use RabbitMQ:

- **Complex routing**: Topic exchanges, header-based routing
- **RPC patterns**: Request-reply with correlation IDs
- **Legacy integration**: AMQP protocol required

---

## Follow-up Actions

- [x] Setup Kafka in docker-compose (2025-10-16)
- [x] Create shared Kafka client library (2025-10-17)
- [x] Implement trip lifecycle events (2025-10-18)
- [x] Add consumer lag monitoring (2025-10-19)
- [x] Load test event throughput (2025-10-20)
- [ ] Setup AWS MSK in staging (2025-11-01)
- [ ] Implement dead letter queue (2025-11-05)
- [ ] Document event schemas in wiki (2025-11-10)

---

## References

- [Apache Kafka Documentation](https://kafka.apache.org/documentation/)
- [Kafka: The Definitive Guide](https://www.confluent.io/resources/kafka-the-definitive-guide/)
- [Uber's Event-Driven Architecture](https://eng.uber.com/microservice-architecture/)
- [AWS MSK Best Practices](https://docs.aws.amazon.com/msk/latest/developerguide/bestpractices.html)
- Load Test Results: `test/load-tests/STRESS_TEST_REPORT.md`
- Event Schemas: `common/shared/eventSchemas.js`

---

**Reviewed by**: Architecture Team  
**Approved by**: Tech Lead  
**Next Review**: 2025-12-01 (after 1 month in production)
