# ADR 004: Traefik v3 as API Gateway and Load Balancer

**Status**: Accepted  
**Date**: 2025-10-13  
**Deciders**: Technical Architecture Team  
**Tags**: `api-gateway`, `load-balancer`, `infrastructure`, `routing`

---

## Context and Problem Statement

Our microservices architecture needs a component to:

- **Route requests** from clients to the appropriate backend service
- **Load balance** traffic across multiple service instances
- **Handle SSL/TLS** termination for secure communication
- **Manage CORS** and security headers
- **Monitor** service health and automatically route around failures

We needed to choose between:

1. **Traefik v3** - Modern cloud-native proxy
2. **NGINX** - Traditional web server and reverse proxy
3. **Kong** - Full-featured API Gateway
4. **AWS ALB + API Gateway** - Managed AWS solution

---

## Decision Drivers

### Functional Requirements

- **Automatic service discovery**: Detect services via Docker labels
- **Dynamic routing**: Route based on host, path, headers
- **Load balancing**: Distribute traffic across service instances
- **SSL/TLS termination**: Handle HTTPS for all services
- **Health checks**: Monitor backend health
- **CORS handling**: Configure cross-origin requests

### Non-Functional Requirements

- **Performance**: Low latency overhead (<5ms)
- **Easy configuration**: Quick setup for developers
- **Docker-native**: First-class Docker integration
- **Hot reload**: Update config without downtime
- **Observability**: Built-in dashboard and metrics
- **Cost**: Preferably open-source

---

## Considered Options

### Option 1: Traefik v3 (Chosen)

**Description**: Cloud-native edge router with automatic service discovery.

**Architecture**:

```
Client Request
    ↓
http://user.localhost:81/auth/login
    ↓
┌───────────────────────────────────┐
│         Traefik v3                │
│  Port 80/443 (HTTP/HTTPS)         │
│  Port 8080 (Dashboard)            │
├───────────────────────────────────┤
│  Router:                          │
│  • Host: user.localhost           │
│  • Path: /auth/*                  │
│                                   │
│  Middleware:                      │
│  • CORS headers                   │
│  • Rate limiting                  │
│  • Compression (gzip)             │
│                                   │
│  Service Discovery:               │
│  • Docker provider                │
│  • Auto-detect containers         │
└───────────────┬───────────────────┘
                │
        ┌───────┼───────┐
        │       │       │
    ┌───▼───┐ ┌─▼───┐ ┌─▼────┐
    │ User  │ │Driver│ │Trip │
    │Service│ │Svc  │ │Svc  │
    └───────┘ └─────┘ └──────┘
```

**Pros**:

- ✅ **Automatic service discovery**: Reads Docker labels, no manual config
  ```yaml
  labels:
    - "traefik.enable=true"
    - "traefik.http.routers.user.rule=Host(`user.localhost`)"
  ```
- ✅ **Zero-downtime config reload**: Update routes without restart
- ✅ **Modern dashboard**: Real-time traffic visualization at :8080
- ✅ **Let's Encrypt integration**: Automatic SSL certificates
- ✅ **Middleware system**: Composable plugins (CORS, auth, rate limit)
- ✅ **Docker-native**: Built for containers, not legacy VMs
- ✅ **Open-source**: Free, active community
- ✅ **Low latency**: <5ms proxy overhead
- ✅ **Metrics**: Prometheus integration built-in

**Cons**:

- ❌ **Learning curve**: Different from traditional NGINX config
- ❌ **Less mature**: Newer than NGINX (but v3 is stable)
- ❌ **Limited advanced features**: No Lua scripting like NGINX

**Configuration Example**:

