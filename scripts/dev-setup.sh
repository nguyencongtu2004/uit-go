#!/bin/bash
# Development setup script for UIT-Go project
# This script sets up the development environment

set -e

echo "🚀 Setting up UIT-Go development environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check prerequisites
echo -e "${BLUE}🔍 Checking prerequisites...${NC}"

# Check Docker
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi
print_status "Docker is installed"

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi
print_status "Docker Compose is installed"

# Check Node.js
if ! command -v node &> /dev/null; then
    print_warning "Node.js is not installed. Some features may not work."
else
    NODE_VERSION=$(node --version)
    print_status "Node.js is installed: $NODE_VERSION"
fi

# Check npm
if ! command -v npm &> /dev/null; then
    print_warning "npm is not installed. Some features may not work."
else
    NPM_VERSION=$(npm --version)
    print_status "npm is installed: $NPM_VERSION"
fi

# Create necessary directories
echo -e "${BLUE}📁 Creating necessary directories...${NC}"
mkdir -p logs/{user-service,driver-service,trip-service,traefik}
mkdir -p data/{mongodb,redis,kafka}
mkdir -p scripts/{backup,migration}
mkdir -p certs
print_status "Directories created"

# Set permissions
echo -e "${BLUE}🔐 Setting up permissions...${NC}"
chmod +x .githooks/setup-hooks.sh
chmod +x .githooks/pre-commit
chmod +x .githooks/pre-push
print_status "Git hooks permissions set"

# Install Git hooks
echo -e "${BLUE}🪝 Installing Git hooks...${NC}"
if [ -f ".githooks/setup-hooks.sh" ]; then
    ./.githooks/setup-hooks.sh
else
    print_warning "Git hooks setup script not found"
fi

# Copy environment files if they don't exist
echo -e "${BLUE}⚙️  Setting up environment files...${NC}"
for service in user-service driver-service trip-service; do
    if [ ! -f "env/${service}.env.local" ]; then
        cp "env/${service}.env" "env/${service}.env.local"
        print_info "Created env/${service}.env.local from template"
    fi
done

# Install dependencies for services
echo -e "${BLUE}📦 Installing service dependencies...${NC}"
for service in user-service driver-service trip-service; do
    if [ -f "services/${service}/package.json" ]; then
        print_info "Installing dependencies for ${service}..."
        cd "services/${service}"
        npm install --silent
        cd ../..
        print_status "Dependencies installed for ${service}"
    fi
done

# Install common utilities dependencies
if [ -f "common/package.json" ]; then
    print_info "Installing common utilities dependencies..."
    cd common
    npm install --silent
    cd ..
    print_status "Common utilities dependencies installed"
fi

# Create development Docker Compose override
echo -e "${BLUE}🐳 Creating development Docker Compose configuration...${NC}"
cat > docker-compose.dev.yml << 'EOF'
version: '3.8'

services:
  user-service:
    build:
      target: dependencies  # Use dependencies stage for development
    volumes:
      - ./services/user-service:/app:cached
      - /app/node_modules
    environment:
      - NODE_ENV=development
      - ENABLE_DEBUG=true
    command: ["npm", "run", "dev"]
    ports:
      - "3000:3000"  # Expose port for direct access during development

  driver-service:
    build:
      target: dependencies
    volumes:
      - ./services/driver-service:/app:cached
      - /app/node_modules
    environment:
      - NODE_ENV=development
      - ENABLE_DEBUG=true
    command: ["npm", "run", "dev"]
    ports:
      - "3001:3000"  # Expose port for direct access during development
      - "3011:3001"  # WebSocket port

  trip-service:
    build:
      target: dependencies
    volumes:
      - ./services/trip-service:/app:cached
      - /app/node_modules
    environment:
      - NODE_ENV=development
      - ENABLE_DEBUG=true
    command: ["npm", "run", "dev"]
    ports:
      - "3002:3000"  # Expose port for direct access during development
      - "3012:3002"  # WebSocket port

  # Enable Traefik dashboard access
  traefik:
    command:
      - --api.insecure=true
      - --api.dashboard=true
      - --configfile=/etc/traefik/traefik.yml
    ports:
      - "8080:8080"  # Dashboard access
