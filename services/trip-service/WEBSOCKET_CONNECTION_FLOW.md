# 🔌 WebSocket Connection Strategy - UIT-Go

## **Khi nào kết nối WebSocket?**

### **🚗 Tài xế (Driver):**

**Kết nối khi:**

1. ✅ **Login thành công** và có valid JWT token
2. ✅ **Chuyển status thành "ONLINE"** (bật hoạt động)
3. ✅ **App khởi động** nếu driver đã online trước đó

**Ngắt kết nối khi:**

1. ❌ **Logout** hoặc **chuyển status "OFFLINE"**
2. ❌ **App bị đóng** hoặc **mất mạng**
3. ❌ **JWT token hết hạn**

### **👤 Hành khách (Passenger):**

**Kết nối khi:**

1. ✅ **Mở app** và login thành công
2. ✅ **Tạo trip request** (đặt xe)
3. ✅ **Có trip đang active** (ACCEPTED, IN_PROGRESS, etc.)

**Có thể ngắt kết nối khi:**

1. ⚠️ **App chuyển background** (tùy implementation)
2. ❌ **Logout** hoặc **không có trip nào active**
3. ❌ **Mất mạng** hoặc **lỗi connection**

---

## **📱 Driver App Connection Flow:**

```javascript
// Driver App Implementation
class DriverWebSocketManager {
  constructor(driverId, jwtToken) {
    this.driverId = driverId;
    this.jwtToken = jwtToken;
    this.socket = null;
    this.isOnline = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  // Called when driver clicks "Go Online" button
  async goOnline() {
    try {
      console.log("Driver going online...");

      // 1. Update status via Driver Service API
      await this.updateDriverStatus("ONLINE");

      // 2. Connect WebSocket
      await this.connectWebSocket();

      // 3. Start location updates
      this.startLocationTracking();

      this.isOnline = true;
      console.log("✅ Driver is now ONLINE and ready for trips");
    } catch (error) {
      console.error("Failed to go online:", error);
      this.showError("Unable to go online. Please check your connection.");
    }
  }

  async connectWebSocket() {
    if (this.socket && this.socket.connected) {
      console.log("WebSocket already connected");
      return;
    }

    this.socket = io("ws://trip.localhost:81", {
      transports: ["websocket", "polling"],
      timeout: 10000,
      forceNew: true,
    });

    // Connection established
    this.socket.on("connect", () => {
      console.log("🔌 WebSocket connected:", this.socket.id);
      this.reconnectAttempts = 0;

      // Authenticate immediately
      this.socket.emit("authenticate", {
        userId: this.driverId,
        userRole: "DRIVER",
        token: this.jwtToken,
      });
    });

    // Authentication success
    this.socket.on("authenticated", (data) => {
      console.log("✅ Driver authenticated:", data);

      // Send driver status update
      this.socket.emit("driver_status_update", {
        status: "ONLINE",
      });

      // Listen for active trip subscriptions
      this.socket.on("active_trips_subscribed", (data) => {
        console.log(
          `📱 Subscribed to ${data.count} active trips:`,
          data.tripIds
        );
      });

      this.onWebSocketReady();
    });

    // Listen for new trip requests
    this.socket.on("trip_request", (notification) => {
      console.log("🚗 New trip request:", notification);
      this.showTripRequestDialog(notification);
    });

    // Listen for trip status updates
    this.socket.on("trip_taken", (data) => {
      this.hideTripRequestDialog();
      this.showNotification("Trip was taken by another driver");
    });

    // Handle disconnection
    this.socket.on("disconnect", (reason) => {
      console.log("❌ WebSocket disconnected:", reason);
      this.handleDisconnection(reason);
    });

    // Handle connection errors
    this.socket.on("connect_error", (error) => {
      console.error("WebSocket connection error:", error);
      this.handleConnectionError(error);
    });
  }

  // Called when driver clicks "Go Offline" button
  async goOffline() {
    try {
      console.log("Driver going offline...");

      this.isOnline = false;

      // 1. Stop location tracking
      this.stopLocationTracking();

      // 2. Update status via API
      await this.updateDriverStatus("OFFLINE");

      // 3. Send status update via WebSocket
      if (this.socket && this.socket.connected) {
        this.socket.emit("driver_status_update", {
          status: "OFFLINE",
        });
      }

      // 4. Disconnect WebSocket after a brief delay
      setTimeout(() => {
        if (this.socket) {
          this.socket.disconnect();
          this.socket = null;
        }
      }, 1000);

      console.log("✅ Driver is now OFFLINE");
    } catch (error) {
      console.error("Error going offline:", error);
    }
  }

  // Auto-reconnection logic
  handleDisconnection(reason) {
    if (!this.isOnline) {
      return; // Driver intentionally went offline
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential backoff

      console.log(
        `🔄 Reconnecting in ${delay / 1000}s (attempt ${
          this.reconnectAttempts
        })`
      );

      setTimeout(() => {
        this.connectWebSocket();
      }, delay);
    } else {
      console.error("❌ Max reconnection attempts reached");
      this.showError("Connection lost. Please go online again.");
    }
  }

  // Send location updates while online
  startLocationTracking() {
    this.locationInterval = setInterval(() => {
      if (this.socket && this.socket.connected) {
        navigator.geolocation.getCurrentPosition((position) => {
          this.socket.emit("location_update", {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: Date.now(),
          });
        });
      }
    }, 5000); // Update every 5 seconds
  }

  stopLocationTracking() {
    if (this.locationInterval) {
      clearInterval(this.locationInterval);
      this.locationInterval = null;
    }
  }
}

// Usage:
const driverWS = new DriverWebSocketManager(driverId, jwtToken);

// When driver clicks "Go Online" button
document.getElementById("goOnlineBtn").onclick = () => {
  driverWS.goOnline();
};

// When driver clicks "Go Offline" button
document.getElementById("goOfflineBtn").onclick = () => {
  driverWS.goOffline();
};
```

