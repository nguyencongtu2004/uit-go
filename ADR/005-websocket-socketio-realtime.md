# ADR 005: WebSocket with Socket.IO for Real-time Communication

**Status**: Accepted  
**Date**: 2025-10-17  
**Deciders**: Technical Architecture Team  
**Tags**: `websocket`, `real-time`, `communication`, `socket.io`

---

## Context and Problem Statement

A ride-hailing platform requires real-time bidirectional communication for critical features:

- **Driver location tracking**: Update passenger map every 5 seconds as driver approaches
- **Trip notifications**: Notify driver of new trip request (15s timeout to accept)
- **Trip status updates**: Inform passenger when driver accepts, arrives, starts trip
- **Live chat**: Optional future feature for driver-passenger communication

Traditional REST APIs have limitations:

- **Polling**: Client repeatedly asks "any updates?" (inefficient, delays)
- **Server-Sent Events (SSE)**: One-way only (server → client)
- **Long polling**: Complex, resource-intensive

We need a **bidirectional, low-latency** real-time communication solution.

---

## Decision Drivers

### Functional Requirements

- **Bidirectional**: Both client and server can initiate messages
- **Low latency**: <100ms message delivery
- **Reliable delivery**: Messages shouldn't be lost
- **Scalability**: Support 10,000+ concurrent connections
- **Mobile support**: Works on iOS, Android browsers
- **Reconnection**: Auto-reconnect on network drop

### Non-Functional Requirements

- **Browser support**: Chrome, Safari, Firefox, Edge
- **Fallback mechanism**: Work even if WebSocket blocked
- **Easy integration**: Simple API for frontend developers
- **Performance**: Low CPU/memory overhead
- **Battle-tested**: Proven in production at scale

---

## Considered Options

### Option 1: Socket.IO (Chosen)

**Description**: WebSocket library with automatic fallback and advanced features.

**Architecture**:

```
┌──────────────┐                    ┌──────────────┐
│ Passenger    │                    │   Driver     │
│ Mobile App   │                    │  Mobile App  │
└──────┬───────┘                    └──────┬───────┘
       │ ws://trip.localhost:81           │
       │                                   │
       └────────────┬──────────────────────┘
                    │
             ┌──────▼───────┐
             │  Socket.IO   │
             │   Server     │
             │ (Trip Svc)   │
             └──────┬───────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
   ┌────▼────┐ ┌────▼────┐ ┌────▼────┐
   │ Room:   │ │ Room:   │ │ Room:   │
   │user_123 │ │driver_45│ │trip_789 │
   └─────────┘ └─────────┘ └─────────┘
```

**Pros**:

- ✅ **Automatic fallback**: WebSocket → HTTP long-polling → HTTP polling
  ```
  Priority: WebSocket (best)
         ↓ (if blocked)
         HTTP long-polling (good)
         ↓ (if blocked)
         HTTP polling (works everywhere)
  ```
- ✅ **Room system**: Easy broadcast to specific users
  ```javascript
  io.to("user_123").emit("DRIVER_LOCATION", { lat, lng });
  ```
- ✅ **Auto-reconnection**: Client reconnects with exponential backoff
- ✅ **Acknowledgments**: Confirm message delivery
  ```javascript
  socket.emit("TRIP_REQUEST", data, (ack) => {
    console.log("Driver received:", ack);
  });
  ```
- ✅ **Binary support**: Can send images, files (not just JSON)
- ✅ **Namespace support**: Separate channels (e.g., /trips, /chat)
- ✅ **Battle-tested**: Used by Microsoft Teams, Trello
- ✅ **Cross-platform**: JS client, iOS, Android, React Native
- ✅ **Simple API**: Easy for frontend developers

**Cons**:

- ❌ **Heavier than raw WebSocket**: 50KB client library vs 0KB
- ❌ **Custom protocol**: Not plain WebSocket (compatibility issues with some tools)
- ❌ **Scaling complexity**: Need sticky sessions or Redis adapter

**Example Usage**:

```javascript
// Server (Trip Service)
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

io.on("connection", (socket) => {
  socket.on("authenticate", ({ userId }) => {
    socket.join(`user_${userId}`);
    console.log(`User ${userId} connected`);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

// Emit to specific user
io.to("user_123").emit("DRIVER_LOCATION", {
  driverId: "driver_45",
  lat: 10.762622,
  lng: 106.660172,
});

// Client (React/Vue/Mobile)
import io from "socket.io-client";

const socket = io("http://trip.localhost:81");

socket.on("connect", () => {
  socket.emit("authenticate", { userId: "123" });
});

socket.on("DRIVER_LOCATION", (data) => {
  updateMapMarker(data.lat, data.lng);
});
```

