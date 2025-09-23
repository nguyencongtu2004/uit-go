# Hướng Dẫn Cấu Hình Traefik cho UIT-Go

## Các endpoint có sẵn

```bash
# User Service
http://localhost/api/users
http://localhost/api/auth/login

# Driver Service
http://localhost/api/drivers
http://localhost/api/location

# Trip Service
http://localhost/api/trips
http://localhost/api/booking
```

## Cách Thêm Định Tuyến Mới

### Scenario 1: Thêm Route Mới Cho Service Hiện Tại

**Ví dụ: Thêm `/api/payments` cho User Service**

1. **Sửa labels trong docker-compose.yaml:**

```yaml
user-service:
  # ... các config khác
  labels:
    - "traefik.enable=true"
    # Thêm PathPrefix mới vào rule hiện tại
    - "traefik.http.routers.user-service.rule=PathPrefix(`/api/users`) || PathPrefix(`/api/auth`) || PathPrefix(`/api/payments`)"
    - "traefik.http.routers.user-service.entrypoints=web"
    - "traefik.http.services.user-service.loadbalancer.server.port=3000"
    - "traefik.docker.network=uit-go_uit-go-network"
```

### Scenario 2: Thêm Service Hoàn Toàn Mới

**Ví dụ: Thêm Notification Service**

1. **Thêm service vào docker-compose.yaml:**

```yaml
notification-service:
  build: ./services/notification-service
  container_name: uit-go-notification-service
  restart: unless-stopped
  volumes:
    - ./services/notification-service:/app
    - /app/node_modules
  env_file:
    - ./env/notification-service.env
  depends_on:
    - redis
    - kafka
  networks:
    - uit-go-network
  labels:
    - "traefik.enable=true"
    - "traefik.http.routers.notification-service.rule=PathPrefix(`/api/notifications`)"
    - "traefik.http.routers.notification-service.entrypoints=web"
    - "traefik.http.services.notification-service.loadbalancer.server.port=3000"
    - "traefik.docker.network=uit-go_uit-go-network"
```

2. **Cập nhật Traefik dependencies:**

```yaml
traefik:
  # ... các config khác
  depends_on:
    - user-service
    - driver-service
    - trip-service
    - notification-service # Thêm dependency mới
```

### Scenario 3: Thêm Route với Subdomain

**Ví dụ: Admin panel trên subdomain riêng**

```yaml
admin-service:
  # ... config service
  labels:
    - "traefik.enable=true"
    - "traefik.http.routers.admin-service.rule=Host(`admin.localhost`) || Host(`admin.uit-go.local`)"
    - "traefik.http.routers.admin-service.entrypoints=web"
    - "traefik.http.services.admin-service.loadbalancer.server.port=3000"
```

### Scenario 4: Route với Middleware Đặc Biệt

**Ví dụ: API cần authentication**

1. **Thêm middleware trong dynamic.yml:**

```yaml
http:
  middlewares:
    # ... middlewares hiện tại

    # Authentication middleware
    auth-required:
      basicAuth:
        users:
          - "admin:$2y$10$abcdef..." # generated password hash

    # Admin-only access
    admin-only:
      ipWhiteList:
        sourceRange:
          - "192.168.1.0/24"
          - "127.0.0.1/32"
```

2. **Apply middleware vào service:**

```yaml
admin-service:
  # ... config service
  labels:
    - "traefik.enable=true"
    - "traefik.http.routers.admin-service.rule=PathPrefix(`/api/admin`)"
    - "traefik.http.routers.admin-service.entrypoints=web"
    - "traefik.http.routers.admin-service.middlewares=auth-required,admin-only"
    - "traefik.http.services.admin-service.loadbalancer.server.port=3000"
```

### Scenario 5: Static Files/Frontend

**Ví dụ: Serve React app**

```yaml
frontend:
  image: nginx:alpine
  container_name: uit-go-frontend
  volumes:
    - ./frontend/build:/usr/share/nginx/html
    - ./frontend/nginx.conf:/etc/nginx/nginx.conf
  networks:
    - uit-go-network
  labels:
    - "traefik.enable=true"
    - "traefik.http.routers.frontend.rule=Host(`localhost`) || Host(`uit-go.local`)"
    - "traefik.http.routers.frontend.entrypoints=web"
    - "traefik.http.routers.frontend.priority=1" # Thấp hơn API routes
    - "traefik.http.services.frontend.loadbalancer.server.port=80"
```

## Các Loại Rule Phổ Biến

### 1. Path-based Routing

```yaml
# Exact path
- "traefik.http.routers.service.rule=Path(`/api/v1/users`)"

# Path prefix
- "traefik.http.routers.service.rule=PathPrefix(`/api/users`)"

# Multiple paths
- "traefik.http.routers.service.rule=PathPrefix(`/api/users`) || PathPrefix(`/api/auth`)"
```

### 2. Host-based Routing

```yaml
# Single host
- "traefik.http.routers.service.rule=Host(`api.localhost`)"

# Multiple hosts
- "traefik.http.routers.service.rule=Host(`api.localhost`) || Host(`api.uit-go.local`)"

# Wildcard subdomain
- "traefik.http.routers.service.rule=HostRegexp(`{subdomain:[a-z]+}.localhost`)"
```

### 3. Method-based Routing

```yaml
# Specific HTTP method
- "traefik.http.routers.service.rule=PathPrefix(`/api/users`) && Method(`GET`)"

# Multiple methods
- "traefik.http.routers.service.rule=PathPrefix(`/api/users`) && Method(`GET`, `POST`)"
```