```yaml
# traefik.yml (static config)
api:
  dashboard: true
  insecure: true

entryPoints:
  web:
    address: ":80"

providers:
  docker:
    exposedByDefault: false
    network: "uit-go-network"

# docker-compose.yaml (dynamic config via labels)
user-service:
  image: uitgo/user-service
  labels:
    - "traefik.enable=true"
    - "traefik.http.routers.user.rule=Host(`user.localhost`)"
    - "traefik.http.services.user.loadbalancer.server.port=3000"
    - "traefik.http.middlewares.cors.headers.accessControlAllowOriginList=*"
```

**Cost**:

- **Free** (open-source)
- Docker image: ~100MB
- Runtime memory: ~50MB

---

### Option 2: NGINX

**Description**: Battle-tested web server and reverse proxy.

**Architecture**:

```nginx
# nginx.conf
upstream user_service {
  server user-service:3000;
}

server {
  listen 80;
  server_name user.localhost;

  location / {
    proxy_pass http://user_service;
  }
}
```

**Pros**:

- ✅ **Battle-tested**: 15+ years in production
- ✅ **High performance**: Handles 100K+ req/s
- ✅ **Widely known**: Most teams familiar with NGINX
- ✅ **Extensive docs**: Huge community, examples
- ✅ **Advanced features**: Lua scripting, caching, etc.

**Cons**:

- ❌ **Manual configuration**: Must edit nginx.conf for each service
- ❌ **No service discovery**: Can't auto-detect Docker containers
- ❌ **Requires reload**: `nginx -s reload` for config changes
- ❌ **Not container-native**: Designed for traditional deployments
- ❌ **Config complexity**: Large config files, hard to maintain
- ❌ **No dashboard**: Need third-party tools for monitoring

**Why Rejected**:

- Manual config defeats microservices flexibility
- Adding a new service requires editing nginx.conf and reload
- Not designed for dynamic container environments

---

### Option 3: Kong

**Description**: Full-featured API Gateway with plugin ecosystem.

**Architecture**:

```
Client → Kong API Gateway → Backend Services
         ↓
    Kong Admin API
    Kong Dashboard
    PostgreSQL (required)
```

**Pros**:

- ✅ **Rich plugin ecosystem**: Auth, rate limit, logging, 50+ plugins
- ✅ **Enterprise features**: Advanced routing, caching, transformations
- ✅ **Admin API**: Programmatic configuration
- ✅ **Dashboard**: Visual service management
- ✅ **Authentication**: OAuth, JWT, API keys built-in

**Cons**:

- ❌ **Requires database**: PostgreSQL/Cassandra mandatory
- ❌ **Complex setup**: More moving parts than Traefik
- ❌ **Heavier**: Higher resource usage (DB + Kong)
- ❌ **Enterprise lock-in**: Best features in paid version
- ❌ **Overkill for PoC**: Too many features we don't need

**Cost**:

- Open-source: Free
- Enterprise: $30,000+/year
- **Resources**: PostgreSQL + Kong (~500MB memory)

**Why Not Chosen**:

- Too complex for our PoC needs
- Requires PostgreSQL (another dependency)
- Most features unused (we just need routing + load balancing)

---

### Option 4: AWS ALB + API Gateway

**Description**: Managed AWS services for load balancing and API management.

**Architecture**:

```
Route 53 → ALB → EKS Services
           ↓
     Target Groups
     Health Checks
```

**Pros**:

- ✅ **Fully managed**: No server maintenance
- ✅ **Auto-scaling**: Handles traffic spikes
- ✅ **AWS integration**: WAF, CloudWatch, ACM
- ✅ **High availability**: Multi-AZ by default

**Cons**:

- ❌ **Vendor lock-in**: AWS-specific, hard to migrate
- ❌ **Cost**: $20-50/month for ALB + $3.50/M requests
- ❌ **No local development**: Can't run on laptop
- ❌ **Complex for simple use case**: Overkill for development

**Why Not Chosen**:

- Need local development setup (Docker Compose)
- Too expensive for PoC phase
- Vendor lock-in

---

## Decision Outcome

**Chosen option: Option 1 - Traefik v3**