---

## **📱 Passenger App Connection Flow:**

```javascript
// Passenger App Implementation
class PassengerWebSocketManager {
  constructor(passengerId, jwtToken) {
    this.passengerId = passengerId;
    this.jwtToken = jwtToken;
    this.socket = null;
    this.currentTripId = null;
  }

  // Connect when app starts or user logs in
  async initialize() {
    await this.connectWebSocket();
    await this.checkActiveTrips();
  }

  async connectWebSocket() {
    this.socket = io("ws://trip.localhost:81", {
      transports: ["websocket", "polling"],
    });

    this.socket.on("connect", () => {
      console.log("🔌 Passenger WebSocket connected");

      // Authenticate
      this.socket.emit("authenticate", {
        userId: this.passengerId,
        userRole: "PASSENGER",
        token: this.jwtToken,
      });
    });

    this.socket.on("authenticated", (data) => {
      console.log("✅ Passenger authenticated:", data);
    });

    // Auto-subscribed to active trips
    this.socket.on("active_trips_subscribed", (data) => {
      console.log(`📱 Auto-subscribed to ${data.count} active trips`);
      if (data.count > 0) {
        this.currentTripId = data.tripIds[0]; // Most recent trip
        this.showActiveTripUI();
      }
    });

    // Listen for trip updates
    this.socket.on("trip_accepted", (data) => {
      this.showNotification("🎉 Driver found! Your trip has been accepted");
      this.updateTripStatus("accepted", data);
    });

    this.socket.on("driver_location_update", (data) => {
      this.updateDriverLocationOnMap(data.location);
    });

    this.socket.on("trip_cancelled", (data) => {
      this.showNotification("❌ Trip cancelled: " + data.reason);
      this.resetTripUI();
    });
  }

  // When passenger creates a new trip
  async createTrip(tripData) {
    try {
      const response = await fetch("/api/trips", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.jwtToken}`,
        },
        body: JSON.stringify(tripData),
      });

      const result = await response.json();

      if (result.success) {
        this.currentTripId = result.data.trip.id;

        // Notify WebSocket about new trip (auto-subscribe)
        if (this.socket && this.socket.connected) {
          this.socket.emit("trip_created", {
            tripId: this.currentTripId,
          });
        }

        this.showSearchingForDriverUI();
        return result;
      }
    } catch (error) {
      console.error("Error creating trip:", error);
    }
  }

  // Disconnect when appropriate (optional)
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

// Usage:
const passengerWS = new PassengerWebSocketManager(passengerId, jwtToken);

// Initialize when app starts
passengerWS.initialize();

// Create trip when user books a ride
document.getElementById("bookRideBtn").onclick = async () => {
  const tripData = {
    origin: {
      /* pickup location */
    },
    destination: {
      /* destination */
    },
  };

  await passengerWS.createTrip(tripData);
};
```

---

## **🔄 Connection States Summary:**

### **Driver Connection States:**

```
DISCONNECTED → LOGIN → AUTHENTICATED → ONLINE → READY_FOR_TRIPS
     ↑                                           ↓
     ←─────────────── OFFLINE ←─────────────────
```

### **Passenger Connection States:**

```
DISCONNECTED → LOGIN → AUTHENTICATED → CONNECTED
     ↑                                    ↓
     ←──────────── LOGOUT ←──────────────

CONNECTED → TRIP_REQUESTED → SUBSCRIBED_TO_TRIP → TRIP_COMPLETED → CONNECTED
```

---

## **📊 Connection Statistics trong Health Check:**

Có thể check thống kê connection qua endpoint `/health`:

```json
{
  "connectedUsers": {
    "total": 1250,
    "passengers": 1100,
    "drivers": 150
  },
  "features": {
    "realTimeNotifications": true,
    "driverMatching": true,
    "fareCalculation": true,
    "stateManagement": true
  }
}
```

**✅ Kết luận:**

- **Driver**: Kết nối khi chuyển status ONLINE, ngắt khi OFFLINE
- **Passenger**: Kết nối khi mở app, duy trì connection liên tục
- **Auto-reconnect**: Xử lý tự động khi mất kết nối
- **Real-time**: Tất cả notifications đều real-time qua WebSocket! 🚀