### 4. Header-based Routing

```yaml
# API version trong header
- "traefik.http.routers.service.rule=PathPrefix(`/api`) && Headers(`X-API-Version`, `v2`)"

# Content type
- "traefik.http.routers.service.rule=PathPrefix(`/api`) && HeadersRegexp(`Content-Type`, `application/json`)"
```

## Cách Sử Dụng

### 1. Khởi Động System

```bash
docker-compose up -d
```

### 2. Kiểm Tra Traefik Dashboard

Truy cập: http://localhost:8080 hoặc http://localhost/traefik

### 3. Test API Endpoints

```bash
# User Service
curl http://localhost/api/users
curl http://localhost/api/auth/login

# Driver Service
curl http://localhost/api/drivers
curl http://localhost/api/location

# Trip Service
curl http://localhost/api/trips
curl http://localhost/api/booking
```

## Quy Trình Thêm Route Mới - Step by Step

### Bước 1: Xác định loại route cần thêm

- **Path-based**: `/api/new-endpoint`
- **Host-based**: `subdomain.localhost`
- **Service mới**: Microservice hoàn toàn mới
- **Route mới cho service cũ**: Thêm endpoint cho service hiện tại

### Bước 2: Chọn vị trí sửa đổi

#### Option A: Service hiện tại (sửa labels trong docker-compose.yaml)

```yaml
existing-service:
  labels:
    - "traefik.http.routers.service-name.rule=PathPrefix(`/old-path`) || PathPrefix(`/new-path`)"
```

#### Option B: Service mới (thêm toàn bộ service block)

```yaml
new-service:
  build: ./services/new-service
  # ... full service configuration
  labels:
    - "traefik.enable=true"
    - "traefik.http.routers.new-service.rule=PathPrefix(`/new-path`)"
    # ... other labels
```

### Bước 3: Apply changes

```bash
# Restart để apply config mới
docker-compose down
docker-compose up -d

# Hoặc chỉ restart service cụ thể
docker-compose restart service-name
```

### Bước 4: Kiểm tra

```bash
# Check Traefik dashboard
curl http://localhost:8080/api/http/routers

# Test endpoint mới
curl http://localhost/new-path
```

## Ví Dụ Thực Tế

### Case 1: Thêm WebSocket cho Chat Service

```yaml
chat-service:
  # ... service config
  labels:
    - "traefik.enable=true"
    - "traefik.http.routers.chat-http.rule=PathPrefix(`/api/chat`)"
    - "traefik.http.routers.chat-http.entrypoints=web"

    # WebSocket route riêng
    - "traefik.http.routers.chat-ws.rule=PathPrefix(`/ws/chat`)"
    - "traefik.http.routers.chat-ws.entrypoints=web"
    - "traefik.http.services.chat-service.loadbalancer.server.port=3000"
```

### Case 2: API Versioning

```yaml
api-v2-service:
  labels:
    - "traefik.enable=true"
    - "traefik.http.routers.api-v2.rule=PathPrefix(`/api/v2`)"
    - "traefik.http.routers.api-v2.entrypoints=web"
    - "traefik.http.routers.api-v2.priority=100" # Cao hơn /api route
```

### Case 3: Health Check Endpoint

```yaml
# Thêm vào tất cả services
labels:
  - "traefik.http.routers.service-health.rule=Path(`/health`)"
  - "traefik.http.routers.service-health.priority=200" # Cao nhất
```

## Common Patterns

### 1. Multi-tenant Routes

```yaml
# Tenant-specific routing
- "traefik.http.routers.tenant.rule=Host(`{tenant:[a-z]+}.localhost`)"
- "traefik.http.routers.tenant.middlewares=tenant-header"

# Trong dynamic.yml
http:
  middlewares:
    tenant-header:
      headers:
        customRequestHeaders:
          X-Tenant: "{{ .Match.tenant }}"
```

### 2. Load Balancer với Multiple Instances

```yaml
# Service với multiple replicas
service-1:
  labels:
    - "traefik.http.services.my-service.loadbalancer.server.port=3000"
    - "traefik.http.services.my-service.loadbalancer.sticky.cookie=true"

service-2:
  labels:
    - "traefik.http.services.my-service.loadbalancer.server.port=3000"
```

### 3. Conditional Routing

```yaml
# Route dựa trên user agent
- "traefik.http.routers.mobile.rule=PathPrefix(`/api`) && HeadersRegexp(`User-Agent`, `.*Mobile.*`)"
- "traefik.http.routers.mobile.service=mobile-optimized-service"

# Route dựa trên query parameter
- "traefik.http.routers.beta.rule=PathPrefix(`/api`) && Query(`beta=true`)"
```

## Cấu Hình Nâng Cao

### 1. Load Balancing

```yaml
labels:
  - "traefik.http.services.service-name.loadbalancer.sticky.cookie=true"
  - "traefik.http.services.service-name.loadbalancer.healthcheck.path=/health"
```

### 2. Rate Limiting per Service

```yaml
# Trong dynamic.yml
http:
  middlewares:
    api-rate-limit:
      rateLimit:
        burst: 50
        period: 1m

# Apply vào service
labels:
  - "traefik.http.routers.service-name.middlewares=api-rate-limit"
```

### 3. Custom Headers

```yaml
# Trong dynamic.yml
http:
  middlewares:
    custom-headers:
      headers:
        customRequestHeaders:
          X-Forwarded-Proto: "https"
        customResponseHeaders:
          X-Custom-Header: "UIT-Go-API"
```