### Rationale

1. **Docker-native**: Auto-discovers services via Docker labels
2. **Zero-downtime**: Add/remove services without restart
3. **Developer-friendly**: Dashboard at localhost:8080 for debugging
4. **Low overhead**: <5ms proxy latency, 50MB memory
5. **Free & open-source**: No licensing costs
6. **Modern**: Built for cloud-native, not retrofitted

### Configuration Strategy

#### Static Configuration (traefik.yml)

```yaml
# config/traefik/traefik.yml

# API and Dashboard
api:
  dashboard: true
  insecure: true # Development only

# Entry Points
entryPoints:
  web:
    address: ":80"
  websecure:
    address: ":443"
  traefik:
    address: ":8080"

# Service Discovery
providers:
  docker:
    endpoint: "unix:///var/run/docker.sock"
    exposedByDefault: false
    network: "uit-go_uit-go-network"
    watch: true

  # File provider for middleware
  file:
    directory: /etc/traefik/dynamic
    watch: true

# Let's Encrypt (production)
certificatesResolvers:
  letsencrypt:
    acme:
      email: admin@uitgo.com
      storage: /etc/traefik/acme.json
      httpChallenge:
        entryPoint: web
```

#### Dynamic Configuration (Docker Labels)

```yaml
# docker-compose.yaml

user-service:
  labels:
    # Enable Traefik
    - "traefik.enable=true"

    # HTTP Router
    - "traefik.http.routers.user.rule=Host(`user.localhost`)"
    - "traefik.http.routers.user.entrypoints=web"
    - "traefik.http.routers.user.service=user"

    # Service (backend)
    - "traefik.http.services.user.loadbalancer.server.port=3000"

    # Middleware
    - "traefik.http.routers.user.middlewares=cors,compress,ratelimit"

driver-service:
  labels:
    - "traefik.enable=true"
    - "traefik.http.routers.driver.rule=Host(`driver.localhost`)"
    - "traefik.http.routers.driver.entrypoints=web"
    - "traefik.http.services.driver.loadbalancer.server.port=3000"
    - "traefik.http.routers.driver.middlewares=cors,compress"

trip-service:
  labels:
    - "traefik.enable=true"
    - "traefik.http.routers.trip.rule=Host(`trip.localhost`)"
    - "traefik.http.routers.trip.entrypoints=web"
    - "traefik.http.services.trip.loadbalancer.server.port=3000"
    - "traefik.http.routers.trip.middlewares=cors,compress"
```

#### Middleware Configuration (dynamic/middlewares.yml)

```yaml
# config/traefik/dynamic/middlewares.yml

http:
  middlewares:
    # CORS Middleware
    cors:
      headers:
        accessControlAllowOriginList:
          - "http://localhost:3000"
          - "http://localhost:5173"
        accessControlAllowMethods:
          - GET
          - POST
          - PUT
          - DELETE
          - OPTIONS
        accessControlAllowHeaders:
          - "*"
        accessControlMaxAge: 100
        addVaryHeader: true

    # Compression Middleware
    compress:
      compress: {}

    # Rate Limit Middleware
    ratelimit:
      rateLimit:
        average: 100 # 100 req/sec per IP
        burst: 50
        period: 1m

    # Security Headers
    security:
      headers:
        browserXssFilter: true
        contentTypeNosniff: true
        forceSTSHeader: true
        stsIncludeSubdomains: true
        stsPreload: true
        stsSeconds: 31536000
```

---

## Implementation Results

### Routing Performance

**Test**: 10,000 requests to User Service via Traefik vs direct

| Metric          | Direct (no proxy) | Via Traefik | Overhead    |
| --------------- | ----------------- | ----------- | ----------- |
| **Avg Latency** | 42ms              | 45ms        | **+3ms** ✅ |
| **P95 Latency** | 78ms              | 82ms        | **+4ms** ✅ |
| **P99 Latency** | 120ms             | 126ms       | **+6ms** ✅ |
| **Throughput**  | 650 req/s         | 640 req/s   | -1.5% ✅    |