**Performance**:

- Connection establishment: 50-100ms
- Message latency: 10-30ms
- Memory per connection: ~10KB
- Max connections (single server): 10,000+

**Cost**: Free (open-source)

---

### Option 2: Native WebSocket

**Description**: Browser's built-in WebSocket API, no library needed.

**Architecture**:

```javascript
// Server (Node.js ws library)
const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: 8080 });

wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    console.log("Received:", message);
  });

  ws.send(JSON.stringify({ type: "WELCOME" }));
});

// Client (browser)
const ws = new WebSocket("ws://localhost:8080");

ws.onopen = () => {
  ws.send(JSON.stringify({ type: "AUTH", userId: "123" }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log("Received:", data);
};
```

**Pros**:

- ✅ **Lightweight**: No library, native browser API
- ✅ **Standard protocol**: RFC 6455, works with any WebSocket client
- ✅ **Fast**: No abstraction layer overhead
- ✅ **Simple**: Minimal API surface

**Cons**:

- ❌ **No auto-reconnect**: Must implement manually
- ❌ **No fallback**: Fails if WebSocket blocked (corporate firewalls)
- ❌ **No rooms/broadcast**: Must implement user grouping logic
- ❌ **No acknowledgments**: Can't confirm message received
- ❌ **Raw messages only**: Must manually handle JSON serialization
- ❌ **Connection state management**: Must track connected users
- ❌ **Mobile compatibility**: Need separate iOS/Android WebSocket libraries

**Why Rejected**:

- Too low-level, requires building features Socket.IO provides
- No fallback mechanism (fails in restrictive networks)
- More code to maintain

---

### Option 3: Server-Sent Events (SSE)

**Description**: HTTP-based one-way communication (server → client).

**Architecture**:

```javascript
// Server
app.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const interval = setInterval(() => {
    res.write(`data: ${JSON.stringify({ time: Date.now() })}\n\n`);
  }, 1000);

  req.on("close", () => clearInterval(interval));
});

// Client
const eventSource = new EventSource("/events");

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log("Received:", data);
};
```

**Pros**:

- ✅ **Simple**: Built-in browser API, HTTP-based
- ✅ **Auto-reconnect**: Automatically reconnects on disconnect
- ✅ **Firewall-friendly**: Uses HTTP, rarely blocked

**Cons**:

- ❌ **One-way only**: Server → Client (client must use REST for sending)
- ❌ **Not bidirectional**: Can't send trip acceptance from driver easily
- ❌ **Limited browser support**: No IE/Edge support (legacy)
- ❌ **HTTP overhead**: More bandwidth than WebSocket

**Why Rejected**:

- Not bidirectional (need driver → server messages)
- Awkward architecture (WebSocket for updates, REST for actions)

---

### Option 4: Long Polling

**Description**: Client repeatedly makes HTTP requests asking for new data.

**Architecture**:

```javascript
// Server
app.get("/poll", (req, res) => {
  const userId = req.query.userId;

  // Wait up to 30 seconds for new messages
  const timeout = setTimeout(() => {
    res.json({ messages: [] });
  }, 30000);

  // If message arrives, respond immediately
  messageQueue.on("message", (msg) => {
    clearTimeout(timeout);
    res.json({ messages: [msg] });
  });
});

// Client
async function poll() {
  const response = await fetch("/poll?userId=123");
  const data = await response.json();

  if (data.messages.length > 0) {
    handleMessages(data.messages);
  }

  poll(); // Immediately poll again
}
```

**Pros**:

- ✅ **Works everywhere**: No special protocols, just HTTP
- ✅ **Firewall-friendly**: HTTP requests rarely blocked

**Cons**:

- ❌ **High latency**: 1-30 seconds delay depending on implementation
- ❌ **Resource intensive**: Constant HTTP connections
- ❌ **Inefficient**: 100 clients = 100 open connections
- ❌ **Complex**: Hard to implement correctly

**Why Rejected**:

- Too slow for real-time location tracking (5s updates)
- Inefficient resource usage

---

## Decision Outcome

**Chosen option: Option 1 - Socket.IO**

### Rationale

1. **Reliability**: Automatic fallback ensures it works in all networks
2. **Developer experience**: Simple API, easy to use
3. **Production-ready**: Battle-tested by major companies
4. **Feature-rich**: Rooms, namespaces, acknowledgments built-in
5. **Mobile support**: Official iOS/Android clients

### Architecture Decision