EOF
print_status "Development Docker Compose configuration created"

# Create useful development scripts
echo -e "${BLUE}📝 Creating development scripts...${NC}"
mkdir -p scripts/dev

# Database reset script
cat > scripts/dev/reset-databases.sh << 'EOF'
#!/bin/bash
# Reset all databases for development

echo "🗑️  Resetting all databases..."

# Stop services
docker-compose down

# Remove volumes
docker volume rm $(docker volume ls -q | grep uit-go) 2>/dev/null || true

# Restart services
docker-compose up -d mongodb-users mongodb-drivers mongodb-trips redis kafka

echo "✅ Databases reset complete"
EOF
chmod +x scripts/dev/reset-databases.sh

# Service logs script
cat > scripts/dev/logs.sh << 'EOF'
#!/bin/bash
# View service logs

SERVICE=$1

if [ -z "$SERVICE" ]; then
    echo "📋 Available services:"
    echo "  - user-service"
    echo "  - driver-service"
    echo "  - trip-service"
    echo "  - traefik"
    echo "  - kafka"
    echo "  - redis"
    echo "  - mongodb-users"
    echo "  - mongodb-drivers"
    echo "  - mongodb-trips"
    echo ""
    echo "Usage: $0 <service-name>"
    echo "       $0 all  (for all services)"
    exit 1
fi

if [ "$SERVICE" = "all" ]; then
    docker-compose logs -f
else
    docker-compose logs -f "$SERVICE"
fi
EOF
chmod +x scripts/dev/logs.sh

# Health check script
cat > scripts/dev/health-check.sh << 'EOF'
#!/bin/bash
# Check health of all services

echo "🏥 Checking service health..."

services=("user-service:3000" "driver-service:3000" "trip-service:3000")

for service in "${services[@]}"; do
    name=$(echo $service | cut -d':' -f1)
    port=$(echo $service | cut -d':' -f2)
    
    echo -n "Checking $name... "
    if curl -s -f "http://localhost:$port/health" > /dev/null 2>&1; then
        echo "✅ Healthy"
    else
        echo "❌ Unhealthy"
    fi
done

echo ""
echo "🐳 Docker container status:"
docker-compose ps
EOF
chmod +x scripts/dev/health-check.sh

print_status "Development scripts created"

# Create useful aliases and functions
echo -e "${BLUE}🔧 Creating development aliases...${NC}"
cat > scripts/dev/aliases.sh << 'EOF'
#!/bin/bash
# Development aliases and functions for UIT-Go

# Docker Compose aliases
alias dcup='docker-compose up -d'
alias dcdown='docker-compose down'
alias dcrestart='docker-compose restart'
alias dcps='docker-compose ps'
alias dclogs='docker-compose logs -f'

# Service-specific aliases
alias logs-user='docker-compose logs -f user-service'
alias logs-driver='docker-compose logs -f driver-service'
alias logs-trip='docker-compose logs -f trip-service'
alias logs-traefik='docker-compose logs -f traefik'

# Database aliases
alias mongo-users='docker-compose exec mongodb-users mongosh uitgo_users -u admin -p uitgo123'
alias mongo-drivers='docker-compose exec mongodb-drivers mongosh uitgo_drivers -u admin -p uitgo123'
alias mongo-trips='docker-compose exec mongodb-trips mongosh uitgo_trips -u admin -p uitgo123'
alias redis-cli='docker-compose exec redis redis-cli -a redis123'

# Development helpers
alias dev-setup='./scripts/dev-setup.sh'
alias dev-reset='./scripts/dev/reset-databases.sh'
alias dev-logs='./scripts/dev/logs.sh'
alias dev-health='./scripts/dev/health-check.sh'