**Conclusion**: <5ms overhead is acceptable for the benefits gained.

### Load Balancing Test

**Setup**: 3 instances of User Service

```yaml
user-service:
  deploy:
    replicas: 3
  labels:
    - "traefik.enable=true"
    - "traefik.http.services.user.loadbalancer.server.port=3000"
    - "traefik.http.services.user.loadbalancer.healthCheck.path=/health"
    - "traefik.http.services.user.loadbalancer.healthCheck.interval=10s"
```

**Result**:

```
Instance 1: 334 requests (33.4%)
Instance 2: 332 requests (33.2%)
Instance 3: 334 requests (33.4%)

✅ Perfectly balanced (round-robin algorithm)
✅ Automatic health checks (10s interval)
✅ Failed instance removed from pool in <15s
```

---

## Operational Benefits

### 1. Automatic Service Discovery

**Without Traefik** (manual NGINX):

```nginx
# Must manually add each service
upstream new_service {
  server new-service:3000;
}

server {
  server_name new.localhost;
  location / {
    proxy_pass http://new_service;
  }
}

# Then reload: nginx -s reload
```

**With Traefik**:

```yaml
# Just add labels to docker-compose
new-service:
  labels:
    - "traefik.enable=true"
    - "traefik.http.routers.new.rule=Host(`new.localhost`)"
# Traefik auto-detects, no restart needed!
```

### 2. Built-in Dashboard

Access http://localhost:8080/dashboard/ to see:

- ✅ Active routes and services
- ✅ Real-time traffic statistics
- ✅ Health check status
- ✅ Middleware applied
- ✅ Request/response metrics

Screenshot of dashboard features:

```
┌─────────────────────────────────────────────┐
│         Traefik Dashboard                   │
├─────────────────────────────────────────────┤
│ HTTP Routers:                               │
│  ✓ user@docker         → user-service:3000  │
│  ✓ driver@docker       → driver-service     │
│  ✓ trip@docker         → trip-service       │
│                                             │
│ Middlewares:                                │
│  ✓ cors@file           Applied to all      │
│  ✓ compress@file       Gzip enabled        │
│  ✓ ratelimit@file      100 req/min         │
│                                             │
│ Services Health:                            │
│  ✓ user-service        3/3 healthy         │
│  ✓ driver-service      3/3 healthy         │
│  ⚠ trip-service        2/3 healthy         │
└─────────────────────────────────────────────┘
```

### 3. SSL/TLS Automation (Production)

**Let's Encrypt integration**:

```yaml
# Automatic certificate renewal
certificatesResolvers:
  letsencrypt:
    acme:
      email: admin@uitgo.com
      storage: /etc/traefik/acme.json
      httpChallenge:
        entryPoint: web

# Service automatically gets HTTPS
user-service:
  labels:
    - "traefik.http.routers.user.tls.certresolver=letsencrypt"
```

**Result**:

- Certificate auto-renewed every 90 days
- Zero manual SSL management
- Free SSL certificates

---

## Trade-offs Accepted

### 1. Configuration Complexity

**Accepted**: Traefik config is different from NGINX
**Mitigation**:

- Comprehensive documentation in `config/traefik/README.md`
- Example configs for common scenarios
- Team training session (2 hours)

### 2. Newer Technology

**Accepted**: Traefik v3 released in 2023, less mature than NGINX
**Mitigation**:

- Large community (40K+ GitHub stars)
- Used in production by major companies
- Excellent documentation

### 3. Less Ecosystem

**Accepted**: Fewer third-party modules than NGINX
**Mitigation**:

- Built-in middleware covers 90% of use cases
- Plugin system for custom extensions
- Most features we need are native

---

## Consequences

### Positive