```
┌─────────────────────────────────────────────────────────────┐
│              Socket.IO Integration Design                   │
└─────────────────────────────────────────────────────────────┘

Server: Trip Service (Node.js + Express + Socket.IO)
├── Port 3000: HTTP API (REST endpoints)
└── Port 3000: WebSocket (Socket.IO on same server)

Connection Flow:
1. Client connects: ws://trip.localhost:81
2. Traefik routes to Trip Service (websocket upgrade)
3. Socket.IO handshake (HTTP → WebSocket upgrade)
4. Client emits 'authenticate' event
5. Server joins client to room (user_123 or driver_45)
6. Server can now push events to specific users

Event Types:
• TRIP_REQUEST      → Driver receives trip (15s to respond)
• TRIP_ACCEPTED     → Passenger notified driver accepted
• DRIVER_LOCATION   → Passenger receives location update (5s)
• TRIP_STARTED      → Passenger notified trip started
• TRIP_COMPLETED    → Both parties notified trip complete
• TRIP_CANCELLED    → Other party notified of cancellation
```

---

## Implementation Details

### Server Setup (Trip Service)

```javascript
// services/trip-service/src/indexEventDriven.js

const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(",") || ["http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true,
  },
  // Performance tuning
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 10000,
  maxHttpBufferSize: 1e6, // 1MB
  transports: ["websocket", "polling"], // Prefer WebSocket
});

// Connection handler
io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Passenger authentication
  socket.on("authenticate", (data) => {
    if (data.userId) {
      socket.join(`user_${data.userId}`);
      console.log(`User ${data.userId} joined room: user_${data.userId}`);
      socket.emit("authenticated", { success: true });
    }
  });

  // Driver authentication
  socket.on("authenticate_driver", (data) => {
    if (data.driverId) {
      socket.join(`driver_${data.driverId}`);
      console.log(
        `Driver ${data.driverId} joined room: driver_${data.driverId}`
      );
      socket.emit("authenticated", { success: true });
    }
  });

  // Disconnect handler
  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });

  // Error handler
  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });
});

// Make io available globally for event consumers
global.io = io;

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Trip Service running on port ${PORT}`);
  console.log(`WebSocket available at ws://localhost:${PORT}`);
});
```

### Notification Service (Kafka Consumer → WebSocket)

```javascript
// services/trip-service/src/services/webSocketNotificationConsumer.js

class WebSocketNotificationConsumer {
  constructor(kafkaClient, io) {
    this.kafkaClient = kafkaClient;
    this.io = io; // Socket.IO instance
  }

  async start() {
    await this.kafkaClient.subscribe(["driver.location.updated"]);

    await this.kafkaClient.consume(async ({ message }) => {
      const event = JSON.parse(message.value.toString());

      if (event.eventType === "driver.location.updated") {
        await this.handleDriverLocationUpdate(event.data);
      }
    });
  }

  async handleDriverLocationUpdate(data) {
    // Get trip for this driver
    const trip = await Trip.findOne({
      driverId: data.driverId,
      status: { $in: ["accepted", "ongoing"] },
    });

    if (trip) {
      // Emit to passenger's WebSocket room
      this.io.to(`user_${trip.passengerId}`).emit("DRIVER_LOCATION", {
        tripId: trip.tripId,
        driverId: data.driverId,
        latitude: data.latitude,
        longitude: data.longitude,
        timestamp: data.timestamp,
      });

      console.log(`Sent location update to user_${trip.passengerId}`);
    }
  }
}

module.exports = WebSocketNotificationConsumer;
```

### Client Integration (React Example)

```javascript
// frontend/src/hooks/useSocket.js

import { useEffect, useState } from "react";
import io from "socket.io-client";