# Utility functions
function service-shell() {
    docker-compose exec $1 /bin/sh
}

function service-restart() {
    docker-compose restart $1
}

echo "🎉 UIT-Go development aliases loaded!"
echo "💡 Usage examples:"
echo "  dcup                 - Start all services"
echo "  logs-user           - View user service logs"
echo "  mongo-users         - Connect to users database"
echo "  redis-cli           - Connect to Redis"
echo "  service-shell user-service - Open shell in user service container"
EOF

print_status "Development aliases created"

# Create README for development
cat > README.dev.md << 'EOF'
# UIT-Go Development Guide

## Quick Start

1. **Setup development environment:**
   ```bash
   ./scripts/dev-setup.sh
   ```

2. **Load development aliases:**
   ```bash
   source scripts/dev/aliases.sh
   ```

3. **Start all services:**
   ```bash
   dcup
   # or
   docker-compose up -d
   ```

4. **View service logs:**
   ```bash
   dclogs
   # or for specific service:
   logs-user
   ```

## Development Workflow

### Daily Development
- Use `docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d` for development mode
- Services will auto-reload on code changes
- Access services directly via exposed ports

### Database Operations
- **Connect to MongoDB:**
  - Users DB: `mongo-users`
  - Drivers DB: `mongo-drivers`
  - Trips DB: `mongo-trips`

- **Connect to Redis:**
  ```bash
  redis-cli
  ```

- **Reset all databases:**
  ```bash
  ./scripts/dev/reset-databases.sh
  ```

### Service Management
- **Check service health:**
  ```bash
  ./scripts/dev/health-check.sh
  ```

- **View specific service logs:**
  ```bash
  ./scripts/dev/logs.sh user-service
  ```

- **Access service shell:**
  ```bash
  service-shell user-service
  ```

### URLs and Access Points

- **Traefik Dashboard:** http://localhost:8080
- **User Service API:** http://localhost/api/users
- **Driver Service API:** http://localhost/api/drivers
- **Trip Service API:** http://localhost/api/trips

### Development Ports (Direct Access)
- User Service: http://localhost:3000
- Driver Service: http://localhost:3001
- Trip Service: http://localhost:3002
- WebSocket (Driver): http://localhost:3011
- WebSocket (Trip): http://localhost:3012

### Git Workflow
Pre-commit hooks are automatically installed and will:
- Run ESLint on JavaScript files
- Check for sensitive files
- Validate Docker configurations
- Check for large files

### Troubleshooting

**Services won't start:**
1. Check Docker is running
2. Check ports aren't in use: `netstat -tulpn | grep :3000`
3. Reset databases: `./scripts/dev/reset-databases.sh`

**Database connection issues:**
1. Check MongoDB containers: `docker-compose ps`
2. Check logs: `docker-compose logs mongodb-users`
3. Reset volumes: `docker-compose down -v && docker-compose up -d`

**Traefik routing issues:**
1. Check dashboard: http://localhost:8080
2. Verify service labels in docker-compose.yml
3. Check Traefik logs: `docker-compose logs traefik`
EOF

print_status "Development README created"

# Final setup messages
echo ""
echo -e "${GREEN}🎉 Development environment setup complete!${NC}"
echo ""
echo -e "${BLUE}📋 Next steps:${NC}"
echo "1. Load development aliases: source scripts/dev/aliases.sh"
echo "2. Start services: docker-compose up -d"
echo "3. Check service health: ./scripts/dev/health-check.sh"
echo "4. Access Traefik dashboard: http://localhost:8080"
echo ""
echo -e "${BLUE}📚 Documentation:${NC}"
echo "- Development guide: README.dev.md"
echo "- Main README: README.md"
echo ""
echo -e "${BLUE}🛠️  Useful commands:${NC}"
echo "- dcup              # Start all services"
echo "- dcdown            # Stop all services"
echo "- dev-logs <service> # View service logs"
echo "- dev-health        # Check service health"
echo ""
print_status "Happy coding! 🚀"