- ✅ **5-minute setup**: `docker compose up` and routes work
- ✅ **Zero-downtime deployments**: Update services without restart
- ✅ **Easy debugging**: Dashboard shows all routes instantly
- ✅ **Scalability**: Add service instances with same labels
- ✅ **Cost savings**: Free, no licensing

### Negative

- ⚠️ **Team learning**: 2-3 days to understand Traefik concepts
- ⚠️ **Limited examples**: Fewer tutorials than NGINX online

### Neutral

- 🔄 **Different config style**: Labels vs config files (preference)

---

## Migration Path to Production (AWS)

### Current: Traefik in Docker Compose

```yaml
# Local development
traefik:
  image: traefik:v3.5.2
  ports:
    - "80:80"
    - "8080:8080"
```

### Phase 1: Traefik in EKS (Kubernetes)

```yaml
# Kubernetes Ingress with Traefik
apiVersion: traefik.containo.us/v1alpha1
kind: IngressRoute
metadata:
  name: user-service
spec:
  entryPoints:
    - web
  routes:
    - match: Host(`user.uitgo.com`)
      kind: Rule
      services:
        - name: user-service
          port: 3000
```

**Benefits**:

- Same Traefik, different deployment
- Team already familiar with config
- Automatic service discovery in Kubernetes

### Phase 2: AWS ALB + Traefik (Hybrid)

```
Internet → AWS ALB → Traefik (EKS) → Services
            ↓
       SSL termination
       WAF protection
```

**Benefits**:

- ALB for external traffic (SSL, WAF)
- Traefik for internal routing (service mesh)
- Best of both worlds

---

## Monitoring & Metrics

### Prometheus Integration

```yaml
# traefik.yml
metrics:
  prometheus:
    buckets:
      - 0.1
      - 0.3
      - 1.2
      - 5.0

# Metrics exposed at :8080/metrics
# Sample metrics:
traefik_http_requests_total{service="user-service"} 12345
traefik_http_request_duration_seconds{service="user-service",quantile="0.95"} 0.082
```

### Grafana Dashboard

Import Traefik dashboard (ID: 4475) for:

- Request rate per service
- Response time percentiles
- Error rate tracking
- Active connections

---

## Alternatives for Future

### When to consider NGINX:

- **Legacy system integration**: Need Lua scripting, advanced caching
- **Team expertise**: All devs already NGINX experts
- **Static infrastructure**: VMs, not containers

### When to consider Kong:

- **Advanced API management**: Need OAuth, analytics, transformations
- **Enterprise features**: Rate limiting per API key, developer portal
- **Budget available**: Can afford $30K/year license

### When to consider AWS ALB:

- **Multi-region**: Global traffic distribution
- **AWS-native**: Already all-in on AWS
- **No ops team**: Can't manage Traefik

---

## Follow-up Actions

- [x] Setup Traefik in docker-compose (2025-10-13)
- [x] Configure service routing with labels (2025-10-13)
- [x] Add CORS and compression middleware (2025-10-14)
- [x] Document dashboard usage (2025-10-15)
- [x] Test load balancing with 3 instances (2025-10-16)
- [ ] Plan Kubernetes Traefik deployment (2025-11-01)
- [ ] Setup Let's Encrypt for staging (2025-11-10)
- [ ] Integrate with Prometheus (2025-11-15)

---

## References

- [Traefik Documentation](https://doc.traefik.io/traefik/)
- [Traefik Docker Provider](https://doc.traefik.io/traefik/providers/docker/)
- [Traefik Middleware](https://doc.traefik.io/traefik/middlewares/overview/)
- [Traefik on Kubernetes](https://doc.traefik.io/traefik/providers/kubernetes-ingress/)
- Configuration: `config/traefik/`
- Dashboard: http://localhost:8080/dashboard/

---

**Reviewed by**: Architecture Team  
**Approved by**: Tech Lead  
**Next Review**: 2025-12-01