export function useSocket(userId) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [driverLocation, setDriverLocation] = useState(null);

  useEffect(() => {
    // Connect to Socket.IO server
    const newSocket = io("http://trip.localhost:81", {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    // Connection events
    newSocket.on("connect", () => {
      console.log("Socket connected");
      setConnected(true);

      // Authenticate
      newSocket.emit("authenticate", { userId });
    });

    newSocket.on("authenticated", (data) => {
      console.log("Authenticated:", data);
    });

    newSocket.on("disconnect", () => {
      console.log("Socket disconnected");
      setConnected(false);
    });

    // Business events
    newSocket.on("DRIVER_LOCATION", (data) => {
      console.log("Driver location update:", data);
      setDriverLocation(data);
    });

    newSocket.on("TRIP_ACCEPTED", (data) => {
      console.log("Trip accepted:", data);
      // Update UI
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      newSocket.close();
    };
  }, [userId]);

  return { socket, connected, driverLocation };
}

// Usage in component
function TripTrackingPage() {
  const { connected, driverLocation } = useSocket(currentUser.id);

  return (
    <div>
      <h1>Trip Tracking</h1>
      <p>Status: {connected ? "Connected" : "Disconnected"}</p>
      {driverLocation && (
        <Map
          center={[driverLocation.latitude, driverLocation.longitude]}
          marker={driverLocation}
        />
      )}
    </div>
  );
}
```

### Mobile Integration (React Native)

```javascript
// mobile/src/services/socketService.js

import io from "socket.io-client";

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = {};
  }

  connect(userId) {
    this.socket = io("http://trip.localhost:81", {
      transports: ["websocket"],
      reconnection: true,
    });

    this.socket.on("connect", () => {
      console.log("[Socket] Connected");
      this.socket.emit("authenticate", { userId });
    });

    this.socket.on("DRIVER_LOCATION", (data) => {
      this.emit("driverLocation", data);
    });

    this.socket.on("TRIP_REQUEST", (data) => {
      // Show notification
      this.showNotification("New Trip Request", data);
      this.emit("tripRequest", data);
    });
  }

  // Event emitter pattern for React Native
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((cb) => cb(data));
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
    }
  }
}

export default new SocketService();
```

---

## Scaling Strategy

### Problem: Horizontal Scaling

When running multiple Trip Service instances, Socket.IO needs sticky sessions OR a Redis adapter.

**Without Redis** (sticky sessions):

```
Client (session: abc) → ALB → Always route to Instance 1
Client (session: xyz) → ALB → Always route to Instance 2
```

**Problem**: Can't push message if user connected to different instance.

**With Redis Adapter** (recommended):

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│ Trip Svc │────►│  Redis   │◄────│ Trip Svc │
│Instance 1│     │  Pub/Sub │     │Instance 2│
└──────────┘     └──────────┘     └──────────┘

Flow:
1. User connected to Instance 1
2. Event arrives at Instance 2
3. Instance 2 publishes to Redis
4. Instance 1 receives from Redis
5. Instance 1 emits to user
```

**Implementation**:

```javascript
// services/trip-service/src/indexEventDriven.js

const { createAdapter } = require("@socket.io/redis-adapter");
const { createClient } = require("redis");

// Create Redis clients (pub/sub)
const pubClient = createClient({ url: "redis://redis:6379" });
const subClient = pubClient.duplicate();

await Promise.all([pubClient.connect(), subClient.connect()]);

// Use Redis adapter
io.adapter(createAdapter(pubClient, subClient));

console.log("Socket.IO using Redis adapter for scaling");
```

**Result**: Can scale to 10+ instances, all users reachable from any instance.

---

## Performance Optimization

### 1. Binary Protocol (MessagePack)

```javascript
// Reduce message size by 30-50%
const io = socketIo(server, {
  parser: require("socket.io-msgpack-parser"),
});
```

### 2. Compression

```javascript
// Enable permessage-deflate
const io = socketIo(server, {
  perMessageDeflate: {
    threshold: 1024, // Compress messages >1KB
  },
});
```

### 3. Connection Pooling

```javascript
// Limit max connections per process
const io = socketIo(server, {
  maxHttpBufferSize: 1e6, // 1MB max message
  pingTimeout: 60000, // Detect dead connections faster
  pingInterval: 25000,
});
```

### 4. Selective Broadcasting

```javascript
// ❌ BAD: Broadcast to all clients
io.emit("DRIVER_LOCATION", data); // 10,000 clients = 10,000 messages

// ✅ GOOD: Send to specific room
io.to("user_123").emit("DRIVER_LOCATION", data); // 1 client = 1 message
```

---

## Monitoring & Debugging

### Connection Metrics

```javascript
// Track active connections
setInterval(() => {
  const sockets = io.sockets.sockets.size;
  const rooms = io.sockets.adapter.rooms.size;

  console.log(`Active connections: ${sockets}`);
  console.log(`Active rooms: ${rooms}`);

  // Send to monitoring (Prometheus, CloudWatch)
  metrics.gauge("websocket.connections", sockets);
}, 60000);
```

### Debug Logging

```javascript
// Enable Socket.IO debug logs
const io = socketIo(server, {
  // ... other options
});

// In development
if (process.env.NODE_ENV !== "production") {
  io.engine.on("connection", (rawSocket) => {
    rawSocket.on("packet", ({ type, data }) => {
      console.log(`[WebSocket] Packet: ${type}`, data);
    });
  });
}
```

### Client-Side Monitoring

```javascript
// Track connection state
socket.on("connect", () => {
  analytics.track("WebSocket Connected");
});

socket.on("disconnect", (reason) => {
  analytics.track("WebSocket Disconnected", { reason });

  if (reason === "io server disconnect") {
    // Server forced disconnect, try reconnecting
    socket.connect();
  }
});

socket.on("reconnect_attempt", (attemptNumber) => {
  console.log(`Reconnect attempt ${attemptNumber}`);
});
```

---

## Security Considerations

### 1. Authentication

```javascript
// Validate JWT before joining rooms
socket.on("authenticate", async (data) => {
  try {
    const decoded = jwt.verify(data.token, process.env.JWT_SECRET);

    if (decoded.userId === data.userId) {
      socket.userId = data.userId;
      socket.join(`user_${data.userId}`);
      socket.emit("authenticated", { success: true });
    } else {
      socket.emit("error", { message: "Invalid token" });
      socket.disconnect();
    }
  } catch (error) {
    socket.emit("error", { message: "Authentication failed" });
    socket.disconnect();
  }
});
```

### 2. Rate Limiting

```javascript
// Prevent spam
const rateLimit = new Map();

socket.on("message", (data) => {
  const userId = socket.userId;
  const now = Date.now();

  if (!rateLimit.has(userId)) {
    rateLimit.set(userId, { count: 0, resetAt: now + 60000 });
  }

  const limit = rateLimit.get(userId);

  if (now > limit.resetAt) {
    limit.count = 0;
    limit.resetAt = now + 60000;
  }

  if (limit.count >= 60) {
    // 60 messages per minute
    socket.emit("error", { message: "Rate limit exceeded" });
    return;
  }

  limit.count++;
  // Process message...
});
```

### 3. Input Validation

```javascript
const Joi = require("joi");

const locationSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
});

socket.on("UPDATE_LOCATION", (data) => {
  const { error, value } = locationSchema.validate(data);

  if (error) {
    socket.emit("error", { message: "Invalid data" });
    return;
  }

  // Process valid data...
});
```

---

## Consequences

### Positive

- ✅ **Real-time updates**: Driver location every 5 seconds, smooth tracking
- ✅ **Instant notifications**: Trip requests delivered in <100ms
- ✅ **Better UX**: No polling delays, feels responsive
- ✅ **Reliable**: Auto-reconnect, fallback to long-polling
- ✅ **Scalable**: Redis adapter enables horizontal scaling

### Negative

- ⚠️ **Complexity**: More moving parts than REST-only
- ⚠️ **Debugging**: Harder to trace WebSocket messages than HTTP
- ⚠️ **State management**: Must handle disconnects, reconnects

### Neutral

- 🔄 **New technology**: Team needs to learn Socket.IO (1-2 days)

---

## Alternatives for Future

### When to use Server-Sent Events:

- **One-way only**: Notifications, dashboards
- **Simpler**: Don't need bidirectional
- **HTTP-only**: Can't use WebSocket

### When to use gRPC Streaming:

- **Microservices internal**: Service-to-service communication
- **High throughput**: Millions of messages/sec
- **Not browser-based**: Backend-only

### When to use MQTT:

- **IoT devices**: Sensors, embedded systems
- **Low bandwidth**: 2G/3G networks
- **Pub/Sub**: Many-to-many messaging

---

## Follow-up Actions

- [x] Integrate Socket.IO in Trip Service (2025-10-17)
- [x] Implement room-based authentication (2025-10-17)
- [x] Connect to Kafka for driver location events (2025-10-18)
- [x] Test WebSocket with 1000 connections (2025-10-19)
- [ ] Add Redis adapter for scaling (2025-11-01)
- [ ] Implement rate limiting (2025-11-05)
- [ ] Add connection monitoring dashboard (2025-11-10)
- [ ] Document mobile integration guide (2025-11-15)

---

## References

- [Socket.IO Documentation](https://socket.io/docs/)
- [Socket.IO Redis Adapter](https://socket.io/docs/v4/redis-adapter/)
- [WebSocket Protocol (RFC 6455)](https://datatracker.ietf.org/doc/html/rfc6455)
- [Scaling Socket.IO](https://socket.io/docs/v4/using-multiple-nodes/)
- Implementation: `services/trip-service/src/indexEventDriven.js`
- WebSocket Flow: `services/trip-service/WEBSOCKET_CONNECTION_FLOW.md`

---

**Reviewed by**: Architecture Team  
**Approved by**: Tech Lead  
**Next Review**: 2025-12-01
